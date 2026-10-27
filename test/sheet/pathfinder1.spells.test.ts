import { describe, test, expect } from "vitest";
import type { Spell } from "../../src/parser/spell";
import { parseSpellBlock } from "../../src/parser/values/fields/offense";
import { toSheet } from "../../src/sheet/pathfinder1";
import type { SheetImport } from "../../src/sheet/types";
import { spellKey, type ResolvedSpells } from "../../src/spells/resolve";
import { loadFixture } from "../helpers";

const counter = () => {
  let n = 0;
  return () => `-id${++n}`;
};
const current = (sheet: SheetImport) =>
  Object.fromEntries(sheet.attributes.map((a) => [a.name, a.current]));

describe("toSheet: spell rows", () => {
  const sheet = toSheet(loadFixture("solar"), { newRowId: counter() });
  const attrs = current(sheet);

  test("registers each spell section's rows in its row order", () => {
    expect(sheet.rowOrders["spell-like"]).toHaveLength(34);
    expect(sheet.rowOrders["spell-9"]).toHaveLength(4);
    expect(sheet.rowOrders["spell-0"]).toHaveLength(4);
  });

  test("turns on every spell level that has spells", () => {
    for (let level = 0; level <= 9; level++)
      expect(attrs[`caster_spells_flag_level_${level}`]).toBe("1");
  });

  test("writes a row's fields under the right repeating section, including the macro", () => {
    const [id] = sheet.rowOrders["spell-like"]!;

    expect(attrs[`repeating_spell-like_${id}_spellname`]).toBe("Detect Evil");
    expect(attrs[`repeating_spell-like_${id}_timesperday`]).toBe("constant");
    expect(attrs[`repeating_spell-like_${id}_rollcontent`]).toMatch(
      /^@\{whispertype\} &\{template:npc\}/,
    );
    expect(attrs[`repeating_spell-like_${id}_spelldisplay`]).toContain("Detect Evil");
  });

  test("still writes the casting blocks' notes and caster levels", () => {
    expect(attrs).toMatchObject({
      spellabilities_flag: "1",
      caster2_level: "20",
      spells_flag: "1",
      caster1_level: "20",
    });
  });

  test("every repeating row, spell rows included, is registered in a row order", () => {
    const registered = new Set(Object.values(sheet.rowOrders).flat());
    const used = new Set(
      sheet.attributes.flatMap((a) => a.name.match(/^repeating_[\w-]+?_(-id\d+)_/)?.[1] ?? []),
    );

    expect(used).toEqual(registered);
  });

  test("is still plain JSON data", () => {
    expect(JSON.parse(JSON.stringify(sheet))).toEqual(sheet);
  });

  test("produces no warnings for the real stat block", () => {
    expect(sheet.warnings).toEqual([]);
  });
});

describe("toSheet: spell details option", () => {
  const heal: Spell = {
    name: "Heal",
    source: null,
    school: "conjuration",
    subschools: ["healing"],
    descriptors: [],
    levels: [{ class: "cleric", level: 6 }],
    castingTime: "1 standard action",
    components: "V, S",
    range: "touch",
    area: null,
    target: "creature touched",
    effect: null,
    duration: "instantaneous",
    savingThrow: "Will negates (harmless)",
    spellResistance: "yes (harmless)",
    description: "It deals 1d6 points of damage per caster level (maximum 10d6) to undead.",
  };
  const resolver: ResolvedSpells = {
    get: (n) => (spellKey(n) === "heal" ? heal : null),
    missed: [],
  };

  const solar = loadFixture("solar");
  const without = toSheet(solar, { newRowId: counter() });
  const withDetails = toSheet(solar, { newRowId: counter(), spells: resolver });

  test("adds attributes for spells Nethys had, and leaves the others alone", () => {
    expect(withDetails.attributes.length).toBeGreaterThan(without.attributes.length);
    expect(withDetails.rowOrders["spell-like"]).toHaveLength(
      without.rowOrders["spell-like"]!.length,
    );
  });

  test("the resolved spell's details land on its row", () => {
    const attrs = current(withDetails);
    const id = withDetails.rowOrders["spell-like"]!.find(
      (rowId) => attrs[`repeating_spell-like_${rowId}_spellname`] === "Heal",
    )!;

    expect(attrs).toMatchObject({
      [`repeating_spell-like_${id}_spellschool`]: "conjuration (healing)",
      [`repeating_spell-like_${id}_spellrange`]: "touch",
      [`repeating_spell-like_${id}_spelldmg`]: "[[{(1*@{caster2_level}),10}kl1]]d6",
    });
  });

  test("without the option the same row has no school or damage", () => {
    const attrs = current(without);
    const id = without.rowOrders["spell-like"]!.find(
      (rowId) => attrs[`repeating_spell-like_${rowId}_spellname`] === "Heal",
    )!;

    expect(attrs[`repeating_spell-like_${id}_spellschool`]).toBeUndefined();
    expect(attrs[`repeating_spell-like_${id}_spelldmg`]).toBeUndefined();
  });

  test("passing null is the same as passing nothing", () => {
    expect(toSheet(solar, { newRowId: counter(), spells: null })).toEqual(without);
  });
});

describe("toSheet: spell warnings", () => {
  test("warnings about spells are added to the npc's own", () => {
    const marid = loadFixture("marid");
    const npc = {
      ...marid,
      warnings: ["Could not read AC"],
      spellLikeAbilities: parseSpellBlock("(CL 5th)\nsometimes\u2014heal"),
    };

    expect(toSheet(npc).warnings).toEqual([
      "Could not read AC",
      'Unrecognised spell-like frequency "sometimes"; imported as at-will',
    ]);
  });
});
