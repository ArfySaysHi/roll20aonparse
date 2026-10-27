import { describe, test, expect } from "vitest";
import {
  parseAbilityScore,
  parseBab,
  parseFeats,
  parseManeuver,
  parseSkills,
} from "../../../../src/parser/values/fields/statistics";

describe("statistics parsing", () => {
  test.each([
    ["28,", 28],
    ["10", 10],
    ["\u2014", null], // mindless creatures have no Int
    ["-", null],
  ])("parseAbilityScore(%j)", (input, expected) => {
    expect(parseAbilityScore(input)).toBe(expected);
  });

  test.each([
    ["+22;", 22],
    ["+0", 0],
    ["\u20132", -2],
  ])("parseBab(%j)", (input, expected) => {
    expect(parseBab(input)).toBe(expected);
  });

  test.each([
    ["+32;", { value: 32, notes: null }],
    ["47", { value: 47, notes: null }],
    ["47 (51 vs. trip)", { value: 47, notes: "51 vs. trip" }],
    ["\u20132", { value: -2, notes: null }],
    ["\u2014", null],
  ])("parseManeuver(%j)", (input, expected) => {
    expect(parseManeuver(input)).toStrictEqual(expected);
  });

  describe("parseSkills", () => {
    test("reads names, modifiers and parenthetical notes", () => {
      expect(
        parseSkills("Craft (any one) +31, Knowledge (history) +31, Stealth +8 (+12 in shadows)"),
      ).toStrictEqual({
        skills: [
          { name: "Craft (any one)", mod: 31, notes: null },
          { name: "Knowledge (history)", mod: 31, notes: null },
          { name: "Stealth", mod: 8, notes: "+12 in shadows" },
        ],
        racialModifiers: null,
        unparsed: [],
      });
    });

    test("handles negative modifiers written with an en dash", () => {
      expect(parseSkills("Stealth \u20134").skills).toEqual([
        { name: "Stealth", mod: -4, notes: null },
      ]);
    });

    test("splits off racial modifiers", () => {
      const result = parseSkills("Perception +10, Stealth +8; Racial Modifiers +4 Stealth");

      expect(result.skills.map((s) => s.name)).toEqual(["Perception", "Stealth"]);
      expect(result.racialModifiers).toBe("+4 Stealth");
    });

    test("keeps entries it can't read instead of dropping them", () => {
      expect(parseSkills("Perception +10, mystery").unparsed).toEqual(["mystery"]);
    });
  });

  describe("parseFeats", () => {
    test("splits on top-level commas", () => {
      expect(parseFeats("Cleave, Deadly Aim, Dodge")).toEqual(["Cleave", "Deadly Aim", "Dodge"]);
    });

    test("keeps parentheticals, even ones containing commas", () => {
      expect(parseFeats("Weapon Focus (bite), Spell Mastery (bless, cure light wounds)")).toEqual([
        "Weapon Focus (bite)",
        "Spell Mastery (bless, cure light wounds)",
      ]);
    });

    test.each([[""], ["\u2014"], ["-"]])("treats %j as no feats", (input) => {
      expect(parseFeats(input)).toEqual([]);
    });
  });
});
