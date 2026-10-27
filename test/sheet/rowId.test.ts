import { describe, test, expect } from "vitest";
import { makeRowId } from "../../src/sheet/rowId";

describe("makeRowId", () => {
  test("looks like a Roll20 row id: a dash then 19 URL-safe characters", () => {
    for (let i = 0; i < 50; i++) expect(makeRowId()).toMatch(/^-[-\w]{19}$/);
  });

  test("is deterministic for a given random source", () => {
    expect(makeRowId(() => 0)).toBe("-" + "0".repeat(19));
    expect(makeRowId(() => 0.999999)).toBe("-" + "z".repeat(19));
  });

  test("ids differ between calls", () => {
    expect(new Set(Array.from({ length: 100 }, () => makeRowId())).size).toBe(100);
  });
});
