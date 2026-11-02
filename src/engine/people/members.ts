/**
 * Names for the numeric user ids that docs carry (creator, page authors). Members are fetched once
 * a day at most, and only when an id is missing: in a workspace of a thousand people the member
 * list is the single largest response, so it is never fetched on every read.
 */
import type { Member } from '../../core/model/clickup.types.ts';
import { guard } from '../api/guard.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';

const KEY = 'members_synced_at';
const DAY = 86_400_000;

export async function memberNames(
  deps: EngineDeps,
  ids: readonly number[],
): Promise<Map<number, string>> {
  const wanted = ids.filter((id) => id > 0);
  let names = deps.stores.members.names(wanted);
  const last = Number(deps.stores.meta.get(KEY) ?? '0');
  if (names.size < new Set(wanted).size && last < deps.clock.now() - DAY) {
    try {
      deps.stores.members.save(await deps.clickup.members());
      deps.stores.meta.set(KEY, String(deps.clock.now()));
      names = deps.stores.members.names(wanted);
    } catch (error) {
      deps.logger.warn('member names unavailable', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
  return names;
}

export async function me(deps: EngineDeps): Promise<Member> {
  const known = deps.memo.me.get('me');
  if (known) return known;
  const user = await guard('user', () => deps.clickup.me());
  deps.memo.me.set('me', user);
  return user;
}
