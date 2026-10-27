import type { Attack, SpellBlock } from "../parser/values/fields/offense";
import { ABILITIES, type AbilityName, type Npc, type Save } from "../parser/npc";
import { abilityModAttributes, type AbilityAttribute } from "./abilities";
import { npcAttackDerived, type NpcAttackKind } from "./npcAttack";
import { makeRowId } from "./rowId";
import { resolveSkill } from "./skills";
import type { AttributeWrite, SheetImport } from "./types";
import type { ResolvedSpells } from "../spells/resolve";
import type { CastingStatChoice } from "./castingStat";
import { spellRows, type SpellRows } from "./spells";

type Value = string | number | null | undefined;

const ABILITY_ATTRIBUTES: Record<AbilityName, AbilityAttribute> = {
  Str: "strength",
  Dex: "dexterity",
  Con: "constitution",
  Int: "intelligence",
  Wis: "wisdom",
  Cha: "charisma",
};

// The sheet allows up to nine iterative attack bonuses: atkmod, atkmod2 ... atkmod9.
const MAX_ITERATIVES = 9;
const DEFAULT_CRIT_RANGE = 20;
const DEFAULT_CRIT_MULTIPLIER = 2;

export interface ToSheetOptions {
  /** Row id source; swap it out for deterministic ids in tests. */
  newRowId?: () => string;
  /** Stat that prepared / known spells cast with, for spells the stat block gives no DC. */
  castingStat?: CastingStatChoice;
  spells?: ResolvedSpells | null;
}

function addSpells(sheet: SheetBuilder, plan: SpellRows) {
  for (const [name, value] of Object.entries(plan.flags)) sheet.set(name, value);
  for (const row of plan.rows) sheet.addRow(row.section, row.fields);
}

/** Maps a parsed NPC onto the attribute names the Roll20 Pathfinder 1 sheet expects. */
export function toSheet(npc: Npc, options: ToSheetOptions = {}): SheetImport {
  const sheet = new SheetBuilder(options.newRowId ?? makeRowId);

  addHeader(sheet, npc);
  addDefense(sheet, npc);
  addOffense(sheet, npc);
  addStatistics(sheet, npc);
  addEcology(sheet, npc);
  addSpecialAbilities(sheet, npc);

  const spellPlan = spellRows(npc, options.spells ?? null, { castingStat: options.castingStat });
  addSpells(sheet, spellPlan);

  return sheet.build(npc.name, [...npc.warnings, ...spellPlan.warnings]);
}

class SheetBuilder {
  private attributes = new Map<string, AttributeWrite>();
  private rowOrders: Record<string, string[]> = {};

  constructor(private newRowId: () => string) {}

  /** Skips null / undefined / blank values so we never overwrite a sheet default with nothing. */
  set(name: string, current: Value, max?: Value) {
    const c = text(current);
    const m = text(max);
    if (c === null && m === null) return;

    this.attributes.set(name, {
      name,
      ...(c !== null && { current: c }),
      ...(m !== null && { max: m }),
    });
  }

  addRow(section: string, fields: Record<string, Value>) {
    const id = this.newRowId();

    for (const [field, value] of Object.entries(fields)) {
      this.set(`repeating_${section}_${id}_${field}`, value);
    }

    (this.rowOrders[section] ??= []).push(id);
  }

  build(name: string, warnings: string[]): SheetImport {
    return {
      name,
      attributes: [...this.attributes.values()],
      rowOrders: this.rowOrders,
      warnings,
    };
  }
}

function text(value: Value): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function addHeader(sheet: SheetBuilder, npc: Npc) {
  sheet.set("npc", 1);
  sheet.set("npc_cr", npc.cr);
  sheet.set("xp", npc.xp);
  sheet.set("class", npc.classLine);
  sheet.set("npc_alignment", npc.alignment);
  sheet.set("size", npc.size?.toLowerCase());
  sheet.set("npc_type", npc.type && npc.subtypes ? `${npc.type} (${npc.subtypes})` : npc.type);
  sheet.set("initiative", npc.init);
  sheet.set(
    "senses",
    npc.senses.map((s) => [s.name, s.range].filter(Boolean).join(" ")).join(", "),
  );
  sheet.set("perception", npc.perception);
  sheet.set("aura", npc.aura);
}

function addDefense(sheet: SheetBuilder, npc: Npc) {
  sheet.set("ac", npc.ac?.ac);
  sheet.set("ac_touch", npc.ac?.touch);
  sheet.set("ac_flatfooted", npc.ac?.flatFooted);
  sheet.set("ac_notes", npc.ac?.notes);

  sheet.set("hp", npc.hp?.hp, npc.hp?.hp);
  sheet.set("hd", npc.hp?.hd);
  sheet.set("hp_notes", npc.hp?.notes);

  sheet.set("fortitude", npc.saves.fort?.mod);
  sheet.set("reflex", npc.saves.ref?.mod);
  sheet.set("will", npc.saves.will?.mod);
  sheet.set("saves_modifiers", saveNotes(Object.values(npc.saves)));

  sheet.set("sr", npc.sr);
  sheet.set("defensive_abilities", npc.defensiveAbilities);
  sheet.set("npc_dr", npc.dr);
  sheet.set("immune", npc.immune);
  sheet.set("resist", npc.resist);
  sheet.set("weaknesses", npc.weaknesses);
}

function saveNotes(saves: (Save | null)[]) {
  return saves
    .map((s) => s?.notes)
    .filter(Boolean)
    .join("; ");
}

function addOffense(sheet: SheetBuilder, npc: Npc) {
  sheet.set("npc_speed", npc.speed);
  sheet.set("space", npc.space);
  sheet.set("reach", npc.reach);

  sheet.set("specialattacks_flag", npc.specialAttacks.length ? 1 : 0);
  sheet.set("specialattacks_notes", npc.specialAttacks.join(", "));

  addAttacks(sheet, "melee", "meleeattacks_flag", npc.melee);
  addAttacks(sheet, "ranged", "rangedattacks_flag", npc.ranged);

  addCasting(sheet, npc.spellLikeAbilities, {
    flag: "spellabilities_flag",
    notes: "npc_spellabilities_notes",
    level: "caster2_level",
    concentration: "caster2_concentration",
  });
  addCasting(sheet, npc.spells, {
    flag: "spells_flag",
    notes: "npc_spells_notes",
    level: "caster1_level",
    concentration: "caster1_concentration",
  });
}

function addCasting(
  sheet: SheetBuilder,
  block: SpellBlock | null,
  names: { flag: string; notes: string; level: string; concentration: string },
) {
  if (!block) return;

  sheet.set(names.flag, 1);
  sheet.set(names.notes, block.body);
  sheet.set(names.level, block.casterLevel);
  sheet.set(names.concentration, block.concentration);
}

function addAttacks(
  sheet: SheetBuilder,
  kind: NpcAttackKind,
  flag: string,
  line: { attacks: Attack[]; unparsed: string[] },
) {
  const section = `npcatk-${kind}`;
  sheet.set(flag, line.attacks.length + line.unparsed.length > 0 ? 1 : 0);

  // The sheet only builds the click-to-roll macro (`multipleatk`) and label (`atkdisplay`) when a
  // row is edited, so compute them here or the attack fails until someone edits it.
  const row = (fields: Record<string, Value>) =>
    sheet.addRow(section, { ...fields, ...npcAttackDerived(kind, fields) });

  for (const attack of line.attacks) row(attackFields(attack));

  // Keep anything we couldn't read visible on the sheet instead of dropping it.
  for (const piece of line.unparsed) row({ atkname: piece, atkmod: 0, "options-flag": 0 });
}

export function attackFields(attack: Attack): Record<string, Value> {
  const count = attack.quantityRoll ?? (attack.quantity > 1 ? attack.quantity : null);
  const [first, ...rest] = attack.iteratives.slice(0, MAX_ITERATIVES);

  const fields: Record<string, Value> = {
    atkname: [count, attack.name].filter((p) => p !== null && p !== "").join(" "),
    "options-flag": 0,
    atkmod: first ?? 0,
    atkcritrange: attack.critRange ? parseInt(attack.critRange, 10) : DEFAULT_CRIT_RANGE,
    dmgtype: attack.damageType ?? "",
    dmgcritmulti: attack.critMultiplier ?? DEFAULT_CRIT_MULTIPLIER,
  };

  if (rest.length > 0) {
    fields.multipleatk_flag = 1;
    rest.forEach((mod, i) => (fields[`atkmod${i + 2}`] = mod));
  }

  if (attack.damage) {
    fields.dmgflag = 1;
    fields.dmgbase = attack.damage;
  }

  const description = [
    attack.attackNotes,
    attack.kind === "incorporeal" ? "incorporeal" : null,
    attack.touch ? "touch attack" : null,
    attack.additionalEffects,
    attack.restriction,
  ]
    .filter(Boolean)
    .join("; ");

  if (description) {
    fields.descflag = 1;
    fields.atkdesc = description;
  }

  return fields;
}

/**
 * BAB + ability *modifier* (not score). A BAB of 0 is a real value, so only a missing (null)
 * BAB or score skips the attribute.
 */
function addAttackMods(sheet: SheetBuilder, npc: Npc) {
  const { bab } = npc;
  const { Str, Dex } = npc.abilityScores;

  // A missing score (mindless, incorporeal) has a modifier of 0, like the sheet treats it.
  const modOf = (score: number | null) => (score === null ? 0 : Math.floor((score - 10) / 2));

  if (bab !== null) {
    sheet.set("ranged_mod", bab + modOf(Dex));
    sheet.set("melee_mod", bab + modOf(Str));
  }
}

function addStatistics(sheet: SheetBuilder, npc: Npc) {
  for (const ability of ABILITIES) {
    const attribute = ABILITY_ATTRIBUTES[ability];
    const score = npc.abilityScores[ability];

    // The sheet shows "-" for a missing score (mindless Int, undead Con)...
    sheet.set(attribute, score ?? "-");

    // ...and derives the modifiers itself only when a score is edited, so write them here.
    for (const [name, value] of Object.entries(abilityModAttributes(attribute, score))) {
      sheet.set(name, value);
    }
  }

  sheet.set("bab", npc.bab);
  sheet.set("cmb_mod", npc.cmb?.value);
  sheet.set("cmb_notes", npc.cmb?.notes);
  sheet.set("cmd_mod", npc.cmd?.value);
  sheet.set("cmd_notes", npc.cmd?.notes);

  addAttackMods(sheet, npc);
  addSkills(sheet, npc);

  sheet.set("languages", npc.languages);
  sheet.set("sq", npc.sq);
  sheet.set("combat_gear", npc.gear);

  for (const feat of npc.feats) {
    sheet.addRow("feats", { name: feat, "options-flag": 0, type: "misc" });
  }
}

function addSkills(sheet: SheetBuilder, npc: Npc) {
  if (!npc.skills) return;

  const leftovers: string[] = [];
  const used = new Set<string>();

  for (const skill of npc.skills.skills) {
    const resolved = resolveSkill(skill.name);
    const written = `${skill.name} ${signed(skill.mod)}${skill.notes ? ` (${skill.notes})` : ""}`;

    // The sheet has one field per skill, so "Perform (dance) +10, Perform (sing) +12" can't both
    // go in `perform`. Keep the first there and the rest in the notes instead of overwriting it.
    if (!resolved || used.has(resolved.key)) {
      leftovers.push(written);
      continue;
    }

    used.add(resolved.key);

    const notes = [resolved.subject, skill.notes].filter(Boolean).join("; ");

    sheet.set(resolved.key, skill.mod);
    sheet.set(`${resolved.key}_notes`, notes);

    // Mirrors the sheet's calc_npc_skill_display: what the NPC sheet prints for the skill.
    sheet.set(`${resolved.key}_display`, `${signed(skill.mod)}${notes ? ` (${notes})` : ""}`);
    sheet.set(`${resolved.key}_flag`, 1);
  }

  sheet.set("skills_notes", leftovers.join(", "));
  sheet.set("skills_racial_modifiers", npc.skills.racialModifiers);
}

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));

function addEcology(sheet: SheetBuilder, npc: Npc) {
  sheet.set("environment", npc.environment);
  sheet.set("organization", npc.organization);
  sheet.set("treasure", npc.treasure);
  // The sheet has no mythic rank field, so keep it with the rest of the free text.
  const mythic = npc.mythicRank === undefined ? null : `Mythic Rank ${npc.mythicRank}`;
  sheet.set("background", [mythic, npc.flavour, npc.description].filter(Boolean).join("\n\n"));
}

function addSpecialAbilities(sheet: SheetBuilder, npc: Npc) {
  sheet.set("special_abilities_flag", npc.specialAbilities.length ? 1 : 0);

  for (const ability of npc.specialAbilities) {
    sheet.addRow("abilities", {
      name: ability.name,
      "options-flag": 0,
      type: ability.type,
      descflag: "{{descflag=[[1]]}}{{desc=@{description}}}",
      description: ability.description,
    });
  }
}
