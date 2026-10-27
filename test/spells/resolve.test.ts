import { readFileSync } from "node:fs";
import { describe, test, expect, vi } from "vitest";
import { parseSpellBlock } from "../../src/parser/values/fields/offense";
import {
  resolveSpells,
  spellKey,
  spellNames,
  type SpellResolverDeps,
} from "../../src/spells/resolve";
import { spellPageUrl } from "../../src/spells/lookup";
import type { FetchPageResponse } from "../../src/shared/protocol";
import { docFromHtml } from "../helpers";

const fixture = (name: string) => readFileSync(`./fixtures/${name}.html`, "utf8");

// url -> html for the pages we have
const PAGES: Record<string, string> = {
  [spellPageUrl("fireball")]: fixture("spell-fireball"),
  [spellPageUrl("mass cure light wounds")]: fixture("spell-cure-light-wounds-mass"),
  [spellPageUrl("greater spell immunity")]: fixture("spell-immunity-greater"),
};

function deps(overrides: Partial<SpellResolverDeps> = {}) {
  const requested: string[] = [];
  const d: SpellResolverDeps = {
    fetchPage: vi.fn(async (url: string): Promise<FetchPageResponse> => {
      requested.push(url);
      const html = PAGES[url];
      return html ? { ok: true, html } : { ok: false, error: "HTTP 404" };
    }),
    parseHtml: docFromHtml,
    ...overrides,
  };
  return { d, requested };
}

describe("spellKey", () => {
  test("ignores casing and statblock word order", () => {
    expect(spellKey("Fireball")).toBe(spellKey("fireball"));
    expect(spellKey("mass cure light wounds")).toBe(spellKey("Cure Light Wounds, Mass"));
  });
});

describe("spellNames", () => {
  test("collects names from every block, skipping missing blocks", () => {
    const sla = parseSpellBlock(
      "(CL 12th)\nAt will\u2014detect evil, fireball (DC 15)\n3/day\u2014heal",
    );
    const spells = parseSpellBlock("(CL 5th)\n1st\u2014shield");

    expect(spellNames(sla, null, spells)).toEqual(["detect evil", "fireball", "heal", "shield"]);
  });

  test("an empty or absent block gives nothing", () => {
    expect(spellNames(null, null)).toEqual([]);
    expect(spellNames()).toEqual([]);
  });
});

describe("resolveSpells: unreachable vs not found", () => {
  const failWith = (error: string) =>
    deps({ fetchPage: async () => ({ ok: false as const, error }) }).d;

  test("a network failure is marked unreachable", async () => {
    const resolved = await resolveSpells(["fireball"], failWith("Could not reach Nethys: offline"));

    expect(resolved.missed).toEqual(["fireball"]);
    expect(resolved.unreachable).toEqual(["fireball"]);
  });

  test("a fetch that throws is marked unreachable", async () => {
    const d = deps({
      fetchPage: async () => {
        throw new Error("message channel closed");
      },
    }).d;

    expect((await resolveSpells(["fireball"], d)).unreachable).toEqual(["fireball"]);
  });

  test("an HTTP 404 is a miss, not an unreachable Nethys", async () => {
    const resolved = await resolveSpells(["fireball"], failWith("Nethys returned HTTP 404."));

    expect(resolved.missed).toEqual(["fireball"]);
    expect(resolved.unreachable).toEqual([]);
  });

  test("a page that loads without the spell is a miss, not unreachable", async () => {
    const d = deps({ fetchPage: async () => ({ ok: true as const, html: fixture("spell-fireball") }) }).d;

    const resolved = await resolveSpells(["delayed blast fireball"], d);

    expect(resolved.missed).toEqual(["delayed blast fireball"]);
    expect(resolved.unreachable).toEqual([]);
  });
});

describe("resolveSpells", () => {
  test("fetches each page once and finds the exact spell", async () => {
    const { d, requested } = deps();

    const resolved = await resolveSpells(
      ["fireball", "mass cure light wounds", "greater spell immunity"],
      d,
    );

    expect(requested).toHaveLength(3);
    expect(resolved.get("fireball")?.name).toBe("Fireball");
    expect(resolved.get("mass cure light wounds")?.name).toBe("Cure Light Wounds, Mass");
    expect(resolved.get("greater spell immunity")?.levels[0]).toEqual({
      class: "cleric",
      level: 8,
    });
    expect(resolved.missed).toEqual([]);
  });

  test("duplicates (in any casing) are fetched once", async () => {
    const { d, requested } = deps();

    const resolved = await resolveSpells(["fireball", "Fireball", "FIREBALL"], d);

    expect(requested).toHaveLength(1);
    expect(resolved.get("FireBall")?.name).toBe("Fireball");
  });

  test("reports names it couldn't find, in statblock order", async () => {
    const { d } = deps();

    const resolved = await resolveSpells(["wish", "fireball", "grant 1 wish"], d);

    expect(resolved.missed).toEqual(["wish", "grant 1 wish"]);
    expect(resolved.get("wish")).toBeNull();
  });

  test("a page that loads but doesn't hold the spell is a miss, not a wrong spell", async () => {
    const { d } = deps({
      fetchPage: async () => ({ ok: true, html: fixture("spell-fireball") }),
    });

    const resolved = await resolveSpells(["delayed blast fireball"], d);

    expect(resolved.get("delayed blast fireball")).toBeNull();
    expect(resolved.missed).toEqual(["delayed blast fireball"]);
  });

  test("a fetch that throws only costs that spell", async () => {
    const { d } = deps({
      fetchPage: async (url) => {
        if (url.includes("fireball")) throw new Error("message channel closed");
        return { ok: true, html: fixture("spell-cure-light-wounds-mass") };
      },
    });

    const resolved = await resolveSpells(["fireball", "mass cure light wounds"], d);

    expect(resolved.missed).toEqual(["fireball"]);
    expect(resolved.get("mass cure light wounds")).not.toBeNull();
  });

  test("a parse error only costs that spell", async () => {
    const { d } = deps({
      parseHtml: () => {
        throw new Error("bad html");
      },
    });

    expect((await resolveSpells(["fireball"], d)).missed).toEqual(["fireball"]);
  });

  test("never has more than `concurrency` requests in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const { d } = deps({
      fetchPage: async () => {
        peak = Math.max(peak, ++inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return { ok: false, error: "x" };
      },
    });

    await resolveSpells(
      Array.from({ length: 10 }, (_, i) => `spell ${i}`),
      d,
      { concurrency: 3 },
    );

    expect(peak).toBe(3);
  });

  test("defaults to a small concurrency", async () => {
    let inFlight = 0;
    let peak = 0;
    const { d } = deps({
      fetchPage: async () => {
        peak = Math.max(peak, ++inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return { ok: false, error: "x" };
      },
    });

    await resolveSpells(
      Array.from({ length: 12 }, (_, i) => `spell ${i}`),
      d,
    );

    expect(peak).toBeLessThan(5);
  });

  test("reports progress once per distinct spell, ending at the total", async () => {
    const calls: [number, number][] = [];
    const { d } = deps({ onProgress: (done, total) => calls.push([done, total]) });

    await resolveSpells(["fireball", "fireball", "mass cure light wounds", "wish"], d, {
      concurrency: 1,
    });

    expect(calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  test("nothing to look up means nothing fetched", async () => {
    const { d, requested } = deps();

    const resolved = await resolveSpells([], d);

    expect(requested).toEqual([]);
    expect(resolved.missed).toEqual([]);
    expect(resolved.get("fireball")).toBeNull();
  });
});
