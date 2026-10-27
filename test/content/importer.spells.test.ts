import { readFileSync } from "node:fs";
import { describe, test, expect, vi } from "vitest";
import { importFromUrl, type ImporterDeps } from "../../src/content/importer";
import { spellNames } from "../../src/spells/resolve";
import type { SheetImport } from "../../src/sheet/types";
import { docFromHtml, loadFixture } from "../helpers";

const MONSTER_URL = "https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar";
const solarHtml = readFileSync("./fixtures/solar.html", "utf8");

// the monster page loads; every spell page 404s, so each spell becomes a "miss"
function deps() {
  const sent: SheetImport[] = [];
  const requested: string[] = [];
  const d: ImporterDeps = {
    fetchPage: vi.fn(async (url: string) => {
      requested.push(url);
      return url === MONSTER_URL
        ? { ok: true as const, html: solarHtml }
        : { ok: false as const, error: "HTTP 404" };
    }),
    sendToPage: vi.fn(async (payload: SheetImport) => {
      sent.push(payload);
      return {
        channel: "nethys-roll20-importer" as const,
        direction: "from-page" as const,
        kind: "import-result" as const,
        requestId: "r",
        ok: true,
      };
    }),
    parseHtml: docFromHtml,
  };
  return { d, sent, requested };
}

const solar = loadFixture("solar");
const distinctSpells = new Set(
  spellNames(solar.spellLikeAbilities, solar.spells).map((n) => n.toLowerCase()),
).size;

describe("importFromUrl: spell lookup option", () => {
  test("off by default: only the monster page is requested", async () => {
    const { d, requested } = deps();

    const outcome = await importFromUrl(MONSTER_URL, d);

    expect(outcome.ok).toBe(true);
    expect(requested).toEqual([MONSTER_URL]);
  });

  test("includeSpells: false behaves the same as the default", async () => {
    const { d, requested } = deps();

    await importFromUrl(MONSTER_URL, d, { includeSpells: false });

    expect(requested).toEqual([MONSTER_URL]);
  });

  test("includeSpells: requests one page per distinct spell", async () => {
    const { d, requested } = deps();

    await importFromUrl(MONSTER_URL, d, { includeSpells: true });

    expect(distinctSpells).toBeGreaterThan(10); // the Solar really does cast a lot
    expect(requested).toHaveLength(1 + distinctSpells);
    expect(requested.slice(1).every((u) => u.includes("SpellDisplay.aspx?ItemName="))).toBe(true);
  });

  test("spells that couldn't be found are reported as warnings, and still sent to Roll20", async () => {
    const { d, sent } = deps();

    const outcome = await importFromUrl(MONSTER_URL, d, { includeSpells: true });

    expect(outcome.ok && outcome.warnings).toHaveLength(distinctSpells);
    expect(outcome.ok && outcome.warnings[0]).toMatch(/^No Nethys page found for spell "/);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.warnings).toEqual(outcome.ok ? outcome.warnings : []);
  });

  test("a failed spell lookup never fails the import", async () => {
    const { d } = deps();

    expect((await importFromUrl(MONSTER_URL, d, { includeSpells: true })).ok).toBe(true);
  });

  test("progress is reported as spells are fetched, ending at the total", async () => {
    const { d } = deps();
    const calls: [number, number][] = [];

    await importFromUrl(MONSTER_URL, d, {
      includeSpells: true,
      onProgress: (done, total) => calls.push([done, total]),
    });

    expect(calls).toHaveLength(distinctSpells);
    expect(calls.at(-1)).toEqual([distinctSpells, distinctSpells]);
  });

  test("progress is never reported when spells are off", async () => {
    const { d } = deps();
    const onProgress = vi.fn();

    await importFromUrl(MONSTER_URL, d, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(0);
  });
});
