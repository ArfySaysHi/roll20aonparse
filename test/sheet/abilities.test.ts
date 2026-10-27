import { describe, test, expect } from "vitest";
import { abilityModAttributes } from "../../src/sheet/abilities";

describe("abilityModAttributes", () => {
  test.each([
    [10, 0],
    [11, 0],
    [12, 1],
    [28, 9],
    [9, -1],
    [8, -1],
    [7, -2],
    [1, -5],
    [0, -5],
  ])("score %i gives a modifier of %i", (score, mod) => {
    expect(abilityModAttributes("wisdom", score)).toEqual({ wisdom_mod: mod });
  });

  test("strength and dexterity also get half and one-and-a-half modifiers", () => {
    expect(abilityModAttributes("strength", 28)).toEqual({
      strength_mod: 9,
      strength_half_mod: 4,
      strength_oneandahalf_mod: 13,
    });
    expect(abilityModAttributes("dexterity", 7)).toEqual({
      dexterity_mod: -2,
      dexterity_half_mod: -1,
      dexterity_oneandahalf_mod: -3,
    });
  });

  test("a missing score is a modifier of 0 and nothing else", () => {
    expect(abilityModAttributes("strength", null)).toEqual({ strength_mod: 0 });
    expect(abilityModAttributes("intelligence", null)).toEqual({ intelligence_mod: 0 });
  });
});
