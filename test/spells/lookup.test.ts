import { describe, test, expect } from "vitest";
import { findSpell, nethysSpellName, spellPageUrl } from "../../src/spells/lookup";
import { loadSpellPage } from "../helpers";

describe("nethysSpellName", () => {
  test.each([
    ["fireball", "fireball"],
    ["heal", "heal"],
    ["summon monster VII", "summon monster 7"],
    ["mass charm monster", "charm monster, mass"],
    ["greater dispel magic", "dispel magic, greater"],
    ["lesser restoration", "restoration, lesser"],
    ["greater restoration", "restoration, greater"],
    ["greater communal spell immunity", "spell immunity, greater communal"],
    ["Mass Cure Light Wounds", "Cure Light Wounds, Mass"],
    // already in Nethys form
    ["Cure Light Wounds, Mass", "Cure Light Wounds, Mass"],
    // a modifier word on its own isn't a spell
    ["greater", "greater"],
    ["  mass   charm  monster ", "charm monster, mass"],
  ])("nethysSpellName(%j)", (input, expected) => {
    expect(nethysSpellName(input)).toBe(expected);
  });
});

describe("spellPageUrl", () => {
  test("builds an encoded aonprd.com url from the Nethys title", () => {
    expect(spellPageUrl("mass cure light wounds")).toBe(
      "https://aonprd.com/SpellDisplay.aspx?ItemName=cure%20light%20wounds%2C%20mass",
    );
    expect(spellPageUrl("fireball")).toBe("https://aonprd.com/SpellDisplay.aspx?ItemName=fireball");
  });
});

describe("findSpell", () => {
  test("picks the exact spell out of a family", () => {
    const spells = loadSpellPage("spell-immunity-greater");

    expect(findSpell(spells, "Spell Immunity, Greater")?.levels[0]).toEqual({
      class: "cleric",
      level: 8,
    });
    expect(findSpell(spells, "spell immunity")?.name).toBe("Spell Immunity");
  });

  test("translates statblock names before matching", () => {
    expect(
      findSpell(loadSpellPage("spell-cure-light-wounds-mass"), "mass cure light wounds")?.name,
    ).toBe("Cure Light Wounds, Mass");
  });

  test("picks Fireball, not Controlled Fireball, from the Fireball page", () => {
    expect(findSpell(loadSpellPage("spell-fireball"), "fireball")?.name).toBe("Fireball");
  });

  test("returns null rather than a near miss", () => {
    expect(findSpell(loadSpellPage("spell-fireball"), "delayed blast fireball")).toBeNull();
    expect(findSpell(loadSpellPage("spell-immunity-greater"), "greater communal spell")).toBeNull();
    expect(findSpell([], "fireball")).toBeNull();
  });
});
