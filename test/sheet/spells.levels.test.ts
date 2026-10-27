import { describe, test, expect } from "vitest";
import { spellRows } from "../../src/sheet/spells";
import { findSpell } from "../../src/spells/lookup";
import type { ResolvedSpells } from "../../src/spells/resolve";
import { loadFixture, loadSpellPage } from "../helpers";

describe("spellRows: per-level counts (what makes the sheet show a level)", () => {
  const plan = spellRows(loadFixture("lich"), null);

  test.each([
    [6, 3],
    [5, 4],
    [4, 5], // wall of ice (2) counts as two prepared copies
    [3, 6], // dispel magic (2), vampiric touch (2)
    [2, 7], // scorching ray (2)
    [1, 7], // magic missile (3), ray of enfeeblement (2), shield (2)
  ])("level %i has %i prepared spells", (level, count) => {
    expect(plan.flags[`caster1_spells_perday_level_${level}`]).toBe(count);
    expect(plan.flags[`caster1_spells_total_level_${level}`]).toBe(count);
    expect(plan.flags[`caster_spells_flag_level_${level}`]).toBe("1");
  });

  test("cantrips get their flag but no counts, like the sheet's own import", () => {
    expect(plan.flags.caster_spells_flag_level_0).toBe("1");
    expect(plan.flags.caster1_spells_total_level_0).toBeUndefined();
  });

  test("a spell prepared twice is still one row", () => {
    expect(plan.rows.filter((r) => r.section === "spell-4")).toHaveLength(4);
  });
});

describe("spellRows: metamagic", () => {
  const rows = spellRows(loadFixture("lich"), null).rows;
  const named = (name: string) => rows.find((r) => r.fields.spellname === name);

  test("keeps the metamagic in the row's name", () => {
    expect(named("Maximized Fireball")?.section).toBe("spell-6");
    expect(named("Quickened Magic Missile")?.section).toBe("spell-5");
    expect(named("Extended Mage Armor")?.section).toBe("spell-2");
  });

  test("a plain spell with the same base is a separate row", () => {
    expect(named("Fireball")?.section).toBe("spell-3");
  });

  test("details come from the base spell", () => {
    const fireball = loadSpellPage("spell-fireball");
    const resolver: ResolvedSpells = { get: (n) => findSpell(fireball, n), missed: [] };

    const withDetails = spellRows(loadFixture("lich"), resolver).rows;
    const maximized = withDetails.find((r) => r.fields.spellname === "Maximized Fireball")!.fields;

    expect(maximized).toMatchObject({
      spellschool: "evocation [fire]",
      spellarea: "20-ft.-radius spread",
      spelldmgtype: "fire",
    });
  });

  test("the resolved Nethys title is used for the base", () => {
    const bulls = loadSpellPage("spell-bulls-strength");
    const resolver: ResolvedSpells = { get: (n) => findSpell(bulls, n), missed: [] };

    const mummy = spellRows(loadFixture("mummy-lord"), resolver).rows;

    expect(mummy.some((r) => r.fields.spellname === "Bull's Strength")).toBe(true);
  });
});

describe("spellRows: the Mummy Lord's casting", () => {
  const plan = spellRows(loadFixture("mummy-lord"), null);

  test("a domain spell-like block becomes spell-like rows with a per-day count", () => {
    const touch = plan.rows.find((r) => r.fields.spellname === "Touch of Darkness")!;

    expect(touch.section).toBe("spell-like");
    expect(touch.fields).toMatchObject({ timesperday: "per-day", perday_max: 8, perday_qty: 8 });
    expect(String(touch.fields.rollcontent)).toContain("{{level=9}}");
  });

  test("keeps DCs and notes on prepared spells", () => {
    const divine = plan.rows.find((r) => r.fields.spellname === "Slay Living")!.fields;
    const align = plan.rows.find((r) => r.fields.spellname === "Align Weapon")!.fields;

    expect(divine.spelldc).toBe(21);
    expect(align.notes).toBe("evil only");
  });

  test("every level from 1 to 5 is switched on", () => {
    for (let level = 1; level <= 5; level++) {
      expect(plan.flags[`caster1_spells_total_level_${level}`]).toBeGreaterThan(0);
    }
  });

  test("reads without complaint", () => {
    expect(plan.warnings).toEqual([]);
  });
});
