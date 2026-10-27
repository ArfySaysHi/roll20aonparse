import { describe, test, expect } from "vitest";
import {
  parseAttack,
  type Attack,
  parseSpellLikeEntry,
  parseAttackLine,
  parseSpellBlock,
  parseSpeed,
  parseSpecialAttacks,
} from "../../../../src/parser/values/fields/offense";
import { attacks } from "../../../../fixtures/attack";
import { normalize } from "../../../../src/shared/strings";

const base: Attack = {
  quantity: 1,
  quantityRoll: null,
  name: "",
  attackNotes: null,
  iteratives: [],
  kind: null,
  touch: false,
  damage: null,
  critRange: null,
  critMultiplier: null,
  damageType: null,
  additionalEffects: null,
  restriction: null,
};

describe("normalize", () => {
  test("fixes dashes, spacing, footnote marks", () => {
    expect(normalize("claw + 5 (1d4/19\u201320)*")).toBe("claw +5 (1d4/19-20)");
  });
});

describe("parseAttack", () => {
  test.each(attacks)("parseAttack(%j)", (input, expected) => {
    expect(parseAttack(input)).toStrictEqual({ ...base, ...expected });
  });

  test("returns null for unparseable input", () => {
    expect(parseAttack("")).toBeNull();
    expect(parseAttack("not an attack")).toBeNull();
  });
});

describe("parse spelllike", () => {
  describe("parseSpellLikeEntry", () => {
    test.each([
      ["detect snares and pits", { name: "detect snares and pits", dc: null, notes: null }],
      ["discern lies (DC 21)", { name: "discern lies", dc: "21", notes: null }],
      ["invisibility (self only)", { name: "invisibility", dc: null, notes: "self only" }],
      [
        "lover's vengeance (DC 18, see page 62)",
        { name: "lover's vengeance", dc: "18", notes: "see page 62" },
      ],
      // several parentheticals: a count and a DC
      ["holy aura (2) (DC 26)", { name: "holy aura", dc: "26", notes: "2" }],
      // commas inside the note must not be mistaken for a DC split
      [
        "plane shift (willing targets, Astral Plane)",
        { name: "plane shift", dc: null, notes: "willing targets, Astral Plane" },
      ],
      ["", null],
      ["(DC 5)", null],
    ])("parseSpellLikeEntry(%j)", (input, expected) => {
      const res = parseSpellLikeEntry(input);

      expect(res).toStrictEqual(expected);
    });
  });
});

describe("parseAttackLine", () => {
  test("reads a single attack", () => {
    const { attacks, unparsed } = parseAttackLine("bite +10 (1d6+3)");

    expect(unparsed).toEqual([]);
    expect(attacks.map((a) => [a.name, a.iteratives, a.damage])).toEqual([["bite", [10], "1d6+3"]]);
  });

  test("flattens alternatives separated by 'or'", () => {
    const { attacks } = parseAttackLine("2 slams +17 (2d6+6) or mwk trident +18/+13/+8 (2d6+9)");

    expect(attacks.map((a) => a.name)).toEqual(["slams", "mwk trident"]);
    expect(attacks[0]!.quantity).toBe(2);
    expect(attacks[1]!.iteratives).toEqual([18, 13, 8]);
  });

  test("splits a full attack on top-level commas but not commas inside parentheses", () => {
    const { attacks } = parseAttackLine("bite +10 (1d6 plus poison (DC 15, Fort)), claw +8 (1d4)");

    expect(attacks.map((a) => a.name)).toEqual(["bite", "claw"]);
    expect(attacks[0]!.additionalEffects).toBe("poison (DC 15, Fort)");
  });

  test("keeps pieces it can't read", () => {
    const { attacks, unparsed } = parseAttackLine("bite +10 (1d6), something odd");

    expect(attacks).toHaveLength(1);
    expect(unparsed).toEqual(["something odd"]);
  });

  test("an empty line gives nothing", () => {
    expect(parseAttackLine("")).toStrictEqual({ attacks: [], unparsed: [] });
  });
});

describe("speed / special attacks", () => {
  test("parseSpeed trims the separator", () => {
    expect(parseSpeed("20 ft., swim 60 ft.")).toBe("20 ft., swim 60 ft.");
    expect(parseSpeed("30 ft.,")).toBe("30 ft.");
  });

  test("parseSpecialAttacks splits on top-level commas", () => {
    expect(
      parseSpecialAttacks("vortex (1/10 minutes, 10\u201350 ft. tall, DC 22), water mastery"),
    ).toEqual(["vortex (1/10 minutes, 10\u201350 ft. tall, DC 22)", "water mastery"]);
  });
});

describe("parseSpellBlock", () => {
  const text = [
    "(CL 20th; concentration +25)",
    "Constant\u2014detect evil, discern lies (DC 21)",
    "3/day\u2014heal, mass charm monster (DC 25)",
    "1/year\u2014grant 1 wish (to nongenies only)",
  ].join("\n");

  test("reads the caster level and concentration from the header", () => {
    const block = parseSpellBlock(text);

    expect(block.casterLevel).toBe(20);
    expect(block.concentration).toBe(25);
  });

  test("groups spells by frequency", () => {
    const block = parseSpellBlock(text);

    expect(block.groups.map((g) => [g.frequency, g.spells.map((s) => s.name)])).toEqual([
      ["Constant", ["detect evil", "discern lies"]],
      ["3/day", ["heal", "mass charm monster"]],
      ["1/year", ["grant 1 wish"]],
    ]);
    expect(block.groups[0]!.spells[1]).toStrictEqual({
      name: "discern lies",
      dc: "21",
      notes: null,
    });
  });

  test("body is the text without the header", () => {
    expect(parseSpellBlock(text).body).toBe(text.split("\n").slice(1).join("\n"));
  });

  test("works without a header line", () => {
    const block = parseSpellBlock("At will\u2014light");

    expect(block.casterLevel).toBeNull();
    expect(block.groups).toEqual([
      { frequency: "At will", spells: [{ name: "light", dc: null, notes: null }] },
    ]);
  });

  test("keeps lines that aren't 'frequency\u2014spells'", () => {
    expect(parseSpellBlock("(CL 5th)\nodd line").unparsed).toEqual(["odd line"]);
  });
});
