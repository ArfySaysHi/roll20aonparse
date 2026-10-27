import { describe, test, expect } from "vitest";
import { compendiumFormula, SpellType } from "../../src/sheet/compendiumFormula";

describe("compendiumFormula", () => {
  test("per caster level with a cap", () => {
    expect(compendiumFormula("1d6 points of fire damage per caster level (maximum 10d6)")).toBe(
      "[[{(1*@{caster1_level}),10}kl1]]d6",
    );
  });

  test("per two caster levels with a cap", () => {
    expect(compendiumFormula("1d6 points of damage per two caster levels (maximum 10d6)")).toBe(
      "[[{(1*[[{floor((@{caster1_level}/2)),1}kh1]]),10}kl1]]d6",
    );
  });

  test("dice plus a flat amount per caster level (cure spells)", () => {
    expect(compendiumFormula("1d8 points of damage + 1 point per caster level (maximum +25)")).toBe(
      "1d8+{(1*@{caster1_level}),25}kl1",
    );
  });

  test("a leading multiplier is kept", () => {
    expect(compendiumFormula("2d6 points of fire damage per caster level (maximum 10d6)")).toBe(
      "[[{(2*@{caster1_level}),10}kl1]]d6",
    );
  });

  test("durations in rounds lose the word 'rounds'", () => {
    expect(compendiumFormula("2d10 rounds")).toBe("2d10");
  });

  test("reads the level from the chosen caster block", () => {
    expect(
      compendiumFormula(
        "1d6 points of fire damage per caster level (maximum 10d6)",
        SpellType.SPELLLIKE,
      ),
    ).toBe("[[{(1*@{caster2_level}),10}kl1]]d6");
  });

  test("inline mode keeps the original text and appends the roll", () => {
    expect(
      compendiumFormula(
        "1d6 points of fire damage per caster level (maximum 10d6)",
        SpellType.SPELL,
        true,
      ),
    ).toBe(
      "1d6 points of fire damage per caster level (maximum 10d6) ([[[[{(1*@{caster1_level}),10}kl1]]d6]])",
    );
    expect(compendiumFormula("2d10 rounds", SpellType.SPELL, true)).toBe("2d10 rounds ([[2d10]])");
  });

  test.each([
    ["3d6 points of fire damage"],
    ["1d6 per caster level"], // scaling with no cap isn't a shape the sheet understands
    ["nothing to convert"],
  ])("leaves %j unchanged", (text) => {
    expect(compendiumFormula(text)).toBe(text);
  });

  test("trims, and an empty string stays empty", () => {
    expect(compendiumFormula("  3d6  ")).toBe("3d6");
    expect(compendiumFormula("")).toBe("");
  });
});
