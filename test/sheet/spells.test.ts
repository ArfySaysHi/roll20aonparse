import { describe, test, expect } from "vitest";
import type { Npc } from "../../src/parser/npc";
import type { Spell } from "../../src/parser/spell";
import { parseSpellBlock } from "../../src/parser/values/fields/offense";
import {
  parseFrequency,
  parseSlotsPerDay,
  parseSpellLevelHeading,
  spellRows,
  titleCase,
} from "../../src/sheet/spells";
import { findSpell } from "../../src/spells/lookup";
import { spellKey, type ResolvedSpells } from "../../src/spells/resolve";
import { loadFixture, loadSpellPage } from "../helpers";

describe("parseFrequency", () => {
  test.each([
    ["Constant", { timesperday: "constant" }],
    ["At Will", { timesperday: "at-will" }],
    ["at will", { timesperday: "at-will" }],
    ["at-will", { timesperday: "at-will" }],
    ["3/day", { timesperday: "per-day", count: 3 }],
    ["1/year", { timesperday: "per-year", count: 1 }],
    ["2 / week", { timesperday: "per-week", count: 2 }],
    ["1/month", { timesperday: "per-month", count: 1 }],
    ["5/hour", { timesperday: "per-hour", count: 5 }],
    ["every 4 hours", { timesperday: "every-hours", count: 4 }],
  ])("parseFrequency(%j)", (input, expected) => {
    expect(parseFrequency(input)).toEqual(expected);
  });

  test.each([["sometimes"], [""], ["3/fortnight"], ["9th"]])("rejects %j", (input) => {
    expect(parseFrequency(input)).toBeNull();
  });
});

describe("parseSpellLevelHeading", () => {
  test.each([
    ["9th", 9],
    ["1st", 1],
    ["2nd", 2],
    ["3rd", 3],
    ["0 (at will)", 0],
    ["0", 0],
  ])("parseSpellLevelHeading(%j)", (input, expected) => {
    expect(parseSpellLevelHeading(input)).toBe(expected);
  });

  test.each([["At Will"], ["Constant"], [""]])("rejects %j", (input) => {
    expect(parseSpellLevelHeading(input)).toBeNull();
  });
});

describe("titleCase", () => {
  test.each([
    ["mass charm monster", "Mass Charm Monster"],
    ["protection from evil", "Protection from Evil"],
    ["summon monster vii", "Summon Monster VII"],
    ["summon monster VII", "Summon Monster VII"],
    ["  detect   evil ", "Detect Evil"],
    ["the sword of light", "The Sword of Light"],
  ])("titleCase(%j)", (input, expected) => {
    expect(titleCase(input)).toBe(expected);
  });
});

// a resolver backed by the fixture pages
function resolverFrom(...pages: Spell[][]): ResolvedSpells {
  const all = pages.flat();
  return {
    get: (name) => findSpell(all, name),
    missed: [],
  };
}

const withBlocks = (sla: string | null, prepared: string | null): Npc => ({
  ...loadFixture("marid"),
  spellLikeAbilities: sla ? parseSpellBlock(sla) : null,
  spells: prepared ? parseSpellBlock(prepared) : null,
});

describe("spellRows: from the stat block alone", () => {
  const plan = spellRows(loadFixture("solar"), null);
  const rowsIn = (section: string) => plan.rows.filter((r) => r.section === section);

  test("one spell-like row per ability, and one row per prepared spell in its level's section", () => {
    expect(rowsIn("spell-like")).toHaveLength(34);
    expect(rowsIn("spell-9")).toHaveLength(4);
    expect(rowsIn("spell-0")).toHaveLength(4);
  });

  test("flags every level that has spells", () => {
    const visible = Object.keys(plan.flags).filter((k) =>
      k.startsWith("caster_spells_flag_level_"),
    );

    expect(visible).toHaveLength(10);
    expect(plan.flags.caster_spells_flag_level_9).toBe("1");
    expect(plan.flags.caster_spells_flag_level_0).toBe("1");
  });

  test("gives levels 1-9 per-day and total counts (the sheet hides a level without them), not cantrips", () => {
    expect(plan.flags.caster1_spells_perday_level_9).toBe(4);
    expect(plan.flags.caster1_spells_total_level_9).toBe(4);
    for (let level = 1; level <= 9; level++) {
      expect(plan.flags[`caster1_spells_total_level_${level}`]).toBeGreaterThan(0);
    }
    expect(plan.flags.caster1_spells_total_level_0).toBeUndefined();
  });

  test("a spell-like row has its name, frequency and the derived macro", () => {
    const detectEvil = rowsIn("spell-like")[0]!.fields;

    expect(detectEvil).toMatchObject({
      spellname: "Detect Evil",
      "options-flag": 0,
      timesperday: "constant",
      spellprepared: 0,
      spelldc: 0,
    });
    expect(String(detectEvil.spelldisplay)).toContain("Detect Evil");
    expect(String(detectEvil.rollcontent)).toMatch(
      /^@\{whispertype\} &\{template:npc\}\{\{name=Detect Evil\}\}/,
    );
    expect(String(detectEvil.rollcontent)).toContain("{{level=20}}");
  });

  test("a per-day ability records how many uses it has", () => {
    const heal = rowsIn("spell-like").find((r) => r.fields.spellname === "Heal")!.fields;

    expect(heal).toMatchObject({
      timesperday: "per-day",
      perday_max: 3,
      perday_qty: 3,
      spellprepared: 1,
    });
  });

  test("a statblock DC becomes the row's DC and enables its save", () => {
    const discern = rowsIn("spell-like").find((r) => r.fields.spellname === "Discern Lies")!.fields;

    expect(discern).toMatchObject({ spelldc_mod: 21, spelldc: 21, spellsaveflag: "{{save=1}}" });
    expect(String(discern.rollcontent)).toContain("{{save=1}} {{savedc=[[21]]}}");
  });

  test("names the statblock wrote in lowercase are title-cased", () => {
    const names = rowsIn("spell-like").map((r) => r.fields.spellname);

    expect(names).toContain("Mass Charm Monster");
    expect(names).toContain("Summon Monster VII");
  });

  test("prepared spells belong to caster block 1 and show level in their macro", () => {
    const ninth = rowsIn("spell-9")[0]!.fields;

    expect(ninth.spellcaster).toBe("1");
    expect(String(ninth.rollcontent)).toContain("{{level=9}}");
    expect(ninth.spelldisplay).toBe(ninth.spellname);
  });

  test("reads everything without complaint", () => {
    expect(plan.warnings).toEqual([]);
  });

  test("a creature with no casting gets no rows", () => {
    expect(spellRows(withBlocks(null, null), null)).toEqual({ rows: [], flags: {}, warnings: [] });
  });
});

describe("spellRows: with Nethys details", () => {
  const spells = resolverFrom(
    loadSpellPage("spell-fireball"),
    loadSpellPage("spell-cure-light-wounds-mass"),
  );

  test("a spell-like row gets school, range, area, save and spell resistance", () => {
    const plan = spellRows(withBlocks("(CL 12th)\n3/day\u2014fireball (DC 17)", null), spells);
    const fireball = plan.rows[0]!.fields;

    expect(fireball).toMatchObject({
      spellname: "Fireball",
      spellschool: "evocation [fire]",
      spellclasslevel: "arcanist 3, bloodrager 3, magus 3, occultist 3, sorcerer 3, wizard 3",
      spellcastingtime: "1 standard action",
      spellrange: "long (400 ft. + 40 ft./level)",
      spellarea: "20-ft.-radius spread",
      spellduration: "instantaneous",
      spellsave: "Reflex half",
      spellsaveflag: "{{save=1}}",
      spellresistance: "yes",
      spellresistanceflag: "{{sr=1}}",
      spelldc_mod: 17,
    });
  });

  test("level-scaled damage uses the spell-like caster block (2), not block 1", () => {
    const fireball = spellRows(withBlocks("(CL 12th)\n3/day\u2014fireball", null), spells).rows[0]!
      .fields;

    expect(fireball).toMatchObject({
      spelldmg: "[[{(1*@{caster2_level}),10}kl1]]d6",
      spelldmgflag: "{{damage=1}} {{dmg1flag=1}}",
      spelldmgtype: "fire",
    });
    expect(String(fireball.rollcontent)).toContain("{{dmg1=[[[[{(1*@{caster2_level}),10}kl1]]d6 +");
  });

  test("Fireball is not an attack spell, despite the arrow-slit paragraph", () => {
    const fireball = spellRows(withBlocks("(CL 12th)\n3/day\u2014fireball", null), spells).rows[0]!
      .fields;

    expect(fireball.spellatkflag).toBeUndefined();
  });

  test("the description is kept, with the damage rolled inline", () => {
    const fireball = spellRows(withBlocks("(CL 12th)\n3/day\u2014fireball", null), spells).rows[0]!
      .fields;

    expect(fireball.spelldescflag).toBe("{{descflag=[[1]]}}");
    expect(String(fireball.spelldesc)).toContain(
      "1d6 points of fire damage per caster level (maximum 10d6) ([[[[{(1*@{caster2_level}),10}kl1]]d6]])",
    );
  });

  test("a prepared spell uses caster block 1 and takes the Nethys title", () => {
    const plan = spellRows(withBlocks(null, "(CL 9th)\n5th\u2014mass cure light wounds"), spells);
    const row = plan.rows[0]!;

    expect(row.section).toBe("spell-5");
    expect(row.fields).toMatchObject({
      spellname: "Cure Light Wounds, Mass",
      spellcaster: "1",
      spelldmg: "1d8+{(1*@{caster1_level}),25}kl1",
      spellsave: "Will half (harmless) or Will half; see text",
    });
    expect(String(row.fields.rollcontent)).toContain("{{level=5}}");
  });

  test("spells Nethys didn't have still get a plain row", () => {
    const plan = spellRows(withBlocks("(CL 12th)\nAt will\u2014wibble", null), spells);

    expect(plan.rows[0]!.fields.spellname).toBe("Wibble");
    expect(plan.rows[0]!.fields.spellschool).toBeUndefined();
  });

  test("a resolver that finds nothing behaves like no resolver", () => {
    const block = "(CL 12th)\nAt will\u2014detect evil\n3/day\u2014heal";
    const none: ResolvedSpells = { get: () => null, missed: ["detect evil", "heal"] };

    expect(spellRows(withBlocks(block, null), none)).toEqual(
      spellRows(withBlocks(block, null), null),
    );
  });
});

describe("spellRows: details that can't be used", () => {
  const spell = (over: Partial<Spell>): Spell => ({
    name: "Test",
    source: null,
    school: "evocation",
    subschools: [],
    descriptors: [],
    levels: [],
    castingTime: null,
    components: null,
    range: null,
    area: null,
    target: null,
    effect: null,
    duration: null,
    savingThrow: null,
    spellResistance: null,
    description: null,
    ...over,
  });
  const resolver = (s: Spell): ResolvedSpells => ({
    get: (n) => (spellKey(n) === "test" ? s : null),
    missed: [],
  });
  const plan = (s: Spell) =>
    spellRows(withBlocks("(CL 5th)\nAt will\u2014test", null), resolver(s));

  test("level scaling the sheet can't convert leaves damage blank and warns", () => {
    const result = plan(
      spell({ description: "It deals 1d6 points of fire damage per caster level." }),
    );

    expect(result.rows[0]!.fields.spelldmg).toBeUndefined();
    expect(result.rows[0]!.fields.spelldmgflag).toBeUndefined();
    expect(result.warnings).toEqual([
      'Could not convert the damage for Test ("1d6 points of fire damage per caster level"); left blank',
    ]);
  });

  test("fixed damage is written as plain dice", () => {
    const result = plan(spell({ description: "It deals 3d6 points of fire damage." }));

    expect(result.rows[0]!.fields).toMatchObject({ spelldmg: "3d6", spelldmgtype: "fire" });
    expect(result.warnings).toEqual([]);
  });

  test('"Saving Throw none" and "Spell Resistance no" switch their flags off', () => {
    const fields = plan(spell({ savingThrow: "none", spellResistance: "no" })).rows[0]!.fields;

    expect(fields).toMatchObject({ spellsaveflag: "0", spellresistanceflag: "0" });
  });

  test("a touch attack in the first paragraph becomes an attack roll", () => {
    const fields = plan(
      spell({
        description:
          "You must succeed on a ranged touch attack. It deals 1d6 points of cold damage.",
      }),
    ).rows[0]!.fields;

    expect(fields).toMatchObject({ spellatkflag: "{{attack=1}}", spellatktype: "ranged" });
    expect(String(fields.rollcontent)).toContain("{{roll=[[1d20cs>20+@{ranged_mod}[]");
  });
});

describe("spellRows: unexpected statblock text", () => {
  test("an unknown spell-like frequency is imported as at-will, with a warning", () => {
    const plan = spellRows(withBlocks("(CL 5th)\nsometimes\u2014heal", null), null);

    expect(plan.rows[0]!.fields.timesperday).toBe("at-will");
    expect(plan.warnings).toEqual([
      'Unrecognised spell-like frequency "sometimes"; imported as at-will',
    ]);
  });

  test("a prepared-spell group with no level is skipped, with a warning", () => {
    const plan = spellRows(withBlocks(null, "(CL 5th)\nmorning\u2014heal"), null);

    expect(plan.rows).toEqual([]);
    expect(plan.warnings).toEqual([
      'Could not read spell level "morning"; its spells were skipped',
    ]);
  });

  test("an entry's note is kept", () => {
    const plan = spellRows(
      withBlocks("(CL 5th)\n1/year\u2014grant 1 wish (to nongenies only)", null),
      null,
    );

    expect(plan.rows[0]!.fields).toMatchObject({
      notes: "to nongenies only",
      timesperday: "per-year",
      perday_max: 1,
    });
  });
});

describe("parseSlotsPerDay", () => {
  test.each([
    ["1st (4/day)", 4],
    ["3rd (2 / day)", 2],
    ["9th (1/DAY)", 1],
    ["1st", null],
    ["0 (at will)", null],
  ])("parseSlotsPerDay(%j)", (input, expected) => {
    expect(parseSlotsPerDay(input)).toBe(expected);
  });
});

describe("spellRows: spontaneous casters", () => {
  const npc = (): Npc => {
    const base = loadFixture("lich");
    return {
      ...base,
      spellLikeAbilities: null,
      spells: parseSpellBlock(
        "(CL 7th; concentration +10)\n" +
          "3rd (3/day)\u2014fireball, haste, lightning bolt, slow, vampiric touch\n" +
          "2nd (5/day)\u2014invisibility, mirror image, scorching ray",
      ),
    };
  };

  test("uses the slots per day, not the number of spells known", () => {
    const { flags } = spellRows(npc(), null);

    expect(flags.caster1_spells_perday_level_3).toBe(3);
    expect(flags.caster1_spells_total_level_3).toBe(3);
    expect(flags.caster1_spells_perday_level_2).toBe(5);
  });

  test("every known spell still gets its row and the level's flag", () => {
    const { rows, flags } = spellRows(npc(), null);

    expect(rows.filter((r) => r.section === "spell-3")).toHaveLength(5);
    expect(flags.caster_spells_flag_level_3).toBe("1");
  });
});

describe("spellRows: default save DCs", () => {
  const scores = { Str: 10, Dex: 10, Con: 10, Int: 10, Wis: 20, Cha: 10 }; // Wis +5
  const BLOCK =
    "(CL 9th; concentration +14)\n3rd\u2014dispel magic, bestow curse\n0 (at will)\u2014light";

  const caster = (text = BLOCK, extra: Record<string, unknown> = {}) =>
    ({
      abilityScores: scores,
      classLine: "Human cleric 9",
      spellLikeAbilities: null,
      spells: parseSpellBlock(text),
      ...extra,
    }) as unknown as Npc;

  const dcs = (plan: ReturnType<typeof spellRows>) =>
    Object.fromEntries(plan.rows.map((row) => [row.fields.spellname, row.fields.spelldc_mod]));

  test("spells with no printed DC get 10 + spell level + the casting stat's modifier", () => {
    expect(dcs(spellRows(caster(), null))).toEqual({
      "Dispel Magic": 18,
      "Bestow Curse": 18,
      Light: 15,
    });
  });

  test("a DC printed in the stat block always wins", () => {
    const plan = spellRows(caster(BLOCK.replace("dispel magic", "dispel magic (DC 25)")), null);

    expect(dcs(plan)).toMatchObject({ "Dispel Magic": 25, "Bestow Curse": 18 });
  });

  test("a default DC doesn't flag the spell as having a save, a printed one does", () => {
    const plan = spellRows(caster(BLOCK.replace("dispel magic", "dispel magic (DC 25)")), null);
    const flag = (name: string) =>
      plan.rows.find((r) => r.fields.spellname === name)!.fields.spellsaveflag;

    expect(flag("Dispel Magic")).toBe("{{save=1}}");
    expect(flag("Bestow Curse")).toBeUndefined();
  });

  test("when Nethys says the spell has a save, its roll uses the default DC", () => {
    const bestowCurse = {
      name: "Bestow Curse",
      school: "necromancy",
      subschools: [],
      descriptors: [],
      levels: [{ class: "cleric", level: 3 }],
      castingTime: "1 standard action",
      components: "V, S",
      range: "touch",
      area: null,
      target: "creature touched",
      effect: null,
      duration: "permanent",
      savingThrow: "Will negates",
      spellResistance: "yes",
      description: "You place a curse on the subject.",
    } as unknown as Spell;
    const resolved = {
      get: (n: string) => (n === "bestow curse" ? bestowCurse : null),
      missed: [],
    };

    const row = spellRows(caster(), resolved).rows.find(
      (r) => r.fields.spellname === "Bestow Curse",
    )!;

    expect(row.fields.spellsaveflag).toBe("{{save=1}}");
    expect(String(row.fields.rollcontent)).toContain("{{savedc=[[18]]}}");
  });

  test("the person's choice of stat overrides the automatic one", () => {
    const plan = spellRows(caster(), null, { castingStat: "Int" }); // Int 10 is +0

    expect(dcs(plan)).toEqual({ "Dispel Magic": 13, "Bestow Curse": 13, Light: 10 });
    expect(plan.warnings).toEqual([]);
  });

  test("an archetype is spotted from the stat block's numbers, with a note", () => {
    const archetype = caster(BLOCK, { abilityScores: { ...scores, Wis: 14, Cha: 20 } }); // conc +14 fits Cha

    const plan = spellRows(archetype, null);

    expect(dcs(plan)).toMatchObject({ "Dispel Magic": 18 }); // 10 + 3 + 5
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toMatch(/fit Cha, not the Wis this class usually casts with/);
    expect(plan.warnings[0]).toMatch(/pick a "Casting stat" in the panel/);
  });

  test("an unidentifiable caster is guessed and flagged", () => {
    const plan = spellRows(
      caster("3rd\u2014dispel magic", { classLine: "Human aristocrat 3" }),
      null,
    );

    expect(dcs(plan)).toEqual({ "Dispel Magic": 18 }); // strongest stat, Wis +5
    expect(plan.warnings[0]).toMatch(
      /Could not tell which stat this caster uses, so Wis \(\+5\) was assumed/,
    );
  });

  test("a group whose level can't be read is skipped, and doesn't trigger a note about its spells", () => {
    const plan = spellRows(
      caster("morning\u2014dispel magic", { classLine: "Human aristocrat 3" }),
      null,
    );

    expect(plan.rows).toEqual([]);
    expect(plan.warnings).toEqual([
      'Could not read spell level "morning"; its spells were skipped',
    ]);
  });

  test("an unreadable group doesn't hide a readable one that needs a default", () => {
    const plan = spellRows(
      caster("morning\u2014dispel magic\n2nd\u2014hold person", {
        classLine: "Human aristocrat 3",
      }),
      null,
    );

    expect(dcs(plan)).toEqual({ "Hold Person": 17 }); // 10 + 2 + Wis +5
    expect(plan.warnings).toHaveLength(2);
  });

  test("a consistent caster adds no warning", () => {
    expect(spellRows(caster(), null).warnings).toEqual([]);
  });

  test("when every spell has its own DC nothing is defaulted and nothing is said", () => {
    const plan = spellRows(
      caster("3rd\u2014dispel magic (DC 20)", { classLine: "Human aristocrat 3" }),
      null,
    );

    expect(dcs(plan)).toEqual({ "Dispel Magic": 20 });
    expect(plan.warnings).toEqual([]);
  });

  test("spell-like abilities keep only the DC the stat block prints", () => {
    const npc = caster("", {
      spells: null,
      spellLikeAbilities: parseSpellBlock(
        "(CL 9th)\nAt will\u2014detect evil\n3/day\u2014bestow curse (DC 19)",
      ),
    });

    expect(dcs(spellRows(npc, null))).toEqual({ "Detect Evil": undefined, "Bestow Curse": 19 });
  });
});
