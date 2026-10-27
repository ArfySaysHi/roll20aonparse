import { describe, test, expect } from "vitest";
import { parseNethysUrl } from "../../src/shared/urls";

describe("parseNethysUrl", () => {
  test.each([
    "https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar",
    "https://www.aonprd.com/MonsterDisplay.aspx?ItemName=Solar",
    "  https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar  ",
  ])("accepts %j", (input) => {
    expect(parseNethysUrl(input)?.hostname).toMatch(/aonprd\.com$/);
  });

  test("upgrades http to https", () => {
    expect(parseNethysUrl("http://aonprd.com/MonsterDisplay.aspx?ItemName=Solar")?.href).toBe(
      "https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar",
    );
  });

  test.each([
    ["not a url"],
    [""],
    ["https://example.com/MonsterDisplay.aspx"],
    // lookalikes
    ["https://aonprd.com.evil.example/x"],
    ["https://evilaonprd.com/x"],
    ["https://aonprd.com@evil.example/x"],
    ["https://2e.aonprd.com/x"],
    // other schemes
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
    ["ftp://aonprd.com/x"],
  ])("rejects %j", (input) => {
    expect(parseNethysUrl(input)).toBeNull();
  });
});
