import { SPELL_LABELS, type SpellLabels } from "./spellLabels";

type Value = string | number | null | undefined;

/** "like" for spell-like abilities, otherwise the spell's level (0-9). */
export type SpellKind = "like" | number;

export interface SpellCalcContext {
  /** Caster level of the spell-like block; the sheet prints it in the roll's header. */
  caster2_level?: string;
  caster1_flag?: string;
  caster2_flag?: string;
  caster1_class?: string;
  caster2_class?: string;
}

const PER_PERIOD = ["per-hour", "per-day", "per-week", "per-month", "per-year"];

/**
 * Roll templates end a field at "}}", so text that contains one (a spell description, say) would
 * cut the macro short and spill the rest into the chat. A space between the braces is enough.
 */
const macroText = (v: string) => v.replace(/\}\}/g, "} }");

const str = (v: Value) => (v === null || v === undefined ? "" : String(v));

/**
 * Port of the sheet's `calc_spell`, restricted to NPCs (`npc == "1"`).
 *
 * The sheet runs it when a spell row is edited or dropped from the compendium, so rows written
 * from outside have no `spelldisplay`, `spelldc` or roll macro (`rollcontent`) and fail when
 * clicked. The sheet's PC-only branches (armor spell failure, concentration, multiclass
 * save DCs, notes) can't happen for an NPC and are left out.
 *
 * @param row the row's fields without the `repeating_spell-<kind>_<id>_` prefix
 * @returns the derived fields, likewise without the prefix
 */
export function calcNpcSpell(
  kind: SpellKind,
  row: Record<string, Value>,
  context: SpellCalcContext = {},
  labels: SpellLabels = SPELL_LABELS,
): Record<string, string | number> {
  const f = (name: string) => str(row[name]);
  const update: Record<string, string | number> = {};

  const atkflag = f("spellatkflag") || "0";
  let atktype = f("spellatktype") || "0";
  let atkmod = f("spellatkmod") || "0";
  const atkcritrange = parseInt(f("spellatkcritrange"), 10) || 20;
  const dmgflag = f("spelldmgflag") || "0";
  let dmgbase = f("spelldmg") || "0";
  if (!dmgbase.length) dmgbase = "0";
  const dmgcritmulti = parseInt(f("spelldmgcritmulti"), 10) || 1;
  const dmgtype = f("spelldmgtype");
  const dmg2flag = f("spelldmg2flag") || "0";
  const dmg2name = f("spelldmg2name") || labels.damage2;
  let dmg2base = f("spelldmg2") || "0";
  if (!dmg2base.length) dmg2base = "0";
  const dmg2type = f("spelldmg2type");
  let cster = f("spellcaster") || "1";
  const csterflag1 = context.caster1_flag || "0";
  const csterflag2 = context.caster2_flag || "0";

  // == Display
  if (kind === "like") {
    const times = f("timesperday") || "at-will";

    if (times === "every-hours") {
      update.spelldisplay = `${f("spellname")} — ${labels["every-hours"].replace("X", f("perday_max") || "1")}`;
      update.spellprepared = 0;
    } else {
      update.spelldisplay = `${f("spellname")} — ${(labels as Record<string, string>)[times]}`;
      update.spellprepared = PER_PERIOD.includes(times) ? 1 : 0;
    }
  } else {
    update.spelldisplay = f("spellname") || "???";

    update.spellcaster1_class =
      csterflag1 === "1" && context.caster1_class ? context.caster1_class : " ";
    update.spellcaster2_class =
      csterflag2 === "1" && context.caster2_class ? context.caster2_class : " ";

    if (csterflag1 === "1" && csterflag2 === "1") {
      update["spellmulticasters-flag"] = 1;
    } else {
      update["spellmulticasters-flag"] = 0;
      if (csterflag1 === "1") {
        update.spellcaster = 1;
        cster = "1";
      } else if (csterflag2 === "1") {
        update.spellcaster = 2;
        cster = "2";
      }
    }
  }

  // An NPC's save DC is whatever the statblock says, not derived from the caster.
  const savedc = parseInt(f("spelldc_mod"), 10) || 0;

  // == Roll macro
  let rollbase =
    `@{whispertype} &{template:npc}{{name=${macroText(f("spellname"))}}}{{type=spell}}` +
    `{{showchar=@{rollshowchar}}}{{charname=@{character_name}}}{{nonlethal=[[1[Nonlethal]]]}}`;

  if (kind === "like") rollbase += `{{level=${context.caster2_level ?? ""}}}`;
  else rollbase += `{{level=${kind}}}`;

  if (kind === "like" && f("spelltype")) rollbase += `{{powertype=${f("spelltype")}}}`;
  if (f("spellschool")) rollbase += `{{school=${f("spellschool")}}}`;
  if (f("spellcastingtime")) rollbase += `{{castingtime=${f("spellcastingtime")}}}`;
  if (kind !== "like" && f("spellcomponent")) rollbase += `{{component=${f("spellcomponent")}}}`;
  if (f("spellrange")) rollbase += `{{range=${f("spellrange")}}}`;
  if (f("spellarea")) rollbase += `{{area=${f("spellarea")}}}`;
  if (f("spelltargets")) rollbase += `{{targets=${f("spelltargets")}}}`;
  if (f("spelleffect")) rollbase += `{{effect=${f("spelleffect")}}}`;
  if (f("spellduration")) rollbase += `{{duration=${f("spellduration")}}}`;

  if (f("spellsaveflag") && f("spellsaveflag") !== "0") {
    rollbase += `{{save=1}} {{savedc=[[${savedc}]]}}{{saveeffect=${f("spellsave")}}}`;
  }

  if (f("spellresistanceflag") && f("spellresistanceflag") !== "0") {
    rollbase += `{{sr=1}} {{spellresistance=${f("spellresistance")}}}`;
  }

  if (f("spelldescflag") && f("spelldescflag") !== "0") {
    rollbase += `{{descflag=[[1]]}} {{desc=${macroText(f("spelldesc"))}}}`;
  }

  // attack roll. The sheet looks the label up under a key that never matches, which always
  // yields "", so the label in brackets is empty. Reproduced as-is.
  if (atkflag !== "0") {
    if (atktype !== "0") atktype = `@{${atktype}_mod}`;
    if (atkmod.length === 0) atkmod = "0";

    rollbase +=
      `${atkflag}{{roll=[[1d20cs>${atkcritrange}+${atktype}[]+${atkmod}[MOD]` +
      `+(@{attack_bonus})[TEMP]+(@{attack_condition})[CONDITION]+@{rollmod_attack}[QUERY]]]}}`;
    rollbase +=
      `{{critconfirm=[[1d20cs20+${atktype}[]+${atkmod}[MOD]` +
      `+(@{attack_bonus})[TEMP]+(@{attack_condition})[CONDITION]+@{rollmod_attack}[QUERY]` +
      `+@{critconfirm_bonus}[CRIT CONFIRM BONUS]]]}}`;
  }

  // damage
  if (dmgflag !== "0" || dmg2flag !== "0") {
    if (dmgflag !== "0") {
      rollbase += `${dmgflag} {{dmg1=[[${dmgbase} + @{damage_bonus}[TEMP] + @{rollmod_damage}[QUERY]]]}} {{dmg1type=${dmgtype}}}`;

      if (atkflag !== "0" && dmgcritmulti > 1) {
        const sum = Array.from({ length: dmgcritmulti }, () => dmgbase).join(" + ");
        rollbase += `{{dmg1crit=[[(${sum}) + (@{rollmod_damage} * ${dmgcritmulti})[QUERY]]]}}`;
      }
    }

    if (dmg2flag !== "0") {
      rollbase += `{{dmg2name=${dmg2name}}}`;
      rollbase += `${dmg2flag} {{dmg2=[[${dmg2base} + @{damage_bonus}[TEMP] + @{rollmod_damage}[QUERY]]]}} {{dmg2type=${dmg2type}}}`;

      if (atkflag !== "0" && dmgcritmulti > 1) {
        const sum = Array.from({ length: dmgcritmulti }, () => dmg2base).join(" + ");
        rollbase += `{{dmg2crit=[[(${sum}) + (@{rollmod_damage} * ${dmgcritmulti})[QUERY]]]}}`;
      }
    }
  }

  void cster; // only used by the PC branches we dropped; kept so the flow matches the original

  update.spelldc = savedc;
  update.rollcontent = rollbase;

  return update;
}
