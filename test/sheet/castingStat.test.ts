import { describe, test, expect } from "vitest";
import {
  abilityForClass,
  chooseCastingStat,
  modifier,
  spellDc,
  type CastingStatInput,
} from "../../src/sheet/castingStat";

const scores = (Int: number, Wis: number, Cha: number) => ({ Str: 10, Dex: 10, Con: 10, Int, Wis, Cha });

const input = (overrides: Partial<CastingStatInput> = {}): CastingStatInput => ({
  choice: "auto",
  scores: scores(10, 10, 10),
  casterLevel: null,
  concentration: null,
  knownDcs: [],
  spellClass: null,
  classLine: null,
  ...overrides,
});

describe("modifier and spellDc", () => {
  test.each([
    [10, 0],
    [11, 0],
    [18, 4],
    [9, -1],
    [6, -2],
    [null, 0],
    [undefined, 0],
  ])("modifier(%j) is %j", (score, expected) => {
    expect(modifier(score)).toBe(expected);
  });

  test("a DC is 10 + spell level + modifier", () => {
    expect(spellDc(3, 5)).toBe(18);
    expect(spellDc(0, 4)).toBe(14);
    expect(spellDc(9, -1)).toBe(18);
  });
});

describe("abilityForClass", () => {
  test.each([
    ["Wizard", "Int"],
    ["wizard", "Int"],
    ["Cleric", "Wis"],
    ["Sorcerer", "Cha"],
    ["Male human mummy lord cleric 9", "Wis"],
    ["Human oracle 7/fighter 2", "Cha"],
    ["Elf magus 5", "Int"],
    ["Warpriest", "Wis"],
    ["Paladin", "Cha"],
  ])("%s casts with %s", (text, expected) => {
    expect(abilityForClass(text)).toBe(expected);
  });

  test.each([["Psychic"], ["Human fighter 5"], ["Wizardry"], [""], [null], [undefined]])(
    "%j has no default casting stat",
    (text) => {
      expect(abilityForClass(text)).toBeNull();
    },
  );
});

describe("chooseCastingStat", () => {
  test("a choice from the person wins over everything", () => {
    const stat = chooseCastingStat(
      input({ choice: "Cha", scores: scores(10, 10, 16), spellClass: "Cleric" }),
    );

    expect(stat).toEqual({ ability: "Cha", mod: 3, source: "your choice", note: null });
  });

  test("uses the class's stat when nothing contradicts it, without comment", () => {
    const stat = chooseCastingStat(input({ scores: scores(10, 18, 10), spellClass: "Cleric" }));

    expect(stat).toMatchObject({ ability: "Wis", mod: 4, source: "the class", note: null });
  });

  test("falls back to the race/class line when the casting label names no class", () => {
    const stat = chooseCastingStat(input({ scores: scores(22, 14, 16), classLine: "Lich wizard 11" }));

    expect(stat).toMatchObject({ ability: "Int", mod: 6, source: "the class" });
  });

  test("a tie between two stats is broken by the class (Mummy Lord: Wis 20, Cha 20)", () => {
    const stat = chooseCastingStat(
      input({
        scores: scores(10, 20, 20),
        casterLevel: 9,
        concentration: 14, // +5 fits both Wis and Cha
        spellClass: "Cleric",
      }),
    );

    expect(stat).toMatchObject({ ability: "Wis", source: "the class", note: null });
  });

  test("concentration that points at a different stat means an archetype, and says so", () => {
    // A "cleric" whose concentration (+14 at CL 9 = +5) only fits Charisma.
    const stat = chooseCastingStat(
      input({
        scores: scores(10, 14, 20),
        casterLevel: 9,
        concentration: 14,
        spellClass: "Cleric",
      }),
    );

    expect(stat.ability).toBe("Cha");
    expect(stat.source).toBe("the stat block");
    expect(stat.note).toBe("The stat block's numbers fit Cha, not the Wis this class usually casts with");
  });

  test("printed DCs identify the stat when there's no class", () => {
    const stat = chooseCastingStat(
      input({
        scores: scores(10, 12, 18),
        knownDcs: [{ level: 2, dc: 16 }], // 10 + 2 + 4 = Cha
      }),
    );

    expect(stat).toMatchObject({ ability: "Cha", source: "the stat block", note: null });
  });

  test("a printed DC that fits no stat (a Spell Focus bonus) is ignored, not trusted", () => {
    const stat = chooseCastingStat(
      input({ scores: scores(22, 14, 16), spellClass: "Wizard", knownDcs: [{ level: 6, dc: 23 }] }),
    );

    expect(stat).toMatchObject({ ability: "Int", source: "the class", note: null });
  });

  test("with no class and no clues it guesses the strongest stat, and flags it", () => {
    const stat = chooseCastingStat(input({ scores: scores(12, 10, 17) }));

    expect(stat).toMatchObject({ ability: "Cha", mod: 3, source: "a guess" });
    expect(stat.note).toBe("Could not tell which stat this caster uses, so Cha (+3) was assumed");
  });

  test("a guess between tied stats is still flagged", () => {
    expect(chooseCastingStat(input()).source).toBe("a guess");
  });

  test("a psychic, whose stat depends on the discipline, is decided by the clues", () => {
    const stat = chooseCastingStat(
      input({ scores: scores(18, 10, 12), classLine: "Human psychic 5", casterLevel: 5, concentration: 9 }),
    );

    expect(stat).toMatchObject({ ability: "Int", source: "the stat block", note: null });
  });

  test("a missing score counts as a modifier of 0", () => {
    const stat = chooseCastingStat(input({ choice: "Int", scores: { Int: null } }));

    expect(stat.mod).toBe(0);
  });
});
