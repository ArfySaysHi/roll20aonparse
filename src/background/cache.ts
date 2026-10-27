import type { FetchPageResponse } from "../shared/protocol";
import { parseNethysUrl } from "../shared/urls";

/** The slice of `browser.storage.local` we use (also trivial to fake in tests). */
export interface KeyValueStore {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  /** Needed for eviction and clearing; a store without it still caches, just without a cap. */
  remove?(keys: string[]): Promise<void>;
}

interface CacheEntry {
  html: string;
  fetchedAt: number;
}

// Stat blocks almost never change, so a long lifetime is fine.
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PREFIX = "page:";
const INDEX_KEY = "cache-index";

// Without `unlimitedStorage` the extension shares the browser's storage.local quota, so keep the
// cache comfortably inside it. Nethys pages are tens of KB each.
export const MAX_ENTRIES = 150;
export const MAX_BYTES = 4_000_000;

/** What a real Nethys content page (monster or spell) contains; an error page doesn't. */
export const looksLikeNethysPage = (html: string) => html.includes("MainContent_DataList");

/** key -> when it was fetched and how big it is, so the oldest can be evicted without reading them all. */
type CacheIndex = Record<string, { fetchedAt: number; size: number }>;

const isIndex = (value: unknown): value is CacheIndex =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every(
    (e) => typeof (e as { fetchedAt?: unknown })?.fetchedAt === "number" && typeof (e as { size?: unknown })?.size === "number",
  );

async function readIndex(store: KeyValueStore): Promise<CacheIndex> {
  const stored = (await store.get(INDEX_KEY))[INDEX_KEY];
  return isIndex(stored) ? { ...stored } : {};
}

/** Keys to drop (oldest first) so the index fits the limits, never including `keep`. */
export function evictionOrder(index: CacheIndex, keep: string): string[] {
  const byAge = Object.entries(index)
    .filter(([key]) => key !== keep)
    .sort(([, a], [, b]) => a.fetchedAt - b.fetchedAt);

  let count = Object.keys(index).length;
  let bytes = Object.values(index).reduce((sum, e) => sum + e.size, 0);
  const evict: string[] = [];

  for (const [key, { size }] of byAge) {
    if (count <= MAX_ENTRIES && bytes <= MAX_BYTES) break;
    evict.push(key);
    count--;
    bytes -= size;
  }

  return evict;
}

/** Removes every cached page. Resolves to how many were removed. */
export async function clearCache(store: KeyValueStore): Promise<number> {
  if (!store.remove) throw new Error("This browser's storage can't remove entries");

  const keys = Object.keys(await readIndex(store));
  await store.remove([...keys, INDEX_KEY]);
  return keys.length;
}

/** www/non-www, casing and #fragments all point at the same page. */
export function cacheKey(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  return `${PREFIX}${host}${url.pathname}${url.search}`.toLowerCase();
}

const isEntry = (value: unknown): value is CacheEntry =>
  typeof (value as CacheEntry)?.html === "string" &&
  typeof (value as CacheEntry)?.fetchedAt === "number";

export interface CacheOptions {
  ttlMs?: number;
  now?: () => number;
  /** Pages failing this check are returned but not stored (default: store everything that loads). */
  isCacheable?: (html: string) => boolean;
}

/**
 * Wraps a page fetcher so repeat imports don't hit Nethys again. We cache the raw HTML
 * (not the parsed result) so parser fixes apply to pages that are already cached.
 *
 * - Only successful fetches that pass `isCacheable` are cached (an error page served with a 200
 *   would otherwise stick for the whole lifetime).
 * - The cache is capped (MAX_ENTRIES / MAX_BYTES); the oldest pages go first.
 * - An expired entry is refetched, but served as a fallback if Nethys is unreachable.
 * - A broken or full store never breaks an import; it just means no caching.
 */
export function withCache(
  fetcher: (url: string) => Promise<FetchPageResponse>,
  store: KeyValueStore,
  { ttlMs = DEFAULT_TTL_MS, now = Date.now, isCacheable = () => true }: CacheOptions = {},
): (url: string) => Promise<FetchPageResponse> {
  return async (rawUrl) => {
    const url = parseNethysUrl(rawUrl);
    if (!url) return fetcher(rawUrl); // let the fetcher report the bad link

    const key = cacheKey(url);
    let stale: CacheEntry | null = null;

    try {
      const entry = (await store.get(key))[key];

      if (isEntry(entry)) {
        if (now() - entry.fetchedAt < ttlMs) return { ok: true, html: entry.html, fromCache: true };
        stale = entry;
      }
    } catch {
      // storage unavailable: fall through to the network
    }

    const result = await fetcher(url.href);

    if (result.ok) {
      if (isCacheable(result.html)) await remember(store, key, result.html, now());
      return result;
    }

    return stale ? { ok: true, html: stale.html, fromCache: true } : result;
  };
}

async function remember(store: KeyValueStore, key: string, html: string, fetchedAt: number) {
  try {
    const index = await readIndex(store);
    index[key] = { fetchedAt, size: html.length };

    const evict = store.remove ? evictionOrder(index, key) : [];
    for (const old of evict) delete index[old];

    await store.set({ [key]: { html, fetchedAt } satisfies CacheEntry, [INDEX_KEY]: index });
    if (evict.length) await store.remove?.(evict);
  } catch {
    // quota or storage error: the import still succeeds, it just isn't cached
  }
}
