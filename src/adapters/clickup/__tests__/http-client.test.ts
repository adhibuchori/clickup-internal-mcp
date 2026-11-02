import { describe, expect, test } from 'bun:test';
import { createConsoleLogger } from '../../logger/console-logger.ts';
import { ApiError } from '../../../core/errors/api-error.ts';
import { buildUrl, createHttpClient, type FetchLike, type HttpOptions } from '../http-client.ts';
import { createLimiter } from '../limiter.ts';

const TOKEN = ['pk', '1', 'X'.repeat(30)].join('_');

function client(fetch: FetchLike, over: Partial<HttpOptions> = {}) {
  const waits: number[] = [];
  const logs: string[] = [];
  const http = createHttpClient({
    token: TOKEN,
    fetch,
    limiter: createLimiter({
      concurrency: 4,
      perMinute: 1000,
      now: () => 0,
      sleep: async () => {},
    }),
    logger: createConsoleLogger('debug', (line) => logs.push(line)),
    now: () => 1_000_000,
    sleep: async (ms) => void waits.push(ms),
    timeoutMs: 1000,
    retries: 2,
    assetHosts: ['cdn.example.com'],
    maxDownloadBytes: 10,
    ...over,
  });
  return { http, waits, logs };
}

const ok = (body: unknown): Response => Response.json(body);

test('buildUrl encodes arrays the way ClickUp expects and skips undefined', () => {
  expect(
    buildUrl('/api/v2/team/1/task', {
      page: 0,
      list_ids: ['a', 'b'],
      tag: undefined,
      closed: true,
    }),
  ).toBe(
    'https://api.clickup.com/api/v2/team/1/task?page=0&list_ids%5B%5D=a&list_ids%5B%5D=b&closed=true',
  );
});

describe('getJson', () => {
  test('sends the token as is, refuses redirects, and parses JSON', async () => {
    let seen: RequestInit = {};
    const { http } = client(async (_url, init) => {
      seen = init;
      return ok({ a: 1 });
    });
    expect(await http.getJson('/api/v2/user')).toEqual({ a: 1 });
    expect(new Headers(seen.headers).get('authorization')).toBe(TOKEN);
    expect(seen.redirect).toBe('error');
  });

  test('identical requests in flight share one fetch', async () => {
    let calls = 0;
    const { http } = client(async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 2));
      return ok({ n: calls });
    });
    const [a, b] = await Promise.all([http.getJson('/x'), http.getJson('/x')]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    await http.getJson('/x');
    expect(calls).toBe(2);
  });

  test('a 429 waits until X-RateLimit-Reset, a 5xx backs off, then it succeeds', async () => {
    const answers = [
      new Response('{}', {
        status: 429,
        headers: { 'x-ratelimit-reset': String(1_000_000 / 1000 + 5) },
      }),
      new Response('{}', { status: 503 }),
      ok({ done: true }),
    ];
    const { http, waits, logs } = client(async () => answers.shift() ?? ok({}));
    expect(await http.getJson('/y')).toEqual({ done: true });
    expect(waits[0]).toBe(5250);
    expect(waits[1]).toBeGreaterThanOrEqual(1000);
    expect(logs.some((l) => l.includes('clickup retry'))).toBe(true);
  });

  test('after the last retry the error answer is reported with ClickUp code', async () => {
    const { http } = client(async () =>
      Response.json({ err: 'Rate', ECODE: 'RATE_1' }, { status: 429 }),
    );
    const error = await http.getJson('/z').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'RATE_1', message: 'Rate' });
  });

  test('4xx is not retried; a non-JSON error body keeps a generic message', async () => {
    let calls = 0;
    const { http } = client(async () => {
      calls++;
      return new Response('nope', { status: 404 });
    });
    expect(await http.getJson('/missing').catch((error: unknown) => error)).toMatchObject({
      status: 404,
      message: 'ClickUp answered 404',
    });
    expect(calls).toBe(1);
  });

  test('network failures and timeouts become ApiErrors after the retries', async () => {
    const network = client(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await network.http.getJson('/n').catch((error: unknown) => error)).toMatchObject({
      status: 0,
      code: 'NETWORK',
    });
    const timeout = client(async () => {
      const error = new Error('t');
      error.name = 'TimeoutError';
      throw error;
    });
    expect(await timeout.http.getJson('/t').catch((error: unknown) => error)).toMatchObject({
      status: 0,
      code: 'TIMEOUT',
    });
  });
});

describe('getBytes', () => {
  const png = new Uint8Array([1, 2, 3]);

  test('follows redirects on allowed hosts and sends the token only to ClickUp', async () => {
    const seen: [string, string | null][] = [];
    const { http } = client(async (url, init) => {
      seen.push([url, new Headers(init.headers).get('authorization')]);
      if (url.includes('clickup'))
        return new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.com/a.png' },
        });
      return new Response(png, { headers: { 'content-type': 'image/png; charset=binary' } });
    });
    expect(await http.getBytes('https://t1.p.clickup-attachments.com/a.png')).toEqual({
      bytes: png,
      mime: 'image/png',
    });
    expect(seen).toEqual([
      ['https://t1.p.clickup-attachments.com/a.png', TOKEN],
      ['https://cdn.example.com/a.png', null],
    ]);
  });

  test('refuses hosts off the list, also after a redirect', async () => {
    const { http } = client(
      async () => new Response(null, { status: 301, headers: { location: 'https://evil.io/x' } }),
    );
    expect(
      await http.getBytes('https://evil.io/a.png').catch((error: unknown) => error),
    ).toMatchObject({
      code: 'HOST_NOT_ALLOWED',
    });
    expect(
      await http.getBytes('https://app.clickup.com/a.png').catch((error: unknown) => error),
    ).toMatchObject({
      code: 'HOST_NOT_ALLOWED',
    });
  });

  test('refuses images over the size limit by header or by body, and reports errors', async () => {
    const big = client(async () => new Response(png, { headers: { 'content-length': '999' } }));
    expect(
      await big.http.getBytes('https://app.clickup.com/a').catch((error: unknown) => error),
    ).toMatchObject({
      status: 413,
    });
    const body = client(async () => new Response(new Uint8Array(20)));
    expect(
      await body.http.getBytes('https://app.clickup.com/b').catch((error: unknown) => error),
    ).toMatchObject({
      status: 413,
    });
    const missing = client(async () => new Response('x', { status: 404 }));
    expect(
      await missing.http.getBytes('https://app.clickup.com/c').catch((error: unknown) => error),
    ).toMatchObject({
      status: 404,
    });
    const loop = client(
      async () => new Response(null, { status: 302, headers: { location: '/again' } }),
    );
    expect(
      await loop.http.getBytes('https://app.clickup.com/d').catch((error: unknown) => error),
    ).toMatchObject({
      status: 302,
    });
    const bare = client(async () => new Response(new Uint8Array([1])));
    expect((await bare.http.getBytes('https://app.clickup.com/e')).mime).toBe('');
  });
});
