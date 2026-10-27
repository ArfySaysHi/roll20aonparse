import { describe, test, expect } from "vitest";
import { spellNames } from "../../src/spells/resolve";
import { loadFixture } from "../helpers";

describe("parseNpc: Mummy Lord (line breaks inside fields)", () => {
  const npc = loadFixture("mummy-lord");

  test("reads without complaint", () => {
    expect(npc.warnings).toEqual([]);
  });

  test("reads an AC that wraps across two lines", () => {
    expect(npc.ac).toEqual({
      ac: "24",
      touch: "14",
      flatFooted: "21",
      notes: "+6 armor, +1 deflection, +2 Dex, +1 dodge, +4 natural",
    });
  });

  test("reads the details block", () => {
    expect(npc).toMatchObject({
      name: "Mummy Lord",
      cr: "10",
      xp: 9600,
      classLine: "Male human mummy lord cleric 9",
      alignment: "LE",
      type: "undead",
      subtypes: "augmented human",
      aura: "great despair (30 ft., DC 19)",
      source: { name: "Bestiary 5", page: "176" },
    });
  });

  test("picks up racial modifiers, which Nethys puts behind their own label", () => {
    expect(npc.skills?.racialModifiers).toBe("+8 Intimidate, +8 Sense Motive, +8 Stealth");
    expect(npc.skills?.skills.map((s) => s.name)).toContain("Sense Motive");
  });

  test("flattens wrapped lines in other text fields", () => {
    expect(npc.specialAttacks).toContain("sandstorm wrath (DC 19, 6d8 fire and slashing)");
    expect(npc.organization).toBe(
      "solitary or court (mummy lord and 6\u201314 standard mummies or mummified creatures)",
    );
    expect(npc.treasure).toContain("headband of inspired wisdom +2");
    expect(npc.feats).toContain("Spell Focus (necromancy)");
    expect(`${npc.treasure}${npc.organization}`).not.toContain("\n");
  });

  test("reads the attacks, including the \u00d73 critical multiplier", () => {
    expect(npc.melee.attacks.map((a) => [a.name, a.iteratives, a.critMultiplier])).toEqual([
      ["+1 spear", [12, 7], 3],
      ["slam", [11], null],
    ]);
    expect(npc.melee.unparsed).toEqual([]);
  });

  test("reads the domain spell-like block and the prepared cleric spells", () => {
    expect(npc.spellLikeAbilities).toMatchObject({ casterLevel: 9, concentration: 14 });
    expect(npc.spellLikeAbilities?.groups.map((g) => g.frequency)).toEqual(["8/day"]);
    expect(npc.spells?.groups.map((g) => g.frequency)).toEqual([
      "5th",
      "4th",
      "3rd",
      "2nd",
      "1st",
      "0 (at will)",
    ]);
    expect(spellNames(npc.spells)).toContain("bull\u2019s strength");
  });

  test("drops the domain marker from spell names", () => {
    expect(spellNames(npc.spells)).toContain("dispel good");
    expect(spellNames(npc.spells).some((n) => /\bD$/.test(n))).toBe(false);
  });

  test("keeps notes such as 'evil only'", () => {
    const secondLevel = npc.spells!.groups.find((g) => g.frequency === "2nd")!;

    expect(secondLevel.spells.find((s) => s.name === "align weapon")?.notes).toBe("evil only");
  });
});

describe("parseNpc: Lich (metamagic prefixes)", () => {
  const npc = loadFixture("lich");

  test("reads without complaint", () => {
    expect(npc.warnings).toEqual([]);
  });

  test("picks up racial modifiers", () => {
    expect(npc.skills?.racialModifiers).toBe("+8 Perception, +8 Sense Motive, +8 Stealth");
  });

  test("looks spells up by their base name, without the metamagic", () => {
    const names = spellNames(npc.spells);

    expect(names).toContain("fireball");
    expect(names).toContain("magic missile");
    expect(names).toContain("mage armor");
    expect(names.some((n) => /maximized|quickened|extended/.test(n))).toBe(false);
  });

  test("keeps the counts and 'already cast' notes", () => {
    const notes = Object.fromEntries(
      npc.spells!.groups.flatMap((g) => g.spells).map((s) => [`${s.name}`, s.notes]),
    );

    expect(notes["wall of ice"]).toBe("2");
    expect(notes["magic missile"]).toBe("3");
    expect(notes["extended mage armor"]).toBe("already cast");
  });

  test("a description stops before the template's own headings", () => {
    expect(npc.description).not.toContain("Creating a Lich");
    expect(npc.description).not.toContain("Demilich");
  });
});
