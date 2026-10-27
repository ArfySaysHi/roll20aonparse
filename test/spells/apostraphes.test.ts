import { describe, test, expect } from "vitest";
import { findSpell, nethysSpellName, spellPageUrl } from "../../src/spells/lookup";
import { resolveSpells, spellKey } from "../../src/spells/resolve";
import { docFromHtml, loadSpellPage } from "../helpers";
import { readFileSync } from "node:fs";

describe("curly apostrophes in spell names", () => {
  test.each([
    ["bull\u2019s strength", "bull's strength"],
    ["heroes\u2019 feast", "heroes' feast"],
    ["bear\u2019s endurance", "bear's endurance"],
    ["eagle\u2018s splendor", "eagle's splendor"],
    ["mass bull\u2019s strength", "bull's strength, mass"],
  ])("nethysSpellName(%j)", (input, expected) => {
    expect(nethysSpellName(input)).toBe(expected);
  });

  test("the url writes the apostrophe the way Nethys does", () => {
    expect(spellPageUrl("bull\u2019s strength")).toBe(
      "https://aonprd.com/SpellDisplay.aspx?ItemName=bull%27s%20strength",
    );
  });

  test("curly and straight spellings are the same spell", () => {
    expect(spellKey("bull\u2019s strength")).toBe(spellKey("bull's strength"));
  });

  test("finds the exact spell on the Bull's Strength page, not the mass version", () => {
    const spells = loadSpellPage("spell-bulls-strength");

    expect(spells.map((s) => s.name)).toEqual(["Bull's Strength", "Bull's Strength, Mass"]);
    expect(findSpell(spells, "bull\u2019s strength")?.name).toBe("Bull's Strength");
    expect(findSpell(spells, "mass bull\u2019s strength")?.name).toBe("Bull's Strength, Mass");
  });

  test("resolves end to end from a statblock's curly spelling", async () => {
    const html = readFileSync("./fixtures/spell-bulls-strength.html", "utf8");
    const requested: string[] = [];

    const resolved = await resolveSpells(["bull\u2019s strength"], {
      fetchPage: async (url) => {
        requested.push(url);
        return { ok: true, html };
      },
      parseHtml: docFromHtml,
    });

    expect(requested).toEqual([
      "https://aonprd.com/SpellDisplay.aspx?ItemName=bull%27s%20strength",
    ]);
    expect(resolved.get("bull\u2019s strength")?.name).toBe("Bull's Strength");
    expect(resolved.missed).toEqual([]);
  });
});
