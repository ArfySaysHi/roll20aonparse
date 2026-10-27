type Value = string | number | null | undefined;

export type NpcAttackKind = "melee" | "ranged";

export interface NpcAttackDerived {
  /** What the sheet prints for the attack, e.g. "slam  + 30 (2d8+13)". */
  atkdisplay: string;
  /** The roll template run when the attack is clicked. */
  multipleatk: string;
}

const str = (v: Value) => (v === null || v === undefined ? "" : String(v));
const int = (v: Value) => parseInt(str(v), 10) || 0;
const signedPrefix = (v: Value, plus: string) => (int(v) > 0 ? plus : "");

/**
 * Port of `calc_npc_attack` from the Pathfinder by Roll20 sheet worker.
 *
 * The sheet only runs it when an attack row is edited (or dropped from the compendium), so
 * rows written from outside have no `atkdisplay` / `multipleatk` and clicking them fails
 * until someone edits them. We compute the same values up front. The odd spacing in the
 * display string (e.g. "slam  + 30") is deliberate: it matches what the sheet itself writes.
 *
 * `fields` are the row's un-prefixed fields: atkname, atkmod, atkmod2..9, multipleatk_flag,
 * atkcritrange, dmgflag, dmgbase, dmgtype, dmgcritmulti, dmg2*, atkrange.
 */
export function npcAttackDerived(
  type: NpcAttackKind,
  fields: Record<string, Value>,
): NpcAttackDerived {
  const f = (name: string) => str(fields[name]);

  let display = f("atkname");
  display += ` ${signedPrefix(fields.atkmod, " + ")}${f("atkmod")}`;

  const dmgCritMulti = int(fields.dmgcritmulti) || 2;
  const dmg2CritMulti = int(fields.dmg2critmulti) || 1;

  // First attack
  let multi =
    "{{roll=[[1d20cs>@{atkcritrange}+@{atkmod}[MOD]+@{rollmod_attack}[QUERY]]]}}" +
    "{{critconfirm=[[1d20cs20+@{atkmod}[MOD]+@{rollmod_attack}[QUERY]]]}}";

  // Damage
  let sdmg1 = "";
  let scrit1 = "";
  let sdmg2 = "";
  let scrit2 = "";

  if (f("dmgflag") && f("dmgbase") && f("dmgflag") !== "0") {
    sdmg1 = `[[${f("dmgbase")} + @{rollmod_damage}[QUERY]]]`;
    multi += `{{rolldmg1=${sdmg1}}}{{rolldmg1type=@{dmgtype}}}`;

    if (dmgCritMulti > 1) {
      const sum = Array.from({ length: dmgCritMulti }, () => f("dmgbase")).join(" + ");
      scrit1 = `[[(${sum}) + (@{rollmod_damage}[QUERY]*${dmgCritMulti})]]`;
      multi += `{{rolldmg1crit=${scrit1}}}`;
    }
  }

  if (f("dmg2flag") && f("dmg2base") && f("dmg2flag") !== "0") {
    sdmg2 = `[[${f("dmg2base")} + @{rollmod_damage}[QUERY]]]`;
    multi += `{{rolldmg2=${sdmg2}}} {{rolldmg2type=@{dmg2type}}}`;

    if (dmg2CritMulti > 1) {
      const sum = Array.from({ length: dmg2CritMulti }, () => f("dmg2base")).join(" + ");
      scrit2 = `[[(${sum}) + (@{rollmod_damage}[QUERY] * ${dmg2CritMulti})]]`;
      multi += `{{rolldmg2crit=${scrit2}}}`;
    }
  }

  // Iterative attacks
  if ((f("multipleatk_flag") || "0") === "1") {
    for (let i = 2; i < 10; i++) {
      const mod = fields[`atkmod${i}`];
      if (!f(`atkmod${i}`)) continue;

      display += `/${signedPrefix(mod, "+")}${f(`atkmod${i}`)}`;
      multi +=
        `{{roll${i - 1}=[[1d20cs>@{atkcritrange} + @{atkmod${i}}[MOD] + @{rollmod_attack}[QUERY]]]}} ` +
        `{{critconfirm${i - 1}=[[1d20cs20 + @{atkmod${i}}[MOD] + @{rollmod_attack}[QUERY]]]}}`;

      if (sdmg1) {
        multi += `{{roll${i - 1}dmg1=${sdmg1}}} {{roll${i - 1}dmg1type=${f("dmgtype")}}}`;
        if (dmgCritMulti > 1) multi += `{{roll${i - 1}dmg1crit=${scrit1}}}`;
      }

      if (f("dmg2flag") === "1") {
        multi += `{{roll${i - 1}dmg2=${sdmg2}}} {{roll${i - 1}dmg2type=${f("dmg2type")}}}`;
        if (dmg2CritMulti > 1) multi += `{{roll${i - 1}dmg2crit=${scrit2}}}`;
      }
    }
  }

  if (type === "ranged" && f("atkrange")) display += ` ${f("atkrange")}`;

  // Damage summary, e.g. "(1d8+3/19-20/x3 fire)"
  if ((f("dmgflag") || "0") !== "0" || (f("dmg2flag") || "0") !== "0") {
    let dmg1 = "";
    let dmg2 = "";

    if ((f("dmgflag") || "0") !== "0") {
      dmg1 += f("dmgbase");
      if ((int(fields.atkcritrange) || 20) < 20) dmg1 += `/${f("atkcritrange")}-20`;
      if ((int(fields.dmgcritmulti) || 2) !== 2) dmg1 += `/x${f("dmgcritmulti")}`;
      if (f("dmgtype") !== "") dmg1 += ` ${f("dmgtype")}`;
    }

    if ((f("dmg2flag") || "0") !== "0") {
      if (f("dmg2base").trim() !== "0") dmg2 += f("dmg2base");
      if (f("dmg2type") !== "") dmg2 += ` ${f("dmg2type")}`;
      if ((int(fields.dmg2critmulti) || 1) !== 1) dmg2 += `/x${f("dmg2critmulti")}`;
    }

    const dmg = `${dmg1}${dmg2.length > 0 ? ", " : ""}${dmg2}`;
    if (dmg.length > 0) display += ` (${dmg})`;
  }

  return { atkdisplay: display, multipleatk: multi };
}
