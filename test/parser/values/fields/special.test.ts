import { describe, test, expect } from "vitest";
import { parseSpecialAbility } from "../../../../src/parser/values/fields/special";

describe("parseSpecialAbility", () => {
  test.each([
    ["Water Mastery (Ex)", "Water Mastery", "Ex"],
    ["Slaying Arrow (Su)", "Slaying Arrow", "Su"],
    ["Plane Shift (Sp)", "Plane Shift", "Sp"],
    ["Aura of Doom (Ex or Su)", "Aura of Doom", "Ex or Su"],
  ])("parseSpecialAbility(%j)", (label, name, type) => {
    expect(parseSpecialAbility(label, " text ")).toStrictEqual({
      name,
      type,
      description: "text",
    });
  });

  test("a label with no ability type keeps its name", () => {
    expect(parseSpecialAbility("Spells", "Solars cast divine spells.")).toStrictEqual({
      name: "Spells",
      type: null,
      description: "Solars cast divine spells.",
    });
  });
});
