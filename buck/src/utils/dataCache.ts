/**
 * Write-aware read cache for the dashboard list queries (OPT-003).
 *
 * Eight-plus pages read the same expenses/wallets/goals/incomes lists. Without
 * this, every tab switch refetches them in full. An entry is reused only while
 *   - it is younger than TTL_MS, and
 *   - no write has happened since it was fetched.
 * The Supabase client's fetch wrapper (utils/supabase.ts) calls `bumpDataEpoch`
 * for every mutating REST/RPC request, and realtime events call it too, so a
 * write from this tab, another tab or the mobile app invalidates everything.
 * Concurrent callers share one in-flight request.
 */

const TTL_MS = 15_000;

type Entry<T> = { epoch: number; at: number; promise: Promise<T> };

let epoch = 0;
const entries = new Map<string, Entry<unknown>>();

export function bumpDataEpoch() {
  epoch += 1;
}

export function clearDataCache() {
  epoch += 1;
  entries.clear();
}

export async function cachedRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key) as Entry<T> | undefined;

  if (hit && hit.epoch === epoch && now - hit.at < TTL_MS) {
    return hit.promise;
  }

  const entry: Entry<T> = { epoch, at: now, promise: load() };
  entries.set(key, entry as Entry<unknown>);

  try {
    return await entry.promise;
  } catch (error) {
    // Never cache a failure.
    if (entries.get(key) === (entry as Entry<unknown>)) entries.delete(key);
    throw error;
  }
}

/** Shallow copy so callers that sort/mutate in place cannot corrupt the cache. */
export function copyList<T>(list: T[]): T[] {
  return [...list];
}

/** fetch() wrapper: any non-read request to the REST/RPC API invalidates reads. */
export function createInvalidatingFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const mutates =
      method !== "GET" && method !== "HEAD" && /\/rest\/v1\//.test(url);

    if (mutates) bumpDataEpoch();
    try {
      return await baseFetch(input, init);
    } finally {
      if (mutates) bumpDataEpoch();
    }
  };
}
