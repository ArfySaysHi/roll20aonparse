import { test, expect, describe, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { findNpcNodes } from "../../../src/parser/dom/nodes";

const flavour =
  "This towering humanoid creature has shining topaz eyes, metallic skin, and three pairs of white wings.";

describe("findNpcNodes", () => {
  let statblock: Document;

  beforeEach(() => {
    const file = readFileSync("./fixtures/solar.html");
    const parser = new DOMParser();
    const doc = parser.parseFromString(file.toString(), "text/html");

    statblock = doc;
  });

  test("gets the name of the fixture", () => {
    const result = findNpcNodes(statblock);
    expect(result.name?.textContent).toBe("Angel, Solar");
  });

  test("gets the flavour of the fixture", () => {
    const result = findNpcNodes(statblock);
    expect(result.flavour?.textContent).toBe(flavour);
  });

  test("gets the details of the fixture", () => {
    const result = findNpcNodes(statblock);
    const thisSectionHeader = result.details?.at(0)?.textContent?.trim();
    const nextSectionHeader = result.details?.at(-1)?.nextSibling?.textContent?.trim();

    expect(thisSectionHeader).toBe("Solar CR 23");
    expect(nextSectionHeader).toBe("Defense");
  });

  test("gets the defenses of the fixture", () => {
    const result = findNpcNodes(statblock);
    const thisSectionHeader = result.defense?.at(0)?.textContent?.trim();
    const nextSectionHeader = result.defense?.at(-1)?.nextSibling?.textContent?.trim();

    expect(thisSectionHeader).toBe("Defense");
    expect(nextSectionHeader).toBe("Offense");
  });

  test("gets the offenses of the fixture", () => {
    const result = findNpcNodes(statblock);
    const thisSectionHeader = result.offense?.at(0)?.textContent?.trim();
    const nextSectionHeader = result.offense?.at(-1)?.nextSibling?.textContent?.trim();

    expect(thisSectionHeader).toBe("Offense");
    expect(nextSectionHeader).toBe("Statistics");
  });

  test("gets the statistics of the fixture", () => {
    const result = findNpcNodes(statblock);
    const thisSectionHeader = result.statistics?.at(0)?.textContent?.trim();
    const nextSectionHeader = result.statistics?.at(-1)?.nextSibling?.textContent?.trim();

    expect(thisSectionHeader).toBe("Statistics");
    expect(nextSectionHeader).toBe("Ecology");
  });

  test("gets the ecology of the fixture", () => {
    const result = findNpcNodes(statblock);
    const thisSectionHeader = result.ecology?.at(0)?.textContent?.trim();
    const nextSectionHeader = result.ecology?.at(-1)?.nextSibling?.textContent?.trim();

    expect(thisSectionHeader).toBe("Ecology");
    expect(nextSectionHeader).toBe("Special Abilities");
  });

  test("gets the special abilities of the fixture", () => {
    const result = findNpcNodes(statblock);
    const thisSectionHeader = result.specialAbilities?.at(0)?.textContent?.trim();
    const nextSectionHeader = result.specialAbilities?.at(-1)?.nextSibling?.textContent?.trim();

    expect(thisSectionHeader).toBe("Special Abilities");
    expect(nextSectionHeader).toBe("Description");
  });

  test("gets the description of the fixture", () => {
    const result = findNpcNodes(statblock);
    const thisSectionHeader = result.description?.at(0)?.textContent?.trim();
    const nextSectionHeader = result.description?.at(-1)?.nextSibling?.textContent?.trim();

    expect(thisSectionHeader).toBe("Description");
    expect(nextSectionHeader).toBe('Creatures in "Angel" Category');
  });
});
