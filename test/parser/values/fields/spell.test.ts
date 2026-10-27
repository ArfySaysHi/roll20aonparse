import { describe, test, expect } from "vitest";
import { parseSpellLevels, parseSpellSchool } from "../../../../src/parser/values/fields/spell";

describe("parseSpellSchool", () => {
  test.each([
    ["abjuration;", { school: "abjuration", subschools: [], descriptors: [] }],
    ["conjuration (healing);", { school: "conjuration", subschools: ["healing"], descriptors: [] }],
    ["evocation [fire];", { school: "evocation", subschools: [], descriptors: ["fire"] }],
    [
      "evocation [fire, ruse];",
      { school: "evocation", subschools: [], descriptors: ["fire", "ruse"] },
    ],
    [
      "conjuration (summoning) [good, lawful];",
      { school: "conjuration", subschools: ["summoning"], descriptors: ["good", "lawful"] },
    ],
    ["universal", { school: "universal", subschools: [], descriptors: [] }],
  ])("parseSpellSchool(%j)", (input, expected) => {
    expect(parseSpellSchool(input)).toStrictEqual(expected);
  });

  test("gives null when there is no school", () => {
    expect(parseSpellSchool("")).toBeNull();
    expect(parseSpellSchool("[fire]")).toBeNull();
  });
});

describe("parseSpellLevels", () => {
  test("reads each class and level", () => {
    expect(parseSpellLevels("bard 5, cleric 5, druid 6")).toStrictEqual([
      { class: "bard", level: 5 },
      { class: "cleric", level: 5 },
      { class: "druid", level: 6 },
    ]);
  });

  test("keeps a parenthetical in the class name", () => {
    expect(parseSpellLevels("summoner (unchained) 3, wizard 4")).toStrictEqual([
      { class: "summoner (unchained)", level: 3 },
      { class: "wizard", level: 4 },
    ]);
  });

  test("handles level 0 and skips entries without a level", () => {
    expect(parseSpellLevels("cleric 0, nonsense")).toStrictEqual([{ class: "cleric", level: 0 }]);
  });

  test("an empty string gives nothing", () => {
    expect(parseSpellLevels("")).toEqual([]);
  });
});
