/**
 * The only code that talks to ClickUp. GET only: there is no other verb in this file. Every call
 * goes through the limiter, identical calls in flight share one request, and failures are retried
 * the way ClickUp asks: a 429 waits for X-RateLimit-Reset, a 5xx or a network error backs off
 * exponentially. Redirects are refused for the API and checked hop by hop for image downloads.
 */
import { ApiError } from '../../core/errors/api-error.ts';
import { isAllowedAssetUrl, mayCarryToken } from '../../core/security/hosts.ts';
import type { Logger } from '../../ports/runtime.ts';
import type { Limiter } from './limiter.ts';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface HttpOptions {
  readonly token: string;
  readonly fetch: FetchLike;
  readonly limiter: Limiter;
  readonly logger: Logger;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly assetHosts: readonly string[];
  readonly maxDownloadBytes: number;
}

export type QueryValue = string | number | boolean | readonly (string | number)[] | undefined;

export interface HttpClient {
  getJson(path: string, query?: Readonly<Record<string, QueryValue>>): Promise<unknown>;
  getBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }>;
}

const API = 'https://api.clickup.com';
const MAX_WAIT_MS = 60_000;

export function buildUrl(path: string, query: Readonly<Record<string, QueryValue>> = {}): string {
  const url = new URL(path, API);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value))
      for (const item of value) url.searchParams.append(`${key}[]`, String(item));
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function errorFrom(response: Response): Promise<ApiError> {
  let code = '';
  let message = `ClickUp answered ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const err: unknown = Reflect.get(body, 'err');
      const ecode: unknown = Reflect.get(body, 'ECODE');
      if (typeof err === 'string') message = err;
      if (typeof ecode === 'string') code = ecode;
    }
  } catch {
    /* A body that is not JSON keeps the generic message. */
  }
  return new ApiError(response.status, code, message);
}

function networkError(error: unknown): ApiError {
  const timeout = error instanceof Error && error.name === 'TimeoutError';
  return timeout
    ? new ApiError(0, 'TIMEOUT', 'ClickUp did not answer in time.')
    : new ApiError(0, 'NETWORK', 'ClickUp could not be reached.');
}

function retryDelay(response: Response | null, attempt: number, now: number): number {
  const reset = Number(response?.headers.get('x-ratelimit-reset') ?? '');
  if (response?.status === 429 && Number.isFinite(reset) && reset > 0)
    return Math.min(MAX_WAIT_MS, Math.max(0, reset * 1000 - now) + 250);
  return Math.min(MAX_WAIT_MS, 500 * 2 ** attempt + Math.floor(Math.random() * 250));
}

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

async function send(o: HttpOptions, call: Call, tries: number): Promise<Response> {
  let response: Response | null = null;
  try {
    response = await o.limiter.run(() =>
      o.fetch(call.url, { ...call.init, signal: AbortSignal.timeout(o.timeoutMs) }),
    );
    if (response.status !== 429 && response.status < 500) return response;
  } catch (error) {
    if (tries >= o.retries) throw networkError(error);
  }
  if (response && tries >= o.retries) return response;
  const wait = retryDelay(response, tries, o.now());
  o.logger.warn('clickup retry', {
    status: response?.status ?? 0,
    waitMs: wait,
    attempt: tries + 1,
  });
  await o.sleep(wait);
  return send(o, call, tries + 1);
}

async function fetchJson(o: HttpOptions, url: string): Promise<unknown> {
  const started = o.now();
  const headers = { authorization: o.token, accept: 'application/json' };
  const response = await send(o, { url, init: { method: 'GET', redirect: 'error', headers } }, 0);
  o.logger.debug('clickup get', {
    path: new URL(url).pathname,
    status: response.status,
    ms: o.now() - started,
  });
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}

const TOO_LARGE = (): ApiError =>
  new ApiError(413, 'TOO_LARGE', 'The image is larger than the download limit.');

async function readBody(
  o: HttpOptions,
  response: Response,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!response.ok) throw await errorFrom(response);
  if (Number(response.headers.get('content-length') ?? '0') > o.maxDownloadBytes) throw TOO_LARGE();
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > o.maxDownloadBytes) throw TOO_LARGE();
  return { bytes, mime: (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '' };
}

async function download(
  o: HttpOptions,
  url: string,
  hops: number,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!isAllowedAssetUrl(url, o.assetHosts))
    throw new ApiError(403, 'HOST_NOT_ALLOWED', 'This image host is not on the allowed list.');
  const headers: Record<string, string> = mayCarryToken(url) ? { authorization: o.token } : {};
  const response = await send(o, { url, init: { method: 'GET', redirect: 'manual', headers } }, 0);
  const location = response.headers.get('location');
  const redirected = response.status >= 300 && response.status < 400 && location !== null;
  if (redirected && hops < 3) return download(o, new URL(location, url).toString(), hops + 1);
  return readBody(o, response);
}

export function createHttpClient(options: HttpOptions): HttpClient {
  const inFlight = new Map<string, Promise<unknown>>();
  const shared = async (url: string): Promise<unknown> => {
    try {
      return await fetchJson(options, url);
    } finally {
      inFlight.delete(url);
    }
  };
  return {
    getJson(path, query) {
      const url = buildUrl(path, query);
      const running = inFlight.get(url);
      if (running) return running;
      const request = shared(url);
      inFlight.set(url, request);
      return request;
    },
    getBytes: (url) => download(options, url, 0),
  };
}
