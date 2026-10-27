import { describe, test, expect } from "vitest";
import { parseNpc } from "../../src/parser/npc";
import { docFromHtml, loadFixture, statblock } from "../helpers";

describe("parseNpc: solar fixture", () => {
  const npc = loadFixture("solar");

  test("reads the details block", () => {
    expect(npc).toMatchObject({
      name: "Solar",
      title: "Angel, Solar",
      cr: "23",
      xp: 819200,
      source: { name: "Pathfinder RPG Bestiary", page: "12" },
      alignment: "NG",
      size: "Large",
      type: "outsider",
      subtypes: "angel, extraplanar, good",
      classLine: null,
      init: 9,
      perception: 33,
      aura: "protective aura",
    });
    expect(npc.senses.map((s) => s.name)).toEqual([
      "darkvision",
      "low-light vision",
      "detect evil",
      "detect snares and pits",
      "true seeing",
    ]);
  });

  test("reads defenses", () => {
    expect(npc.ac).toEqual({
      ac: "44",
      touch: "11",
      flatFooted: "42",
      notes: "+14 armor, +1 Dex, +1 dodge, +19 natural, \u20131 size; +4 deflection vs. evil",
    });
    expect(npc.hp).toEqual({
      hp: "363",
      hd: "22d10+242",
      notes: "regeneration 15 (evil artifacts, effects, and spells)",
    });
    expect(npc.saves.fort).toEqual({ mod: 25, notes: null });
    expect(npc.saves.will).toEqual({ mod: 23, notes: "+4 vs. poison, +4 resistance vs. evil" });
    expect(npc).toMatchObject({
      dr: "15/epic and evil",
      immune: "acid, cold, petrification",
      resist: "electricity 10, fire 10",
      sr: 34,
    });
  });

  test("reads melee and ranged attacks", () => {
    expect(npc.melee.attacks.map((a) => [a.name, a.iteratives, a.damage])).toEqual([
      ["+5 dancing greatsword", [35, 30, 25, 20], "3d6+18"],
      ["slam", [30], "2d8+13"],
    ]);
    expect(npc.ranged.attacks).toHaveLength(1);
    expect(npc.ranged.attacks[0]).toMatchObject({
      name: "+5 composite longbow",
      attackNotes: "+9 Str bonus",
      additionalEffects: "slaying arrow",
    });
    expect([...npc.melee.unparsed, ...npc.ranged.unparsed]).toEqual([]);
  });

  test("reads spell-like abilities and prepared spells", () => {
    expect(npc.spellLikeAbilities?.casterLevel).toBe(20);
    expect(npc.spellLikeAbilities?.groups.map((g) => g.frequency)).toEqual([
      "Constant",
      "At Will",
      "3/day",
      "1/day",
    ]);
    expect(npc.spells?.casterLevel).toBe(20);
    expect(npc.spells?.groups).toHaveLength(10);
  });

  test("reads statistics", () => {
    expect(npc.abilityScores).toEqual({ Str: 28, Dex: 20, Con: 30, Int: 23, Wis: 27, Cha: 25 });
    expect(npc).toMatchObject({ bab: 22, cmb: { value: 32 }, cmd: { value: 47 } });
    expect(npc.feats).toHaveLength(11);
    expect(npc.feats).toContain("Power Attack");
    expect(npc.skills?.skills).toHaveLength(12);
    expect(npc.languages).toBe("Celestial, Draconic, Infernal; truespeech");
  });

  test("reads special abilities", () => {
    expect(npc.specialAbilities.map((a) => [a.name, a.type])).toEqual([
      ["Spells", null],
      ["Slaying Arrow", "Su"],
    ]);
  });

  test("reads ecology and description", () => {
    expect(npc.environment).toBe("any good-aligned plane");
    expect(npc.description?.startsWith("Solars are the greatest type of angel")).toBe(true);
    expect(npc.description).not.toContain("Creatures in");
  });

  test("reads everything without complaint", () => {
    expect(npc.warnings).toEqual([]);
  });
});

describe("parseNpc: marid fixture", () => {
  const npc = loadFixture("marid");

  test("has no aura, DR or SR, and no ranged attacks", () => {
    expect(npc).toMatchObject({ aura: null, dr: null, sr: null });
    expect(npc.ranged.attacks).toEqual([]);
  });

  test("reads the attack line with a quantity and an 'or'", () => {
    expect(npc.melee.attacks.map((a) => [a.quantity, a.name])).toEqual([
      [2, "slams"],
      [1, "mwk trident"],
    ]);
  });

  test("drops the <sup>B</sup> bonus-feat mark from feat names", () => {
    expect(npc.feats).toContain("Improved Initiative");
    expect(npc.feats.some((f) => /Initiative\w/.test(f))).toBe(false);
  });

  test("reads special attacks, keeping commas inside parentheses together", () => {
    expect(npc.specialAttacks).toHaveLength(3);
    expect(npc.specialAttacks[0]).toMatch(/^vortex \(1\/10 minutes/);
  });

  test("reads spell-like abilities (and no prepared spells)", () => {
    expect(npc.spellLikeAbilities?.casterLevel).toBe(12);
    expect(npc.spells).toBeNull();
  });

  test("reads without complaint", () => {
    expect(npc.warnings).toEqual([]);
  });
});

describe("parseNpc: edge cases", () => {
  test("a missing section is fine", () => {
    const npc = parseNpc(statblock());

    expect(npc).toMatchObject({ name: "Goblin", cr: "1/3", xp: 135, init: 6 });
    expect(npc?.ac).toBeNull();
    expect(npc?.specialAbilities).toEqual([]);
    expect(npc?.description).toBeNull();
    expect(npc?.warnings).toEqual([]);
  });

  test("a class line above the type line is picked up", () => {
    const npc = parseNpc(
      statblock({
        details: "<b>XP</b> 400<br>Goblin warrior 2<br>NE Small humanoid (goblinoid)<br>",
      }),
    );

    expect(npc?.classLine).toBe("Goblin warrior 2");
    expect(npc?.alignment).toBe("NE");
  });

  test("a field that can't be read becomes a warning, not a crash", () => {
    const npc = parseNpc(
      statblock({
        sections: '<h3 class="framing">Defense</h3><b>AC</b> sixteen-ish<br><b>hp</b> 6 (1d10+1)',
      }),
    );

    expect(npc?.ac).toBeNull();
    expect(npc?.hp).toMatchObject({ hp: "6" });
    expect(npc?.warnings).toEqual(['Could not read AC: "sixteen-ish"']);
  });

  test("an unreadable attack is reported", () => {
    const npc = parseNpc(
      statblock({
        sections: '<h3 class="framing">Offense</h3><b>Melee</b> sword +5 (1d8), ???',
      }),
    );

    expect(npc?.melee.attacks).toHaveLength(1);
    expect(npc?.warnings).toEqual(['Could not read Melee attack: "???"']);
  });

  test("a missing type line is reported", () => {
    const npc = parseNpc(statblock({ details: "<b>XP</b> 135<br><b>Init</b> +6;" }));

    expect(npc?.alignment).toBeNull();
    expect(npc?.warnings).toContain("Could not find the alignment / size / type line");
  });

  test("creatures with no ability score show up as null", () => {
    const npc = parseNpc(
      statblock({
        sections:
          '<h3 class="framing">Statistics</h3><b>Str</b> 11, <b>Dex</b> 15, <b>Con</b> \u2014, <b>Int</b> \u2014, <b>Wis</b> 9, <b>Cha</b> 6',
      }),
    );

    expect(npc?.abilityScores).toEqual({ Str: 11, Dex: 15, Con: null, Int: null, Wis: 9, Cha: 6 });
  });

  test("a page that isn't a monster page gives null", () => {
    expect(parseNpc(docFromHtml("<html><body><p>nothing here</p></body></html>"))).toBeNull();
  });

  test("a page whose heading has no CR gives null", () => {
    const doc = docFromHtml(
      '<span id="MainContent_DataListFeats_Label1_0"><h1 class="title">Thing</h1><h2 class="title">Not a monster</h2></span>',
    );

    expect(parseNpc(doc)).toBeNull();
  });
});

describe("parseNpc: pages that don't fit the simple case", () => {
  const page = (...blocks: string[]) =>
    docFromHtml(
      `<span id="MainContent_DataListFeats_Label1_0"><h1 class="title">Thing</h1>${blocks.join("")}</span>`,
    );
  const block = (heading: string) =>
    `<h2 class="title">${heading}</h2><b>XP</b> 135<br>NE Small humanoid (goblinoid)<br>`;

  test("a mythic heading is read, with the rank kept apart from the CR", () => {
    const npc = parseNpc(page(block("Mythic Goblin CR 1/MR 1")));

    expect(npc).toMatchObject({ name: "Mythic Goblin", cr: "1", mythicRank: 1 });
  });

  test("a normal monster has no mythic rank at all", () => {
    expect(parseNpc(page(block("Goblin CR 1/3")))).not.toHaveProperty("mythicRank");
  });

  test("a page with several stat blocks imports the first and says so", () => {
    const npc = parseNpc(page(block("Young Thing CR 6"), block("Adult Thing CR 9")));

    expect(npc).toMatchObject({ name: "Young Thing", cr: "6" });
    expect(npc?.warnings).toContain(
      "This page has 2 stat blocks; only the first (Young Thing) was imported",
    );
  });

  test("a single stat block gets no such warning", () => {
    expect(parseNpc(page(block("Goblin CR 1/3")))?.warnings).toEqual([]);
  });

  test("two casting blocks are merged, and the person is told", () => {
    const npc = parseNpc(
      statblock({
        sections:
          '<h3 class="framing">Offense</h3>' +
          "<b>Cleric Spells Prepared</b> (CL 3rd)<br>1st\u2014bless<br>" +
          "<b>Wizard Spells Prepared</b> (CL 5th)<br>1st\u2014shield<br>",
      }),
    );

    expect(npc?.spells?.casterLevel).toBe(3);
    expect(npc?.warnings).toContain(
      "Found 2 casting blocks (Cleric Spells Prepared, Wizard Spells Prepared); " +
        "they were merged and use the first block's caster level",
    );
  });
});

describe("parseNpc: the class named by a casting block", () => {
  const withBlock = (label: string) =>
    parseNpc(
      statblock({
        sections: `<h3 class="framing">Offense</h3><b>${label}</b> (CL 3rd)<br>1st\u2014bless<br>`,
      }),
    );

  test.each([
    ["Cleric Spells Prepared", "Cleric"],
    ["Sorcerer Spells Known", "Sorcerer"],
    ["Bloodrager Spells Known", "Bloodrager"],
  ])("%s names %s", (label, expected) => {
    expect(withBlock(label)?.spellClass).toBe(expected);
  });

  test("a bare label names no class, and leaves the field off entirely", () => {
    expect(withBlock("Spells Prepared")).not.toHaveProperty("spellClass");
  });

  test("a stat block with no spells has none", () => {
    expect(parseNpc(statblock())).not.toHaveProperty("spellClass");
  });
});
