import { describe, test, expect } from "vitest";
import { splitMetamagic } from "../../src/spells/metamagic";

describe("splitMetamagic", () => {
  test.each([
    ["maximized fireball", "fireball", ["maximized"]],
    ["quickened magic missile", "magic missile", ["quickened"]],
    ["extended mage armor", "mage armor", ["extended"]],
    ["empowered maximized fireball", "fireball", ["empowered", "maximized"]],
    ["Maximized Fireball", "Fireball", ["maximized"]],
    ["fireball", "fireball", []],
    ["cure light wounds", "cure light wounds", []],
  ])("splitMetamagic(%j)", (input, base, metamagic) => {
    expect(splitMetamagic(input)).toEqual({ base, metamagic });
  });

  // these start with a word that is also a metamagic feat, but they are real spells
  test.each([["silent image"], ["persistent image"], ["solid fog"], ["still air"]])(
    "leaves the real spell %j alone",
    (name) => {
      expect(splitMetamagic(name)).toEqual({ base: name, metamagic: [] });
    },
  );

  test("never strips the last word", () => {
    expect(splitMetamagic("maximized")).toEqual({ base: "maximized", metamagic: [] });
  });
});
