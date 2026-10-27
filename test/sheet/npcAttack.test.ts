import { describe, test, expect } from "vitest";
import { npcAttackDerived } from "../../src/sheet/npcAttack";

describe("npcAttackDerived", () => {
  test("a single attack with damage", () => {
    expect(
      npcAttackDerived("melee", {
        atkname: "slam",
        atkmod: 30,
        atkcritrange: 20,
        dmgflag: 1,
        dmgbase: "2d8+13",
        dmgtype: "",
        dmgcritmulti: 2,
      }),
    ).toEqual({
      atkdisplay: "slam  + 30 (2d8+13)",
      multipleatk:
        "{{roll=[[1d20cs>@{atkcritrange}+@{atkmod}[MOD]+@{rollmod_attack}[QUERY]]]}}" +
        "{{critconfirm=[[1d20cs20+@{atkmod}[MOD]+@{rollmod_attack}[QUERY]]]}}" +
        "{{rolldmg1=[[2d8+13 + @{rollmod_damage}[QUERY]]]}}{{rolldmg1type=@{dmgtype}}}" +
        "{{rolldmg1crit=[[(2d8+13 + 2d8+13) + (@{rollmod_damage}[QUERY]*2)]]}}",
    });
  });

  test("iterative attacks add a roll (and damage) per extra bonus", () => {
    const { atkdisplay, multipleatk } = npcAttackDerived("melee", {
      atkname: "sword",
      atkmod: 18,
      multipleatk_flag: 1,
      atkmod2: 13,
      atkmod3: 8,
      dmgflag: 1,
      dmgbase: "2d6+9",
      dmgtype: "",
      dmgcritmulti: 2,
    });

    expect(atkdisplay).toBe("sword  + 18/+13/+8 (2d6+9)");
    expect(multipleatk).toContain("{{roll1=[[1d20cs>@{atkcritrange} + @{atkmod2}[MOD]");
    expect(multipleatk).toContain("{{roll2=[[1d20cs>@{atkcritrange} + @{atkmod3}[MOD]");
    expect(multipleatk).toContain("{{roll2dmg1=[[2d6+9 + @{rollmod_damage}[QUERY]]]}}");
  });

  test("ignores atkmod2.. unless multipleatk_flag is 1", () => {
    const { atkdisplay } = npcAttackDerived("melee", { atkname: "x", atkmod: 5, atkmod2: 3 });

    expect(atkdisplay).toBe("x  + 5");
  });

  test("a negative bonus has no plus sign", () => {
    expect(npcAttackDerived("melee", { atkname: "x", atkmod: -2 }).atkdisplay).toBe("x -2");
  });

  test("shows crit range, multiplier and damage type in the summary", () => {
    expect(
      npcAttackDerived("melee", {
        atkname: "slam",
        atkmod: 9,
        atkcritrange: 19,
        dmgflag: 1,
        dmgbase: "10d6+5",
        dmgtype: "electricity",
        dmgcritmulti: 3,
      }).atkdisplay,
    ).toBe("slam  + 9 (10d6+5/19-20/x3 electricity)");
  });

  test("an attack with no damage has only the attack rolls", () => {
    const { atkdisplay, multipleatk } = npcAttackDerived("melee", { atkname: "grab", atkmod: 12 });

    expect(atkdisplay).toBe("grab  + 12");
    expect(multipleatk).not.toContain("rolldmg");
  });

  test("a ranged attack appends its range", () => {
    expect(
      npcAttackDerived("ranged", { atkname: "bow", atkmod: 5, atkrange: "100 ft." }).atkdisplay,
    ).toBe("bow  + 5 100 ft.");
    expect(
      npcAttackDerived("melee", { atkname: "bow", atkmod: 5, atkrange: "100 ft." }).atkdisplay,
    ).toBe("bow  + 5");
  });

  test("a zero bonus prints plainly", () => {
    expect(npcAttackDerived("melee", { atkname: "odd", atkmod: 0 }).atkdisplay).toBe("odd 0");
  });

  test("a missing damage type doesn't print 'undefined'", () => {
    const { atkdisplay, multipleatk } = npcAttackDerived("melee", {
      atkname: "x",
      atkmod: 5,
      multipleatk_flag: 1,
      atkmod2: 0,
      dmgflag: 1,
      dmgbase: "1d6",
    });

    expect(atkdisplay).not.toContain("undefined");
    expect(multipleatk).not.toContain("undefined");
  });

  test("second damage line", () => {
    expect(
      npcAttackDerived("melee", {
        atkname: "x",
        atkmod: 5,
        dmgflag: 1,
        dmgbase: "1d6",
        dmgtype: "",
        dmg2flag: 1,
        dmg2base: "1d6",
        dmg2type: "fire",
        dmg2critmulti: 2,
      }).atkdisplay,
    ).toBe("x  + 5 (1d6, 1d6 fire/x2)");
  });
});
