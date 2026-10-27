import { describe, test, expect } from "vitest";
import { compendiumFormula } from "../../src/sheet/compendiumFormula";
import { parseSpellCombat } from "../../src/spells/combat";
import { loadSpellPage } from "../helpers";

describe("parseSpellCombat: damage", () => {
  test("scales per caster level, with a cap and a type (Burning Hands)", () => {
    const { damage, attack } = parseSpellCombat(
      "A cone of searing flame shoots from your fingertips. Any creature in the area of the flames " +
        "takes 1d4 points of fire damage per caster level (maximum 5d4). Flammable materials burn.",
    );

    expect(damage).toEqual({
      text: "1d4 points of fire damage per caster level (maximum 5d4)",
      dice: "1d4",
      type: "fire",
      scalesWithLevel: true,
    });
    expect(attack).toBeNull();
  });

  test("scales per two caster levels, with no type (Vampiric Touch)", () => {
    const { damage, attack } = parseSpellCombat(
      "You must succeed on a melee touch attack. Your touch deals 1d6 points of damage per two " +
        "caster levels (maximum 10d6) and you gain temporary hit points.",
    );

    expect(damage).toEqual({
      text: "1d6 points of damage per two caster levels (maximum 10d6)",
      dice: "1d6",
      type: null,
      scalesWithLevel: true,
    });
    expect(attack).toBe("melee");
  });

  test("a ranged touch attack with a force type (Battering Blast)", () => {
    const { damage, attack } = parseSpellCombat(
      "You hurl a ball of force at a creature or object, making a ranged touch attack. " +
        "The ball deals 1d6 points of force damage per two caster levels (maximum 5d6).",
    );

    expect(damage).toMatchObject({ dice: "1d6", type: "force", scalesWithLevel: true });
    expect(attack).toBe("ranged");
  });

  test("plain damage that doesn't scale", () => {
    expect(
      parseSpellCombat("The bolt deals 3d6 points of fire damage to the target.").damage,
    ).toEqual({
      text: "3d6 points of fire damage",
      dice: "3d6",
      type: "fire",
      scalesWithLevel: false,
    });
  });

  test("dice with a flat bonus", () => {
    expect(parseSpellCombat("It deals 2d6+5 points of damage.").damage).toMatchObject({
      dice: "2d6+5",
      type: null,
    });
  });

  test("'points of' is optional", () => {
    expect(parseSpellCombat("Each target takes 2d6 nonlethal damage.").damage).toMatchObject({
      dice: "2d6",
      type: "nonlethal",
    });
  });

  test("a word like 'additional' isn't a damage type", () => {
    expect(parseSpellCombat("It deals 1d6 points of additional damage.").damage?.type).toBeNull();
  });

  test("healing in the cure-spell shape is read like any other clause", () => {
    expect(
      parseSpellCombat(
        "You channel positive energy to cure 1d8 points of damage + 1 point per caster level (maximum +25).",
      ).damage,
    ).toEqual({
      text: "1d8 points of damage + 1 point per caster level (maximum +25)",
      dice: "1d8",
      type: null,
      scalesWithLevel: true,
    });
  });

  test("dice that aren't damage are ignored", () => {
    expect(parseSpellCombat("The effect lasts 1d4 rounds and moves 2d6 feet.").damage).toBeNull();
  });

  test("takes the first clause when there are several", () => {
    expect(
      parseSpellCombat("It deals 3d6 points of bludgeoning damage and 2d6 points of cold damage.")
        .damage,
    ).toMatchObject({ dice: "3d6", type: "bludgeoning" });
  });
});

describe("parseSpellCombat: attacks", () => {
  test.each([
    ["You must succeed on a ranged touch attack.", "ranged"],
    ["Your successful melee touch attack deals damage.", "melee"],
    ["Make a touch attack against the target.", "melee"],
    ["A creature is affected without any attack roll.", null],
  ])("%j", (description, expected) => {
    expect(parseSpellCombat(description).attack).toBe(expected);
  });

  test("only the first paragraph counts", () => {
    expect(
      parseSpellCombat(
        "It explodes.\n\nTo pass an arrow slit you must hit it with a ranged touch attack.",
      ).attack,
    ).toBeNull();
  });
});

describe("parseSpellCombat: edge cases", () => {
  test("no description gives nothing", () => {
    expect(parseSpellCombat(null)).toEqual({ attack: null, damage: null });
    expect(parseSpellCombat("")).toEqual({ attack: null, damage: null });
  });
});

describe("parseSpellCombat: real pages", () => {
  test("Fireball: capped per-level fire damage, and no attack despite the arrow-slit paragraph", () => {
    const fireball = loadSpellPage("spell-fireball")[0]!;
    const { damage, attack } = parseSpellCombat(fireball.description);

    expect(damage).toMatchObject({
      text: "1d6 points of fire damage per caster level (maximum 10d6)",
      type: "fire",
    });
    expect(attack).toBeNull();
    expect(compendiumFormula(damage!.text)).toBe("[[{(1*@{caster1_level}),10}kl1]]d6");
  });

  test("Cure Light Wounds, Mass converts to a level-based formula", () => {
    const { damage } = parseSpellCombat(
      loadSpellPage("spell-cure-light-wounds-mass")[0]!.description,
    );

    expect(compendiumFormula(damage!.text)).toBe("1d8+{(1*@{caster1_level}),25}kl1");
  });

  test("Controlled Fireball has no dice of its own", () => {
    expect(parseSpellCombat(loadSpellPage("spell-fireball")[1]!.description).damage).toBeNull();
  });

  test("a buff like Spell Immunity has neither", () => {
    for (const spell of loadSpellPage("spell-immunity-greater")) {
      expect(parseSpellCombat(spell.description)).toEqual({ attack: null, damage: null });
    }
  });
});
