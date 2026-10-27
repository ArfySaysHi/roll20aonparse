import { readFileSync } from "node:fs";
import { describe, test, expect, vi } from "vitest";
import { describeOutcome, importFromUrl, type ImporterDeps } from "../../src/content/importer";
import type { SheetImport } from "../../src/sheet/types";
import { docFromHtml } from "../helpers";

const solarHtml = () => readFileSync("./fixtures/solar.html", "utf8");

function deps(overrides: Partial<ImporterDeps> = {}) {
  const sent: SheetImport[] = [];
  const d: ImporterDeps = {
    fetchPage: vi.fn(async () => ({ ok: true as const, html: solarHtml() })),
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
    ...overrides,
  };
  return { d, sent };
}

describe("importFromUrl", () => {
  test("fetches, parses, maps and sends the sheet to the page", async () => {
    const { d, sent } = deps();

    const outcome = await importFromUrl("https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar", d);

    expect(outcome).toEqual({ ok: true, name: "Solar", warnings: [] });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.name).toBe("Solar");
    expect(sent[0]!.attributes.find((a) => a.name === "npc_cr")?.current).toBe("23");
  });

  test("rejects a non-Nethys link without fetching", async () => {
    const { d } = deps();

    const outcome = await importFromUrl("https://example.com/", d);

    expect(outcome.ok).toBe(false);
    expect(d.fetchPage).toHaveBeenCalledTimes(0);
  });

  test("surfaces a fetch failure", async () => {
    const { d } = deps({
      fetchPage: async () => ({ ok: false, error: "Nethys returned HTTP 500." }),
    });

    expect(await importFromUrl("https://aonprd.com/x", d)).toEqual({
      ok: false,
      error: "Nethys returned HTTP 500.",
    });
  });

  test("explains when the page isn't a stat block, and doesn't touch Roll20", async () => {
    const { d, sent } = deps({
      fetchPage: async () => ({ ok: true, html: "<html><body>hello</body></html>" }),
    });

    const outcome = await importFromUrl("https://aonprd.com/x", d);

    expect(outcome).toEqual({
      ok: false,
      error: "That page doesn't look like a monster stat block.",
    });
    expect(sent).toHaveLength(0);
  });

  test("surfaces a failure from the Roll20 side", async () => {
    const { d } = deps({
      sendToPage: async () => ({
        channel: "nethys-roll20-importer",
        direction: "from-page",
        kind: "import-result",
        requestId: "r",
        ok: false,
        error: "Roll20 isn't ready yet",
      }),
    });

    expect(await importFromUrl("https://aonprd.com/x", d)).toEqual({
      ok: false,
      error: "Roll20 isn't ready yet",
    });
  });
});

const pageResult = (extra: object = {}) => ({
  channel: "nethys-roll20-importer" as const,
  direction: "from-page" as const,
  kind: "import-result" as const,
  requestId: "r",
  ok: true,
  ...extra,
});

describe("importFromUrl: things worth telling the person", () => {
  test("warns when Roll20 couldn't be asked to recalculate the sheet", async () => {
    const { d } = deps({ sendToPage: async () => pageResult({ notified: false }) });

    const outcome = await importFromUrl("https://aonprd.com/x", d);

    expect(outcome).toMatchObject({ ok: true });
    expect((outcome as { warnings: string[] }).warnings).toEqual([
      "The sheet was not asked to recalculate; if any values look wrong, open the character once",
    ]);
  });

  test("no such warning when the page script says it notified, or doesn't say", async () => {
    for (const extra of [{ notified: true }, {}]) {
      const { d } = deps({ sendToPage: async () => pageResult(extra) });

      expect(await importFromUrl("https://aonprd.com/x", d)).toEqual({
        ok: true,
        name: "Solar",
        warnings: [],
      });
    }
  });

  test("tells a spell Nethys couldn't be reached for apart from one it has no page for", async () => {
    const reach = (error: string) =>
      deps({
        fetchPage: async (url: string) =>
          url.includes("MonsterDisplay")
            ? { ok: true as const, html: solarHtml() }
            : { ok: false as const, error },
      });

    const offline = await importFromUrl("https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar", reach("Could not reach Nethys: offline").d, { includeSpells: true });
    const missing = await importFromUrl("https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar", reach("Nethys returned HTTP 404.").d, { includeSpells: true });

    const warningsOf = (o: typeof offline) => (o as { warnings: string[] }).warnings;

    expect(warningsOf(offline).some((w) => w.startsWith("Could not reach Nethys for spell"))).toBe(true);
    expect(warningsOf(offline).some((w) => w.startsWith("No Nethys page found"))).toBe(false);
    expect(warningsOf(missing).some((w) => w.startsWith("No Nethys page found for spell"))).toBe(true);
    expect(warningsOf(missing).some((w) => w.startsWith("Could not reach"))).toBe(false);
  });
});

describe("describeOutcome", () => {
  test("success", () => {
    expect(describeOutcome({ ok: true, name: "Solar", warnings: [] })).toBe("Imported Solar.");
  });

  test("success with warnings", () => {
    expect(describeOutcome({ ok: true, name: "Solar", warnings: ["a"] })).toBe(
      "Imported Solar, with 1 note to check (listed below).",
    );
    expect(describeOutcome({ ok: true, name: "Solar", warnings: ["a", "b"] })).toContain(
      "2 notes",
    );
  });

  test("failure", () => {
    expect(describeOutcome({ ok: false, error: "nope" })).toBe("Failed: nope");
  });
});
