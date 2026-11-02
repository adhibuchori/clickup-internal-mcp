/**
 * A small in-memory cache with a time to live and a size cap, evicting the least recently used
 * entry. Live reads of things nobody tracks land here instead of on disk, so nothing untracked is
 * ever written to the laptop.
 */
export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  clear(): void;
}

export function createTtlCache<V>(options: {
  ttlMs: number;
  max: number;
  now: () => number;
}): TtlCache<V> {
  const entries = new Map<string, { value: V; expires: number }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expires <= options.now()) return undefined;
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expires: options.now() + options.ttlMs });
      while (entries.size > options.max) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear: () => entries.clear(),
  };
}
