import { describe, test, expect } from "vitest";
import { calcNpcSpell } from "../../src/sheet/calcSpell";
import { SPELL_LABELS } from "../../src/sheet/spellLabels";

// Behaviour was checked against the sheet's own `calc_spell` (NPC rows) on a range of inputs.

describe("calcNpcSpell: spell-like abilities", () => {
  const ctx = { caster2_level: "20" };

  test("display uses the frequency label, and per-period frequencies are 'prepared'", () => {
    expect(calcNpcSpell("like", { spellname: "Heal", timesperday: "per-day" }, ctx)).toMatchObject({
      spelldisplay: `Heal — ${SPELL_LABELS["per-day"]}`,
      spellprepared: 1,
    });
    expect(
      calcNpcSpell("like", { spellname: "True Seeing", timesperday: "constant" }, ctx),
    ).toMatchObject({
      spelldisplay: `True Seeing — ${SPELL_LABELS.constant}`,
      spellprepared: 0,
    });
  });

  test("a missing frequency means at will", () => {
    expect(calcNpcSpell("like", { spellname: "Aid" }, ctx).spelldisplay).toBe(
      `Aid — ${SPELL_LABELS["at-will"]}`,
    );
  });

  test("every-N-hours puts the number into the label", () => {
    expect(
      calcNpcSpell("like", { spellname: "Odd", timesperday: "every-hours", perday_max: "4" }, ctx),
    ).toMatchObject({ spelldisplay: "Odd — every 4 hours", spellprepared: 0 });
  });

  test("the roll header carries the spell-like caster level, and there is no component line", () => {
    const { rollcontent } = calcNpcSpell(
      "like",
      { spellname: "Heal", spellcomponent: "V, S" },
      ctx,
    );

    expect(rollcontent).toContain("{{level=20}}");
    expect(rollcontent).not.toContain("{{component=");
  });

  test("an NPC's DC is the statblock's own number", () => {
    expect(
      calcNpcSpell("like", { spellname: "Discern Lies", spelldc_mod: "21" }, ctx).spelldc,
    ).toBe(21);
    expect(calcNpcSpell("like", { spellname: "Aid" }, ctx).spelldc).toBe(0);
  });
});

describe("calcNpcSpell: spells by level", () => {
  test("display is the plain spell name, and the level goes in the header", () => {
    const result = calcNpcSpell(3, { spellname: "Fireball", spellcomponent: "V, S" });

    expect(result.spelldisplay).toBe("Fireball");
    expect(result.rollcontent).toContain("{{level=3}}");
    expect(result.rollcontent).toContain("{{component=V, S}}");
    expect(result).toMatchObject({ "spellmulticasters-flag": 0 });
  });

  test("an unnamed spell shows ???", () => {
    expect(calcNpcSpell(1, {}).spelldisplay).toBe("???");
  });

  test("includes save, spell resistance and description when flagged", () => {
    const { rollcontent } = calcNpcSpell(3, {
      spellname: "Fireball",
      spellsaveflag: "{{save=1}}",
      spellsave: "Reflex half",
      spelldc_mod: "24",
      spellresistanceflag: "{{sr=1}}",
      spellresistance: "yes",
      spelldescflag: "{{descflag=[[1]]}}",
      spelldesc: "Boom.",
    });

    expect(rollcontent).toContain("{{save=1}} {{savedc=[[24]]}}{{saveeffect=Reflex half}}");
    expect(rollcontent).toContain("{{sr=1}} {{spellresistance=yes}}");
    expect(rollcontent).toContain("{{descflag=[[1]]}} {{desc=Boom.}}");
  });

  test("leaves those out when the flags are off", () => {
    const { rollcontent } = calcNpcSpell(3, {
      spellname: "X",
      spellsaveflag: "0",
      spellresistanceflag: "0",
      spelldescflag: "0",
    });

    expect(rollcontent).not.toContain("{{save=1}}");
    expect(rollcontent).not.toContain("{{sr=1}}");
    expect(rollcontent).not.toContain("{{desc=");
  });

  test("an attack adds the roll and the crit confirmation, with an empty label like the sheet", () => {
    const { rollcontent } = calcNpcSpell(1, {
      spellname: "Scorching Ray",
      spellatkflag: "{{attack=1}}",
      spellatktype: "ranged",
    });

    expect(rollcontent).toContain("{{attack=1}}{{roll=[[1d20cs>20+@{ranged_mod}[]+0[MOD]+");
    expect(rollcontent).toContain("{{critconfirm=[[1d20cs20+@{ranged_mod}[]+0[MOD]+");
  });

  test("damage adds a dmg1 roll; a crit multiplier only matters on attack spells", () => {
    const damage = {
      spellname: "X",
      spelldmgflag: "{{damage=1}} {{dmg1flag=1}}",
      spelldmg: "4d6",
      spelldmgtype: "fire",
      spelldmgcritmulti: "2",
    };

    const noAttack = calcNpcSpell(1, damage).rollcontent as string;
    expect(noAttack).toContain(
      "{{dmg1=[[4d6 + @{damage_bonus}[TEMP] + @{rollmod_damage}[QUERY]]]}} {{dmg1type=fire}}",
    );
    expect(noAttack).not.toContain("dmg1crit");

    const withAttack = calcNpcSpell(1, {
      ...damage,
      spellatkflag: "{{attack=1}}",
      spellatktype: "melee",
    }).rollcontent as string;
    expect(withAttack).toContain("{{dmg1crit=[[(4d6 + 4d6) + (@{rollmod_damage} * 2)[QUERY]]]}}");
  });

  test("a second damage line is labelled", () => {
    const { rollcontent } = calcNpcSpell(5, {
      spellname: "Ice Storm",
      spelldmg2flag: "{{damage=1}} {{dmg2flag=1}}",
      spelldmg2: "2d6",
      spelldmg2type: "cold",
      spelldmg2name: "Cold",
    });

    expect(rollcontent).toContain("{{dmg2name=Cold}}");
    expect(rollcontent).toContain(
      "{{dmg2=[[2d6 + @{damage_bonus}[TEMP] + @{rollmod_damage}[QUERY]]]}} {{dmg2type=cold}}",
    );
  });

  test("the roll starts with the sheet's NPC template header", () => {
    expect(calcNpcSpell(0, { spellname: "Light" }).rollcontent).toBe(
      "@{whispertype} &{template:npc}{{name=Light}}{{type=spell}}{{showchar=@{rollshowchar}}}" +
        "{{charname=@{character_name}}}{{nonlethal=[[1[Nonlethal]]]}}{{level=0}}",
    );
  });
});

describe("calcNpcSpell: labels", () => {
  test("labels can be swapped without touching the logic", () => {
    const labels = { ...SPELL_LABELS, "per-day": "/day" };

    expect(
      calcNpcSpell("like", { spellname: "Heal", timesperday: "per-day" }, {}, labels).spelldisplay,
    ).toBe("Heal — /day");
  });
});

describe("calcNpcSpell: text that would break the roll template", () => {
  test("a description containing }} can't close the macro early", () => {
    const { rollcontent } = calcNpcSpell(
      3,
      { spellname: "Odd", spelldescflag: "{{descflag=[[1]]}}", spelldesc: "ends here}} {{injected=1" },
      {},
    );

    expect(rollcontent).not.toContain("here}}");
    expect(rollcontent).toContain("{{desc=ends here} } {{injected=1}}");
  });

  test("ordinary descriptions are untouched", () => {
    const { rollcontent } = calcNpcSpell(
      3,
      { spellname: "Fine", spelldescflag: "{{descflag=[[1]]}}", spelldesc: "Deals [[1d6]] damage." },
      {},
    );

    expect(rollcontent).toContain("{{desc=Deals [[1d6]] damage.}}");
  });
});
