import { describe, test, expect } from "vitest";
import {
  normalize,
  splitTopLevel,
  splitTopLevelOnWord,
  trimTrailing,
} from "../../src/shared/strings";

describe("splitTopLevel", () => {
  test("splits on the delimiter", () => {
    expect(splitTopLevel("a, b, c")).toEqual(["a", "b", "c"]);
  });

  test("ignores delimiters inside parentheses", () => {
    expect(splitTopLevel("Stealth +8 (+12 in shadows, +4 in fog), Perception +5")).toEqual([
      "Stealth +8 (+12 in shadows, +4 in fog)",
      "Perception +5",
    ]);
  });

  test("handles nested parentheses", () => {
    expect(splitTopLevel("a (b (c, d), e), f")).toEqual(["a (b (c, d), e)", "f"]);
  });

  test("supports other delimiters", () => {
    expect(splitTopLevel("cleric 7/fighter 2", "/")).toEqual(["cleric 7", "fighter 2"]);
  });

  test("drops empty segments", () => {
    expect(splitTopLevel("a,, b,")).toEqual(["a", "b"]);
    expect(splitTopLevel("")).toEqual([]);
  });

  test("survives an unbalanced closing paren", () => {
    expect(splitTopLevel("a), b")).toEqual(["a)", "b"]);
  });
});

describe("splitTopLevelOnWord", () => {
  test("splits on a whole word", () => {
    expect(splitTopLevelOnWord("bite +5 (1d6) or claw +3 (1d4)", "or")).toEqual([
      "bite +5 (1d6)",
      "claw +3 (1d4)",
    ]);
  });

  test("ignores the word inside parentheses", () => {
    expect(splitTopLevelOnWord("slam +10 (2d6 or 3d6 fire) or bite +5", "or")).toEqual([
      "slam +10 (2d6 or 3d6 fire)",
      "bite +5",
    ]);
  });

  test("does not match the word inside longer words", () => {
    expect(splitTopLevelOnWord("mwk sword +5 (1d8) or dagger +4 (1d4)", "or")).toEqual([
      "mwk sword +5 (1d8)",
      "dagger +4 (1d4)",
    ]);
    expect(splitTopLevelOnWord("horror claw +5 (1d4)", "or")).toEqual(["horror claw +5 (1d4)"]);
  });

  test("is case-insensitive", () => {
    expect(splitTopLevelOnWord("a OR b", "or")).toEqual(["a", "b"]);
  });

  test("returns the whole string when the word is absent", () => {
    expect(splitTopLevelOnWord("bite +5 (1d6)", "or")).toEqual(["bite +5 (1d6)"]);
  });
});

describe("normalize", () => {
  test("flattens dashes, quotes and the multiplication sign", () => {
    expect(normalize("19\u201320/\u00d73 \u2013 the solar\u2019s")).toBe("19-20/x3 - the solar's");
  });

  test("closes the gap in signed numbers and strips footnote marks", () => {
    expect(normalize("claw + 5 (1d4/19\u201320)*")).toBe("claw +5 (1d4/19-20)");
  });
});

describe("trimTrailing", () => {
  test.each([
    ["15/epic and evil;", "15/epic and evil"],
    ["+25,", "+25"],
    ["  34  ", "34"],
    ["a; ,", "a"],
  ])("trimTrailing(%j)", (input, expected) => {
    expect(trimTrailing(input)).toBe(expected);
  });
});
