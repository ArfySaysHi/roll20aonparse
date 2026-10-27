import { describe, test, expect, vi } from "vitest";
import {
  cacheKey,
  clearCache,
  DEFAULT_TTL_MS,
  looksLikeNethysPage,
  MAX_BYTES,
  MAX_ENTRIES,
  withCache,
  type KeyValueStore,
} from "../../src/background/cache";
import type { FetchPageResponse } from "../../src/shared/protocol";

const URL_SOLAR = "https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar";

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = { ...initial };
  const store: KeyValueStore = {
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => void keys.forEach((k) => delete data[k]),
  };
  return { store, data };
}

const ok = (html: string): FetchPageResponse => ({ ok: true, html });

describe("cacheKey", () => {
  test("treats www, casing and fragments as the same page", () => {
    const keys = [
      "https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar",
      "https://www.aonprd.com/MonsterDisplay.aspx?ItemName=Solar",
      "https://aonprd.com/monsterdisplay.aspx?itemname=solar#top",
    ].map((u) => cacheKey(new URL(u)));

    expect(new Set(keys).size).toBe(1);
  });

  test("different monsters get different keys", () => {
    expect(cacheKey(new URL(URL_SOLAR))).not.toBe(cacheKey(new URL(URL_SOLAR.replace("Solar", "Marid"))));
  });
});

describe("withCache", () => {
  test("fetches once, then serves repeats from the cache", async () => {
    const { store } = memoryStore();
    const fetcher = vi.fn(async () => ok("<html>solar</html>"));
    const cached = withCache(fetcher, store);

    expect(await cached(URL_SOLAR)).toEqual({ ok: true, html: "<html>solar</html>" });
    expect(await cached(URL_SOLAR)).toEqual({ ok: true, html: "<html>solar</html>", fromCache: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("a different spelling of the same url hits the cache", async () => {
    const { store } = memoryStore();
    const fetcher = vi.fn(async () => ok("x"));
    const cached = withCache(fetcher, store);

    await cached(URL_SOLAR);
    await cached("https://www.aonprd.com/monsterdisplay.aspx?itemname=solar");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("different pages are cached separately", async () => {
    const { store } = memoryStore();
    const fetcher = vi.fn(async (u: string) => ok(u));
    const cached = withCache(fetcher, store);

    await cached(URL_SOLAR);
    await cached(URL_SOLAR.replace("Solar", "Marid"));

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("refetches after the entry expires", async () => {
    const { store } = memoryStore();
    const fetcher = vi.fn(async () => ok("html"));
    let time = 1_000;
    const cached = withCache(fetcher, store, { now: () => time });

    await cached(URL_SOLAR);
    time += DEFAULT_TTL_MS - 1;
    await cached(URL_SOLAR);
    expect(fetcher).toHaveBeenCalledTimes(1);

    time += 2;
    await cached(URL_SOLAR);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("does not cache failures", async () => {
    const { store, data } = memoryStore();
    const fetcher = vi.fn(async (): Promise<FetchPageResponse> => ({ ok: false, error: "HTTP 500" }));
    const cached = withCache(fetcher, store);

    expect(await cached(URL_SOLAR)).toEqual({ ok: false, error: "HTTP 500" });
    expect(Object.keys(data)).toEqual([]);

    await cached(URL_SOLAR);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("serves an expired entry if Nethys can't be reached", async () => {
    const { store } = memoryStore();
    let time = 0;
    let up = true;
    const fetcher = async (): Promise<FetchPageResponse> => (up ? ok("old page") : { ok: false, error: "offline" });
    const cached = withCache(fetcher, store, { now: () => time });

    await cached(URL_SOLAR);
    time += DEFAULT_TTL_MS + 1;
    up = false;

    expect(await cached(URL_SOLAR)).toEqual({ ok: true, html: "old page", fromCache: true });
  });

  test("a broken store never breaks an import", async () => {
    const broken: KeyValueStore = {
      get: async () => {
        throw new Error("storage gone");
      },
      set: async () => {
        throw new Error("quota");
      },
    };
    const fetcher = vi.fn(async () => ok("html"));

    expect(await withCache(fetcher, broken)(URL_SOLAR)).toEqual({ ok: true, html: "html" });
  });

  test("ignores malformed cache entries", async () => {
    const key = cacheKey(new URL(URL_SOLAR));
    const { store } = memoryStore({ [key]: { html: 42 } });
    const fetcher = vi.fn(async () => ok("fresh"));

    expect(await withCache(fetcher, store)(URL_SOLAR)).toEqual({ ok: true, html: "fresh" });
  });

  test("passes a bad link straight to the fetcher without touching storage", async () => {
    const store: KeyValueStore = { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) };
    const fetcher = vi.fn(async (): Promise<FetchPageResponse> => ({ ok: false, error: "bad link" }));

    expect(await withCache(fetcher, store)("https://example.com/")).toEqual({ ok: false, error: "bad link" });
    expect(store.get).toHaveBeenCalledTimes(0);
  });
});

const pageKeys = (data: Record<string, unknown>) => Object.keys(data).filter((k) => k.startsWith("page:"));
const urlFor = (n: number) => `https://aonprd.com/MonsterDisplay.aspx?ItemName=Monster${n}`;

describe("withCache: what gets stored", () => {
  test("a page that fails the cacheable check is returned but not stored", async () => {
    const { store, data } = memoryStore();
    const fetcher = vi.fn(async () => ok("<html>Nethys error page</html>"));
    const cached = withCache(fetcher, store, { isCacheable: looksLikeNethysPage });

    expect(await cached(URL_SOLAR)).toEqual({ ok: true, html: "<html>Nethys error page</html>" });
    expect(Object.keys(data)).toEqual([]);

    await cached(URL_SOLAR);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("a real content page is stored", async () => {
    const { store, data } = memoryStore();
    const html = '<span id="MainContent_DataListFeats_Label1_0">stat block</span>';
    await withCache(async () => ok(html), store, { isCacheable: looksLikeNethysPage })(URL_SOLAR);

    expect(pageKeys(data)).toHaveLength(1);
  });

  test("looksLikeNethysPage recognises the content marker only", () => {
    expect(looksLikeNethysPage('<span id="MainContent_DataListTypes">')).toBe(true);
    expect(looksLikeNethysPage("<html>Server error</html>")).toBe(false);
  });
});

describe("withCache: size limits", () => {
  test("evicts the oldest pages once there are too many", async () => {
    const { store, data } = memoryStore();
    let time = 0;
    const cached = withCache(async (u) => ok(u), store, { now: () => ++time });

    for (let n = 0; n < MAX_ENTRIES + 5; n++) await cached(urlFor(n));

    expect(pageKeys(data)).toHaveLength(MAX_ENTRIES);
    expect(pageKeys(data)).not.toContain(cacheKey(new URL(urlFor(0))));
    expect(pageKeys(data)).toContain(cacheKey(new URL(urlFor(MAX_ENTRIES + 4))));
  });

  test("evicts the oldest pages once they take too much space", async () => {
    const { store, data } = memoryStore();
    let time = 0;
    const big = "x".repeat(Math.floor(MAX_BYTES / 3));
    const cached = withCache(async () => ok(big), store, { now: () => ++time });

    for (let n = 0; n < 5; n++) await cached(urlFor(n));

    expect(pageKeys(data)).toHaveLength(3);
    expect(pageKeys(data)).toContain(cacheKey(new URL(urlFor(4))));
  });

  test("never evicts the page it has just stored", async () => {
    const { store, data } = memoryStore();
    const huge = "x".repeat(MAX_BYTES + 1);

    await withCache(async () => ok(huge), store)(URL_SOLAR);

    expect(pageKeys(data)).toEqual([cacheKey(new URL(URL_SOLAR))]);
  });

  test("a store with no remove method still caches", async () => {
    const data: Record<string, unknown> = {};
    const store: KeyValueStore = {
      get: async (key) => (key in data ? { [key]: data[key] } : {}),
      set: async (items) => void Object.assign(data, items),
    };
    const fetcher = vi.fn(async () => ok("html"));
    const cached = withCache(fetcher, store);

    await cached(URL_SOLAR);
    await cached(URL_SOLAR);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("a damaged index is rebuilt instead of breaking caching", async () => {
    const { store, data } = memoryStore({ "cache-index": "garbage" });

    await withCache(async () => ok("html"), store)(URL_SOLAR);

    expect(pageKeys(data)).toHaveLength(1);
  });
});

describe("clearCache", () => {
  test("removes every cached page and reports how many", async () => {
    const { store, data } = memoryStore();
    const cached = withCache(async (u) => ok(u), store);
    await cached(URL_SOLAR);
    await cached(URL_SOLAR.replace("Solar", "Marid"));

    expect(await clearCache(store)).toBe(2);
    expect(Object.keys(data)).toEqual([]);
  });

  test("clearing an empty cache removes nothing", async () => {
    const { store } = memoryStore();

    expect(await clearCache(store)).toBe(0);
  });

  test("a store that can't remove says so", async () => {
    const store: KeyValueStore = { get: async () => ({}), set: async () => {} };

    await expect(clearCache(store)).rejects.toThrow(/can't remove/);
  });
});
