import { describe, test, expect } from "vitest";
import type { Spell } from "../../src/parser/spell";
import { Attack, parseSpellBlock } from "../../src/parser/values/fields/offense";
import { toSheet, attackFields } from "../../src/sheet/pathfinder1";
import type { SheetImport } from "../../src/sheet/types";
import { spellKey, type ResolvedSpells } from "../../src/spells/resolve";
import { loadFixture } from "../helpers";
import { Npc } from "../../src";

const counter = () => {
  let n = 0;
  return () => `-id${++n}`;
};
const current = (sheet: SheetImport) =>
  Object.fromEntries(sheet.attributes.map((a) => [a.name, a.current]));

const attack = (overrides: Partial<Attack> = {}): Attack => ({
  quantity: 1,
  quantityRoll: null,
  name: "bite",
  attackNotes: null,
  iteratives: [10],
  kind: null,
  touch: false,
  damage: "1d6",
  critRange: null,
  critMultiplier: null,
  damageType: null,
  additionalEffects: null,
  restriction: null,
  ...overrides,
});

const emptyNpc = (overrides: Partial<Npc> = {}): Npc => ({
  name: "Thing",
  title: null,
  flavour: null,
  cr: null,
  source: null,
  xp: null,
  classLine: null,
  alignment: null,
  size: null,
  type: null,
  subtypes: null,
  init: null,
  senses: [],
  perception: null,
  aura: null,
  ac: null,
  hp: null,
  saves: { fort: null, ref: null, will: null },
  defensiveAbilities: null,
  dr: null,
  immune: null,
  resist: null,
  weaknesses: null,
  sr: null,
  speed: null,
  melee: { attacks: [], unparsed: [] },
  ranged: { attacks: [], unparsed: [] },
  space: null,
  reach: null,
  specialAttacks: [],
  spellLikeAbilities: null,
  spells: null,
  abilityScores: { Str: null, Dex: null, Con: null, Int: null, Wis: null, Cha: null },
  bab: null,
  cmb: null,
  cmd: null,
  feats: [],
  skills: null,
  languages: null,
  sq: null,
  gear: null,
  environment: null,
  organization: null,
  treasure: null,
  specialAbilities: [],
  description: null,
  warnings: [],
  ...overrides,
});

const byName = (sheet: SheetImport) => Object.fromEntries(sheet.attributes.map((a) => [a.name, a]));

describe("toSheet: solar fixture", () => {
  const sheet = toSheet(loadFixture("solar"), { newRowId: counter() });
  const attrs = current(sheet);

  test("names the character after the creature, not the page title", () => {
    expect(sheet.name).toBe("Solar");
  });

  test("marks the sheet as an NPC and fills the header", () => {
    expect(attrs).toMatchObject({
      npc: "1",
      npc_cr: "23",
      xp: "819200",
      npc_alignment: "NG",
      size: "large",
      npc_type: "outsider (angel, extraplanar, good)",
      initiative: "9",
      perception: "33",
      aura: "protective aura",
    });
    expect(attrs.senses).toBe(
      "darkvision 60 ft., low-light vision, detect evil, detect snares and pits, true seeing",
    );
  });

  test("fills defenses; hit points set both current and max in one write", () => {
    expect(attrs).toMatchObject({
      ac: "44",
      ac_touch: "11",
      ac_flatfooted: "42",
      hd: "22d10+242",
      fortitude: "25",
      reflex: "14",
      will: "23",
      saves_modifiers: "+4 vs. poison, +4 resistance vs. evil",
      sr: "34",
      npc_dr: "15/epic and evil",
      immune: "acid, cold, petrification",
      resist: "electricity 10, fire 10",
    });
    expect(byName(sheet).hp).toEqual({ name: "hp", current: "363", max: "363" });
  });

  test("fills offense text fields and casting notes", () => {
    expect(attrs).toMatchObject({
      npc_speed: "50 ft., fly 150 ft. (good); 35 ft., fly 100 ft. (good) in armor",
      space: "10 ft.",
      reach: "10 ft.",
      spellabilities_flag: "1",
      caster2_level: "20",
      spells_flag: "1",
      caster1_level: "20",
    });
    expect(attrs.npc_spellabilities_notes).toMatch(/^Constant\u2014detect evil/);
    expect(attrs.npc_spells_notes).toMatch(/^9th\u2014etherealness/);
  });

  test("writes each melee attack as its own repeating row, with iterative bonuses", () => {
    expect(sheet.rowOrders["npcatk-melee"]).toEqual(["-id1", "-id2"]);
    expect(attrs).toMatchObject({
      meleeattacks_flag: "1",
      "repeating_npcatk-melee_-id1_atkname": "+5 dancing greatsword",
      "repeating_npcatk-melee_-id1_atkmod": "35",
      "repeating_npcatk-melee_-id1_atkmod2": "30",
      "repeating_npcatk-melee_-id1_atkmod3": "25",
      "repeating_npcatk-melee_-id1_atkmod4": "20",
      "repeating_npcatk-melee_-id1_multipleatk_flag": "1",
      "repeating_npcatk-melee_-id1_dmgbase": "3d6+18",
      "repeating_npcatk-melee_-id1_atkcritrange": "20",
      "repeating_npcatk-melee_-id1_dmgcritmulti": "2",
      "repeating_npcatk-melee_-id2_atkname": "slam",
      "repeating_npcatk-melee_-id2_atkmod": "30",
      "repeating_npcatk-melee_-id2_dmgbase": "2d8+13",
    });
    expect(attrs["repeating_npcatk-melee_-id2_multipleatk_flag"]).toBeUndefined();
  });

  test("writes the click-to-roll macro and label, so attacks work without being edited", () => {
    expect(attrs["repeating_npcatk-melee_-id1_atkdisplay"]).toBe(
      "+5 dancing greatsword  + 35/+30/+25/+20 (3d6+18)",
    );
    expect(attrs["repeating_npcatk-melee_-id1_multipleatk"]).toContain(
      "{{rolldmg1=[[3d6+18 + @{rollmod_damage}[QUERY]]]}}",
    );
    expect(attrs["repeating_npcatk-melee_-id1_multipleatk"]).toContain("{{roll3=[[1d20cs>");
    expect(attrs["repeating_npcatk-melee_-id2_atkdisplay"]).toBe("slam  + 30 (2d8+13)");
    expect(attrs["repeating_npcatk-ranged_-id3_atkdisplay"]).toMatch(
      /^\+5 composite longbow  \+ 31\//,
    );
  });

  test("writes ranged attacks to the ranged section, notes in the description", () => {
    expect(sheet.rowOrders["npcatk-ranged"]).toEqual(["-id3"]);
    expect(attrs).toMatchObject({
      rangedattacks_flag: "1",
      "repeating_npcatk-ranged_-id3_atkname": "+5 composite longbow",
      "repeating_npcatk-ranged_-id3_atkdesc": "+9 Str bonus; slaying arrow",
      "repeating_npcatk-ranged_-id3_descflag": "1",
    });
  });

  test("fills ability scores, bab and combat maneuvers", () => {
    expect(attrs).toMatchObject({
      strength: "28",
      dexterity: "20",
      constitution: "30",
      intelligence: "23",
      wisdom: "27",
      charisma: "25",
      bab: "22",
      cmb_mod: "32",
      cmd_mod: "47",
    });
  });

  test("derives ability modifiers, since the sheet only does so when a score is edited", () => {
    expect(attrs).toMatchObject({
      strength_mod: "9",
      strength_half_mod: "4",
      strength_oneandahalf_mod: "13",
      dexterity_mod: "5",
      dexterity_half_mod: "2",
      dexterity_oneandahalf_mod: "7",
      constitution_mod: "10",
      intelligence_mod: "6",
      wisdom_mod: "8",
      charisma_mod: "7",
    });
    // only Strength and Dexterity have half / one-and-a-half modifiers
    expect(attrs.constitution_half_mod).toBeUndefined();
  });

  test("fills attack modifiers as BAB plus the ability modifier, not the score", () => {
    // Solar: BAB +22, Str 28 (+9), Dex 20 (+5)
    expect(attrs).toMatchObject({
      ranged_mod: "27",
      melee_mod: "31",
    });
  });

  test("fills skills the way the sheet displays them", () => {
    expect(attrs).toMatchObject({
      stealth: "21",
      stealth_display: "+21",
      stealth_flag: "1",
      knowledge_history: "31",
      craft: "31",
      craft_notes: "any one",
      craft_display: "+31 (any one)",
    });
  });

  test("writes feats and special abilities as repeating rows", () => {
    expect(sheet.rowOrders.feats).toHaveLength(11);
    expect(sheet.rowOrders.abilities).toHaveLength(2);

    const [featId] = sheet.rowOrders.feats!;
    expect(attrs).toMatchObject({
      [`repeating_feats_${featId}_name`]: "Cleave",
      [`repeating_feats_${featId}_type`]: "misc",
      special_abilities_flag: "1",
    });

    const [abilityId, slayingId] = sheet.rowOrders.abilities!;
    expect(attrs[`repeating_abilities_${abilityId}_name`]).toBe("Spells");
    expect(attrs[`repeating_abilities_${abilityId}_type`]).toBeUndefined();
    expect(attrs[`repeating_abilities_${slayingId}_name`]).toBe("Slaying Arrow");
    expect(attrs[`repeating_abilities_${slayingId}_type`]).toBe("Su");
  });

  test("fills ecology and puts flavour + description in the background", () => {
    expect(attrs.environment).toBe("any good-aligned plane");
    expect(attrs.background).toMatch(/^This towering humanoid creature/);
    expect(attrs.background).toContain("Solars are the greatest type of angel");
  });

  test("never writes empty attribute names or values", () => {
    for (const a of sheet.attributes) {
      expect(a.name).not.toBe("");
      expect(a.current === undefined && a.max === undefined).toBe(false);
      expect(a.current).not.toBe("");
    }
  });

  test("is plain JSON data, so it can cross the postMessage boundary", () => {
    expect(JSON.parse(JSON.stringify(sheet))).toEqual(sheet);
  });

  test("every repeating row is registered in a row order", () => {
    const ids = new Set(Object.values(sheet.rowOrders).flat());
    const used = new Set(
      sheet.attributes.flatMap((a) => a.name.match(/^repeating_[\w-]+?_(-id\d+)_/)?.[1] ?? []),
    );

    expect(used).toEqual(ids);
  });
});

describe("toSheet: marid fixture", () => {
  const sheet = toSheet(loadFixture("marid"), { newRowId: counter() });
  const attrs = current(sheet);

  test("sets no ranged flag content and no DR", () => {
    expect(attrs.rangedattacks_flag).toBe("0");
    expect(attrs.npc_dr).toBeUndefined();
    expect(sheet.rowOrders["npcatk-ranged"]).toBeUndefined();
  });

  test("writes the quantity into the attack name", () => {
    expect(attrs["repeating_npcatk-melee_-id1_atkname"]).toBe("2 slams");
    expect(attrs["repeating_npcatk-melee_-id2_atkname"]).toBe("mwk trident");
    expect(attrs["repeating_npcatk-melee_-id2_atkmod3"]).toBe("8");
  });

  test("puts special attacks in the notes field", () => {
    expect(attrs.specialattacks_flag).toBe("1");
    expect(attrs.specialattacks_notes).toMatch(/^vortex \(1\/10 minutes.*water mastery/);
  });
});

describe("toSheet: edge cases", () => {
  test("an empty npc only sets the NPC flag and a few zero flags", () => {
    const sheet = toSheet(emptyNpc());
    const names = sheet.attributes.map((a) => a.name);

    expect(names).toContain("npc");
    expect(names).not.toContain("ac");
    expect(names).not.toContain("hp");
    expect(sheet.rowOrders).toEqual({});
  });

  test("a missing ability score is written as a dash", () => {
    const sheet = toSheet(
      emptyNpc({ abilityScores: { Str: 10, Dex: 10, Con: null, Int: null, Wis: 10, Cha: 10 } }),
    );

    expect(current(sheet)).toMatchObject({ strength: "10", constitution: "-", intelligence: "-" });
  });

  test("a missing score has a modifier of 0, never '-' (it ends up inside roll formulas)", () => {
    const sheet = toSheet(
      emptyNpc({ abilityScores: { Str: 10, Dex: 10, Con: null, Int: null, Wis: 10, Cha: 10 } }),
    );
    const attrs = current(sheet);

    expect(attrs).toMatchObject({ constitution_mod: "0", intelligence_mod: "0" });
    expect(Object.values(attrs).filter((v) => v === "-")).toHaveLength(2); // the two scores
  });

  test("low scores give negative modifiers, rounded down like the sheet does", () => {
    const sheet = toSheet(
      emptyNpc({ abilityScores: { Str: 7, Dex: 9, Con: 1, Int: 0, Wis: 10, Cha: 11 } }),
    );

    expect(current(sheet)).toMatchObject({
      strength_mod: "-2",
      strength_half_mod: "-1",
      strength_oneandahalf_mod: "-3",
      dexterity_mod: "-1",
      constitution_mod: "-5",
      intelligence_mod: "-5", // a score of 0 is a real score, not "missing"
      wisdom_mod: "0",
      charisma_mod: "0",
    });
  });

  test("a score of zero is written, not skipped", () => {
    const sheet = toSheet(emptyNpc({ init: 0, bab: 0 }));

    expect(current(sheet)).toMatchObject({ initiative: "0", bab: "0" });
  });

  test("skills the sheet has no field for go in the skills notes", () => {
    const sheet = toSheet(
      emptyNpc({
        skills: {
          skills: [
            { name: "Knowledge (all)", mod: 10, notes: null },
            { name: "Stealth", mod: -2, notes: "+2 in forests" },
          ],
          racialModifiers: "+4 Stealth",
          unparsed: [],
        },
      }),
    );

    expect(current(sheet)).toMatchObject({
      skills_notes: "Knowledge (all) +10",
      skills_racial_modifiers: "+4 Stealth",
      stealth: "-2",
      stealth_display: "-2 (+2 in forests)",
    });
  });

  test("attacks it couldn't parse are kept as plain rows", () => {
    const sheet = toSheet(emptyNpc({ melee: { attacks: [], unparsed: ["something odd"] } }), {
      newRowId: counter(),
    });

    expect(current(sheet)).toMatchObject({
      meleeattacks_flag: "1",
      "repeating_npcatk-melee_-id1_atkname": "something odd",
      "repeating_npcatk-melee_-id1_atkmod": "0",
      "repeating_npcatk-melee_-id1_atkdisplay": "something odd 0",
    });
  });

  test("passes the parser's warnings through", () => {
    expect(toSheet(emptyNpc({ warnings: ["Could not read AC"] })).warnings).toEqual([
      "Could not read AC",
    ]);
  });

  test("the default row id generator produces Roll20-style ids", () => {
    const sheet = toSheet(emptyNpc({ melee: { attacks: [attack()], unparsed: [] } }));

    expect(sheet.rowOrders["npcatk-melee"]![0]).toMatch(/^-[-\w]{19}$/);
  });
});

describe("attackFields", () => {
  test("a plain attack", () => {
    expect(attackFields(attack())).toEqual({
      atkname: "bite",
      "options-flag": 0,
      atkmod: 10,
      atkcritrange: 20,
      dmgtype: "",
      dmgcritmulti: 2,
      dmgflag: 1,
      dmgbase: "1d6",
    });
  });

  test("an attack with no damage gets no damage fields", () => {
    const fields = attackFields(attack({ damage: null }));

    expect(fields.dmgflag).toBeUndefined();
    expect(fields.dmgbase).toBeUndefined();
  });

  test("an attack with no bonus gets +0", () => {
    expect(attackFields(attack({ iteratives: [] })).atkmod).toBe(0);
  });

  test("reads the lower end of a crit range and the multiplier", () => {
    expect(attackFields(attack({ critRange: "18-20", critMultiplier: 3 }))).toMatchObject({
      atkcritrange: 18,
      dmgcritmulti: 3,
    });
  });

  test("a dice quantity goes in the name", () => {
    expect(attackFields(attack({ name: "tentacles", quantityRoll: "1d4" })).atkname).toBe(
      "1d4 tentacles",
    );
  });

  test("iteratives beyond nine are dropped", () => {
    const fields = attackFields(attack({ iteratives: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11] }));

    expect(fields.atkmod9).toBe(12);
    expect(fields.atkmod10).toBeUndefined();
  });

  test("touch, incorporeal, notes, effects and restrictions all land in the description", () => {
    expect(
      attackFields(
        attack({
          touch: true,
          kind: "incorporeal",
          attackNotes: "+9 Str bonus",
          additionalEffects: "grab",
          restriction: "only while raging",
        }),
      ).atkdesc,
    ).toBe("+9 Str bonus; incorporeal; touch attack; grab; only while raging");
  });
});

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

describe("toSheet: attack modifiers", () => {
  const scores = { Str: 18, Dex: 14, Con: 10, Int: 10, Wis: 10, Cha: 10 };
  const attrsOf = (overrides: Partial<Npc>) =>
    current(toSheet(emptyNpc(overrides), { newRowId: counter() }));

  test("is BAB plus the ability modifier", () => {
    // Str 18 is +4, Dex 14 is +2
    expect(attrsOf({ bab: 5, abilityScores: scores })).toMatchObject({
      melee_mod: "9",
      ranged_mod: "7",
    });
  });

  test("a BAB of +0 is a real value, not a missing one", () => {
    expect(attrsOf({ bab: 0, abilityScores: scores })).toMatchObject({
      melee_mod: "4",
      ranged_mod: "2",
    });
  });

  test("a negative modifier subtracts", () => {
    expect(attrsOf({ bab: 1, abilityScores: { ...scores, Str: 6 } })).toMatchObject({
      melee_mod: "-1", // Str 6 is -2
    });
  });

  test("a missing score counts as a modifier of 0", () => {
    expect(attrsOf({ bab: 3, abilityScores: { ...scores, Str: null, Dex: null } })).toMatchObject({
      melee_mod: "3",
      ranged_mod: "3",
    });
  });

  test("writes nothing when the BAB is unknown", () => {
    const attrs = attrsOf({ bab: null, abilityScores: scores });

    expect(attrs.melee_mod).toBeUndefined();
    expect(attrs.ranged_mod).toBeUndefined();
  });
});

describe("toSheet: skills that share a sheet field", () => {
  const skillsLine = (...skills: { name: string; mod: number; notes?: string | null }[]) => ({
    skills: skills.map((s) => ({ notes: null, ...s })),
    racialModifiers: null,
    unparsed: [],
  });

  test("keeps the first in the field and moves the others to the notes instead of overwriting", () => {
    const sheet = toSheet(
      emptyNpc({
        skills: skillsLine(
          { name: "Perform (dance)", mod: 10 },
          { name: "Perform (sing)", mod: 12 },
          { name: "Stealth", mod: 4 },
        ),
      }),
      { newRowId: counter() },
    );
    const attrs = current(sheet);

    expect(attrs).toMatchObject({ perform: "10", perform_notes: "dance", stealth: "4" });
    expect(attrs.skills_notes).toBe("Perform (sing) +12");
  });

  test("skills with no field at all still go to the notes, after any duplicates", () => {
    const attrs = current(
      toSheet(
        emptyNpc({
          skills: skillsLine(
            { name: "Craft (armor)", mod: 5 },
            { name: "Craft (weapons)", mod: 6, notes: "masterwork" },
            { name: "Knowledge (all)", mod: 9 },
          ),
        }),
        { newRowId: counter() },
      ),
    );

    expect(attrs.craft).toBe("5");
    expect(attrs.skills_notes).toBe("Craft (weapons) +6 (masterwork), Knowledge (all) +9");
  });
});

describe("toSheet: mythic rank", () => {
  test("is kept at the top of the background, since the sheet has no field for it", () => {
    const attrs = current(
      toSheet(emptyNpc({ mythicRank: 3, flavour: "A radiant being." }), { newRowId: counter() }),
    );

    expect(attrs.background).toBe("Mythic Rank 3\n\nA radiant being.");
  });

  test("a non-mythic monster has no mention of it", () => {
    const attrs = current(toSheet(emptyNpc({ flavour: "Plain." }), { newRowId: counter() }));

    expect(attrs.background).toBe("Plain.");
  });
});

describe("toSheet: casting stat for spell DCs", () => {
  const npc = () =>
    emptyNpc({
      abilityScores: { Str: 10, Dex: 10, Con: 10, Int: 10, Wis: 20, Cha: 16 }, // Wis +5, Cha +3
      classLine: "Human cleric 9",
      spells: parseSpellBlock("(CL 9th; concentration +14)\n2nd\u2014hold person"),
    });

  const dcOf = (options: Parameters<typeof toSheet>[1]) => {
    const attrs = current(toSheet(npc(), { newRowId: counter(), ...options }));
    return Object.entries(attrs).find(([name]) => name.endsWith("_spelldc_mod"))?.[1];
  };

  test("defaults to the class's stat: 10 + 2 + Wis +5", () => {
    expect(dcOf({})).toBe("17");
  });

  test("the casting stat option is passed through to the spell rows", () => {
    expect(dcOf({ castingStat: "Cha" })).toBe("15"); // 10 + 2 + Cha +3
    expect(dcOf({ castingStat: "auto" })).toBe("17");
  });
});
