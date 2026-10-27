import { describe, test, expect } from "vitest";
import { resolveSkill } from "../../src/sheet/skills";

describe("resolveSkill", () => {
  test.each([
    ["Stealth", { key: "stealth", subject: null }],
    ["Sense Motive", { key: "sense_motive", subject: null }],
    ["Use Magic Device", { key: "use_magic_device", subject: null }],
    ["Sleight of Hand", { key: "sleight_of_hand", subject: null }],
    ["Knowledge (history)", { key: "knowledge_history", subject: null }],
    ["Knowledge (Planes)", { key: "knowledge_planes", subject: null }],
    ["Craft (any one)", { key: "craft", subject: "any one" }],
    ["Perform (dance)", { key: "perform", subject: "dance" }],
    ["Profession (sailor)", { key: "profession", subject: "sailor" }],
  ])("resolveSkill(%j)", (name, expected) => {
    expect(resolveSkill(name)).toStrictEqual(expected);
  });

  test.each([["Knowledge (all)"], ["Knowledge"], ["Underwater Basket Weaving"], [""]])(
    "gives null for %j",
    (name) => {
      expect(resolveSkill(name)).toBeNull();
    },
  );
});
