import { describe, test, expect } from "vitest";
import { parseSpellPage } from "../../src/parser/spell";
import { docFromHtml, loadSpellPage } from "../helpers";

describe("parseSpellPage: Cure Light Wounds, Mass", () => {
  const spells = loadSpellPage("spell-cure-light-wounds-mass");

  test("finds the single spell", () => {
    expect(spells.map((s) => s.name)).toEqual(["Cure Light Wounds, Mass"]);
  });

  test("reads the header", () => {
    expect(spells[0]).toMatchObject({
      source: { name: "PRPG Core Rulebook", page: "263" },
      school: "conjuration",
      subschools: ["healing"],
      descriptors: [],
    });
    expect(spells[0]!.levels).toHaveLength(11);
    expect(spells[0]!.levels[0]).toEqual({ class: "bard", level: 5 });
    expect(spells[0]!.levels.at(-1)).toEqual({ class: "witch", level: 6 });
  });

  test("reads casting and effect fields", () => {
    expect(spells[0]).toMatchObject({
      castingTime: "1 standard action",
      components: "V, S",
      range: "close (25 ft. + 5 ft./2 levels)",
      target: "one creature/level, no two of which can be more than 30 ft. apart",
      area: null,
      effect: null,
      duration: "instantaneous",
      savingThrow: "Will half (harmless) or Will half; see text",
      spellResistance: "yes (harmless) or yes; see text",
    });
  });

  test("reads the description", () => {
    expect(spells[0]!.description?.startsWith("You channel positive energy")).toBe(true);
    expect(spells[0]!.description?.endsWith("Will save for half damage.")).toBe(true);
  });
});

describe("parseSpellPage: Fireball (a family, with a mythic variant)", () => {
  const spells = loadSpellPage("spell-fireball");
  const [fireball, controlled] = spells;

  test("finds both spells and skips the empty result span", () => {
    expect(spells.map((s) => s.name)).toEqual(["Fireball", "Controlled Fireball"]);
  });

  test("reads descriptors from square brackets", () => {
    expect(fireball).toMatchObject({ school: "evocation", subschools: [], descriptors: ["fire"] });
    expect(controlled!.descriptors).toEqual(["fire", "ruse"]);
  });

  test("uses Area, not Target, for an area spell", () => {
    expect(fireball).toMatchObject({
      area: "20-ft.-radius spread",
      target: null,
      savingThrow: "Reflex half",
      spellResistance: "yes",
    });
  });

  test("keeps parentheses in components", () => {
    expect(fireball!.components).toBe("V, S, M (a ball of bat guano and sulfur)");
  });

  test("reads the wizard level", () => {
    expect(fireball!.levels).toContainEqual({ class: "wizard", level: 3 });
    expect(controlled!.levels).toContainEqual({ class: "wizard", level: 4 });
  });

  test("stops the description before the mythic variant", () => {
    expect(fireball!.description).toContain("just as any other spell effect does.");
    expect(fireball!.description).not.toContain("Mythic");
    expect(fireball!.description).not.toContain("Augmented");
    expect(fireball!.description).not.toContain("1d10");
  });

  test("keeps paragraph breaks in the description", () => {
    expect(fireball!.description?.split("\n\n")).toHaveLength(3);
  });

  test("a spell after the mythic variant is still found, with its own fields", () => {
    expect(controlled).toMatchObject({
      source: { name: "Ultimate Intrigue", page: "208" },
      area: "20-foot-radius spread",
    });
    expect(controlled!.description?.startsWith("This spell functions as fireball")).toBe(true);
  });
});

describe("parseSpellPage: Spell Immunity (four spells on one page)", () => {
  const spells = loadSpellPage("spell-immunity-greater");

  test("finds every spell on the page, in order", () => {
    expect(spells.map((s) => s.name)).toEqual([
      "Spell Immunity",
      "Spell Immunity, Communal",
      "Spell Immunity, Greater",
      "Spell Immunity, Greater Communal",
    ]);
  });

  test("each spell has its own level list", () => {
    const greater = spells[2]!;

    expect(greater.levels).toEqual([
      { class: "cleric", level: 8 },
      { class: "oracle", level: 8 },
      { class: "psychic", level: 8 },
    ]);
    expect(spells[0]!.levels).toHaveLength(9);
  });

  test("Target and Targets both land in `target`", () => {
    expect(spells[0]!.target).toBe("creature touched");
    expect(spells[1]!.target).toBe("creatures touched");
  });

  test("a doubled space after a label is trimmed", () => {
    expect(spells[1]!.spellResistance).toBe("yes (harmless)");
  });

  test("descriptions don't bleed into the next spell", () => {
    expect(spells[2]!.description).toBe(
      "This spell functions like spell immunity, except the immunity applies to spells of 8th level or lower. " +
        "A creature can have only one spell immunity or greater spell immunity spell in effect on it at a time.",
    );
  });
});

describe("parseSpellPage: edge cases", () => {
  test("a page with no result table gives no spells", () => {
    expect(parseSpellPage(docFromHtml("<html><body><p>not found</p></body></html>"))).toEqual([]);
  });

  test("a results table with only empty spans gives no spells", () => {
    const doc = docFromHtml(
      '<table id="MainContent_DataListTypes"><tbody><tr><td><span id="MainContent_DataListTypes_LabelName_0"></span></td></tr></tbody></table>',
    );

    expect(parseSpellPage(doc)).toEqual([]);
  });

  test("a spell with missing fields still parses", () => {
    const doc = docFromHtml(
      '<table id="MainContent_DataListTypes"><tbody><tr><td><span id="MainContent_DataListTypes_LabelName_0">' +
        '<h1 class="title">Mystery</h1><b>School</b> <u>illusion</u>;</span></td></tr></tbody></table>',
    );

    expect(parseSpellPage(doc)).toEqual([
      expect.objectContaining({
        name: "Mystery",
        school: "illusion",
        levels: [],
        castingTime: null,
        description: null,
        source: null,
      }),
    ]);
  });
});
