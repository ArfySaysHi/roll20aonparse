import { describe, test, expect } from "vitest";
import {
  parseDistance,
  parseModifier,
  parseModifierPlusNotes,
} from "../../../../src/parser/values/fields/shared";

describe("shared parsing", () => {
  test.each([
    ["+8;", 8],
    ["-3;", -3],
    ["6;", 6],
    ["2", 2],
  ])("parseModifier(%j)", (input, expected) => {
    const res = parseModifier(input);

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
  ])("parseModifierPlusNotes(%j)", (input, expected) => {
    const res = parseModifierPlusNotes(input);

    expect(res).toStrictEqual(expected);
  });

  test.each([
    ["15 ft.", { value: "15", unit: "ft" }],
    ["1 ft", { value: "1", unit: "ft" }],
    ["ft.", null],
  ])("parseDistance(%j)", (input, expected) => {
    const res = parseDistance(input);

    expect(res).toStrictEqual(expected);
  });
});

describe("shared parsing: typographic minus", () => {
  test("parseModifier reads an en dash as a minus sign", () => {
    expect(parseModifier("\u20131")).toBe(-1);
  });

  test("parseModifier gives null when there are no digits", () => {
    expect(parseModifier("\u2014")).toBeNull();
  });
});
