import { describe, test, expect } from "vitest";
import {
  classifyDetailLines,
  parseClassLine,
  parseHeading,
  parseInit,
  parseSense,
  parseSenses,
  parseSource,
  parseTypeLine,
  parseXp,
} from "../../../../src/parser/values/fields/details";

describe("details parsing", () => {
  test.each([
    ["Solar CR 23", { name: "Solar", cr: "23" }],
    ["Goblin CR 1/3", { name: "Goblin", cr: "1/3" }],
    ["Ercinee CR 4", { name: "Ercinee", cr: "4" }],
    ["Mythic Solar CR 10/MR 3", { name: "Mythic Solar", cr: "10", mythicRank: 3 }],
    ["Mythic Goblin CR 1/3/MR 1", { name: "Mythic Goblin", cr: "1/3", mythicRank: 1 }],
    ["garbage", null],
  ])("parseHeading(%j)", (input, expected) => {
    const res = parseHeading(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    ["Pathfinder RPG Bestiary pg. 156", { name: "Pathfinder RPG Bestiary", page: "156" }],
  ])("parseSource(%j)", (input, expected) => {
    const res = parseSource(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    ["819,200", 819200],
    ["200", 200],
    // the class / type lines under XP land in the same field
    ["819,200\nNG Large outsider (angel, extraplanar, good)", 819200],
    ["nope", null],
  ])("parseXp(%j)", (input, expected) => {
    const res = parseXp(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    [
      "Enlightened troglodyte cleric 7/fighter 2 (see page 212)",
      {
        classes: [
          { name: "Enlightened troglodyte cleric", level: 7 },
          { name: "fighter", level: 2 },
        ],
        note: "see page 212",
      },
    ],
    ["Goblin warrior 1", { classes: [{ name: "Goblin warrior", level: 1 }], note: null }],
    ["garbage trashhaver", null],
  ])("parseClassLine(%j)", (input, expected) => {
    const res = parseClassLine(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    [
      "NG Large outsider (angel, extraplanar, good)",
      { alignment: "NG", size: "Large", type: "outsider", subtypes: "angel, extraplanar, good" },
    ],
    [
      "N Large magical beast",
      { alignment: "N", size: "Large", type: "magical beast", subtypes: null },
    ],
    ["N Medium animal", { alignment: "N", size: "Medium", type: "animal", subtypes: null }],
    [
      "CN Small monstrous humanoid (aquatic)",
      { alignment: "CN", size: "Small", type: "monstrous humanoid", subtypes: "aquatic" },
    ],
  ])("parseXp(%j)", (input, expected) => {
    const res = parseTypeLine(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    ["+8;", 8],
    ["-3;", -3],
    ["6;", 6],
    ["2", 2],
  ])("parseInit(%j)", (input, expected) => {
    const res = parseInit(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    ["darkvision 60 ft.", { name: "darkvision", range: "60 ft." }],
    ["mistsight", { name: "mistsight", range: null }],
  ])("parseSense(%j)", (input, expected) => {
    const res = parseSense(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    [
      "darkvision 600 ft., low-light vision, mistsight, tremorsense 300 ft.; Perception +34",
      {
        senses: [
          {
            name: "darkvision",
            range: "600 ft.",
          },
          {
            name: "low-light vision",
            range: null,
          },
          {
            name: "mistsight",
            range: null,
          },
          {
            name: "tremorsense",
            range: "300 ft.",
          },
        ],
        perception: 34,
      },
    ],
    [
      "darkvision 60 ft.; Perception -1",
      { senses: [{ name: "darkvision", range: "60 ft." }], perception: -1 },
    ],
  ])("parseSenses(%j)", (input, expected) => {
    const res = parseSenses(input);

    expect(res).toStrictEqual(expected);
  });
});

describe("details: more cases", () => {
  test("parseSenses works with only a Perception score", () => {
    expect(parseSenses("Perception +5")).toStrictEqual({ senses: [], perception: 5 });
  });

  test("parseSenses reads a negative Perception written with an en dash", () => {
    expect(parseSenses("darkvision 60 ft.; Perception \u20131")).toStrictEqual({
      senses: [{ name: "darkvision", range: "60 ft." }],
      perception: -1,
    });
  });

  test("parseSenses gives null when there is no Perception", () => {
    expect(parseSenses("darkvision 60 ft.")).toBeNull();
  });

  describe("classifyDetailLines", () => {
    test("finds the type line on its own", () => {
      expect(classifyDetailLines(["NG Large outsider (angel, extraplanar, good)"])).toStrictEqual({
        classLine: null,
        typeLine: "NG Large outsider (angel, extraplanar, good)",
      });
    });

    test("treats the line above the type line as the class line", () => {
      expect(
        classifyDetailLines(["Human fighter 3", "CN Medium humanoid (human)"]),
      ).toStrictEqual({ classLine: "Human fighter 3", typeLine: "CN Medium humanoid (human)" });
    });

    test.each([["N Small animal"], ["LE Huge dragon (fire)"], ["CG Tiny fey"]])(
      "recognises %j as a type line",
      (line) => {
        expect(classifyDetailLines([line]).typeLine).toBe(line);
      },
    );

    test("ignores blank lines", () => {
      expect(classifyDetailLines(["", " N Medium animal ", ""]).typeLine).toBe("N Medium animal");
    });

    test("returns nulls when nothing looks like a type line", () => {
      expect(classifyDetailLines(["garbage"])).toStrictEqual({ classLine: null, typeLine: null });
      expect(classifyDetailLines([])).toStrictEqual({ classLine: null, typeLine: null });
    });
  });
});
