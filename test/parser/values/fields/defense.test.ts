import { describe, test, expect } from "vitest";
import {
  parseAc,
  parseDr,
  parseHp,
  parseImmune,
  parseResist,
  parseSave,
  parseSr,
  parseWeaknesses,
} from "../../../../src/parser/values/fields/defense";

describe("defense parsing", () => {
  test.each([
    [
      "16, touch 13, flat-footed 14 (+2 armor, +2 Dex, +1 shield, +1 size)",
      { ac: "16", touch: "13", flatFooted: "14", notes: "+2 armor, +2 Dex, +1 shield, +1 size" },
    ],
    [
      "44, touch 11, flat-footed 42 (+14 armor, +1 Dex, +1 dodge, +19 natural, –1 size; +4 deflection vs. evil)",
      {
        ac: "44",
        touch: "11",
        flatFooted: "42",
        notes: "+14 armor, +1 Dex, +1 dodge, +19 natural, –1 size; +4 deflection vs. evil",
      },
    ],
    [
      "12, touch 10, flat-footed 10",
      {
        ac: "12",
        touch: "10",
        flatFooted: "10",
        notes: null,
      },
    ],
  ])("parseAc(%j)", (input, expected) => {
    const res = parseAc(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    ["77 (7d8+42); fast healing 8", { hp: "77", hd: "7d8+42", notes: "fast healing 8" }],
    ["45 (6d8+18); regeneration 2", { hp: "45", hd: "6d8+18", notes: "regeneration 2" }],
    ["22 (3d8+9)", { hp: "22", hd: "3d8+9", notes: null }],
    ["4 (1d8)", { hp: "4", hd: "1d8", notes: null }],
    [
      "363 (22d10+242); regeneration 15 (evil artifacts, effects, and spells)",
      {
        hp: "363",
        hd: "22d10+242",
        notes: "regeneration 15 (evil artifacts, effects, and spells)",
      },
    ],
  ])("parseAc(%j)", (input, expected) => {
    const res = parseHp(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    ["+8,", { mod: 8, notes: null }],
    [
      "-3; +4 vs. poison, +4 resistance vs evil",
      { mod: -3, notes: "+4 vs. poison, +4 resistance vs evil" },
    ],
    ["6;", { mod: 6, notes: null }],
    ["2", { mod: 2, notes: null }],
  ])("parseSave(%j)", (input, expected) => {
    const res = parseSave(input);

    expect(res).toStrictEqual(expected);
  });
});

describe("defense: free-text fields", () => {
  test.each([
    [parseDr, "15/epic and evil;", "15/epic and evil"],
    [parseImmune, "acid, cold, petrification;", "acid, cold, petrification"],
    [parseResist, "electricity 10, fire 10;", "electricity 10, fire 10"],
    [parseWeaknesses, "vulnerable to fire", "vulnerable to fire"],
  ])("%o strips the trailing separator", (parser, input, expected) => {
    expect(parser(input)).toBe(expected);
  });

  test.each([
    ["34", 34],
    ["34;", 34],
    ["\u2014", null],
  ])("parseSr(%j)", (input, expected) => {
    expect(parseSr(input)).toBe(expected);
  });

  test("parseSave reads an en-dash negative", () => {
    expect(parseSave("\u20133; +4 vs. poison")).toStrictEqual({ mod: -3, notes: "+4 vs. poison" });
  });
});
