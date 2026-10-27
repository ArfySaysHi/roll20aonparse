import type { Npc } from "../parser/npc";
import type { Spell } from "../parser/spell";
import type { SpellBlock, SpellLikeEntry } from "../parser/values/fields/offense";
import { parseSpellCombat } from "../spells/combat";
import { splitMetamagic } from "../spells/metamagic";
import type { ResolvedSpells } from "../spells/resolve";
import { calcNpcSpell } from "./calcSpell";
import { chooseCastingStat, spellDc, type CastingStatChoice } from "./castingStat";
import { compendiumFormula, SpellType } from "./compendiumFormula";

type Value = string | number | null | undefined;

export interface SpellRow {
  /** "spell-like", or "spell-3" for third-level spells. */
  section: string;
  fields: Record<string, Value>;
}

export interface SpellRows {
  rows: SpellRow[];
  /** Plain attributes the rows need, e.g. `caster_spells_flag_level_3`. */
  flags: Record<string, Value>;
  warnings: string[];
}

export interface Frequency {
  timesperday:
    | "constant"
    | "at-will"
    | `per-${"hour" | "day" | "week" | "month" | "year"}`
    | "every-hours";
  /** For per-period and every-N-hours frequencies. */
  count?: number;
}

/** "Constant", "At Will", "3/day", "1/year", "every 4 hours" */
export function parseFrequency(text: string): Frequency | null {
  const t = text.trim().toLowerCase();

  if (t === "constant") return { timesperday: "constant" };
  if (/^at[ -]?will$/.test(t)) return { timesperday: "at-will" };

  const per = t.match(/^(\d+)\s*\/\s*(hour|day|week|month|year)$/);
  if (per) return { timesperday: `per-${per[2] as "hour"}`, count: Number(per[1]) };

  const every = t.match(/^every\s+(\d+)\s+hours?$/);
  if (every) return { timesperday: "every-hours", count: Number(every[1]) };

  return null;
}

/** "9th" -> 9, "0 (at will)" -> 0. */
export function parseSpellLevelHeading(text: string): number | null {
  const match = text.trim().match(/^(\d+)(?:st|nd|rd|th)?\b/i);
  return match ? Number(match[1]) : null;
}

/**
 * Spontaneous casters list their slots in the level heading: "1st (4/day)". Returns the 4, or null
 * when the heading carries no slot count (prepared casters).
 */
export function parseSlotsPerDay(text: string): number | null {
  const match = text.match(/\(\s*(\d+)\s*\/\s*day\s*\)/i);
  return match ? Number(match[1]) : null;
}

const SMALL_WORDS = new Set([
  "of",
  "the",
  "and",
  "to",
  "from",
  "in",
  "on",
  "with",
  "a",
  "an",
  "vs",
]);

/** "mass charm monster" -> "Mass Charm Monster". Used only when Nethys had no page for the spell. */
export function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      if (/^[ivx]+$/i.test(word)) return word.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Builds the repeating spell rows for an NPC's spell-like abilities and prepared / known spells.
 *
 * Rows are written even without Nethys details (name, frequency and DC come from the stat block);
 * `spells` adds school, range, damage, description and so on. Each row also gets the values the
 * sheet derives only when a row is edited (see `calcNpcSpell`), so it works when clicked.
 */
export function spellRows(
  npc: Npc,
  spells: ResolvedSpells | null,
  options: SpellRowOptions = {},
): SpellRows {
  const result: SpellRows = { rows: [], flags: {}, warnings: [] };

  addSpellLikeRows(result, npc.spellLikeAbilities, spells);
  addPreparedRows(result, npc, spells, options.castingStat ?? "auto");

  return result;
}

export interface SpellRowOptions {
  /**
   * The stat prepared / known spells cast with, for the save DC of spells the stat block gives no
   * DC for (10 + spell level + that stat's modifier). "auto" works it out from the stat block.
   */
  castingStat?: CastingStatChoice;
}

function addSpellLikeRows(
  result: SpellRows,
  block: SpellBlock | null,
  spells: ResolvedSpells | null,
) {
  if (!block) return;

  const context = { caster2_level: block.casterLevel === null ? "" : String(block.casterLevel) };

  for (const group of block.groups) {
    let frequency = parseFrequency(group.frequency);

    if (!frequency) {
      result.warnings.push(
        `Unrecognised spell-like frequency "${group.frequency}"; imported as at-will`,
      );
      frequency = { timesperday: "at-will" };
    }

    for (const entry of group.spells) {
      if (!entry.name) continue;

      const { base, metamagic } = splitMetamagic(entry.name);
      const fields: Record<string, Value> = {
        spellname: displayName(base, metamagic, spells),
        "options-flag": 0,
        timesperday: frequency.timesperday,
        ...(frequency.count !== undefined && {
          perday_max: frequency.count,
          perday_qty: frequency.count,
        }),
        ...entryFields(entry),
        // the sheet's spell-like rows read the level from caster block 2 (see calcNpcSpell)
        ...detailFields(spells?.get(base) ?? null, SpellType.SPELLLIKE, result.warnings),
      };

      result.rows.push({ section: "spell-like", fields: withDerived("like", fields, context) });
    }
  }
}

function addPreparedRows(
  result: SpellRows,
  npc: Npc,
  spells: ResolvedSpells | null,
  choice: CastingStatChoice,
) {
  const block = npc.spells;
  if (!block) return;

  const castingMod = decideCastingMod(result, npc, block, choice);

  const perLevel = new Map<number, number>();
  // "Spells Known" headings give the slots per day ("1st (4/day)"), which is not the same thing
  // as how many spells are listed.
  const slots = new Map<number, number>();

  for (const group of block.groups) {
    const level = parseSpellLevelHeading(group.frequency);

    if (level === null) {
      result.warnings.push(
        `Could not read spell level "${group.frequency}"; its spells were skipped`,
      );
      continue;
    }

    const perDay = parseSlotsPerDay(group.frequency);
    if (perDay !== null) slots.set(level, perDay);

    for (const entry of group.spells) {
      if (!entry.name) continue;

      const { base, metamagic } = splitMetamagic(entry.name);
      const fields: Record<string, Value> = {
        spellname: displayName(base, metamagic, spells),
        "options-flag": 0,
        spellcaster: "1",
        ...entryFields(entry),
        // The stat block's own DC wins; otherwise the rules' default for a spell of this level.
        ...(entry.dc === null &&
          castingMod !== null && { spelldc_mod: spellDc(level, castingMod) }),
        ...detailFields(spells?.get(base) ?? null, SpellType.SPELL, result.warnings),
      };

      result.rows.push({
        section: `spell-${level}`,
        fields: withDerived(level, fields, {}, entry.dc !== null),
      });
      result.flags[`caster_spells_flag_level_${level}`] = "1";

      // "wall of ice (2)" means two prepared copies
      perLevel.set(level, (perLevel.get(level) ?? 0) + copies(entry));
    }
  }

  // The sheet shows a level's section only while that level has spells per day, and its own NPC
  // import writes these counts for levels 1-9 (cantrips are always shown). The flag alone isn't
  // enough: the sheet resets it to 0 whenever the totals are empty.
  for (const [level, prepared] of perLevel) {
    if (level < 1 || level > 9) continue;

    const count = slots.get(level) ?? prepared;
    result.flags[`caster1_spells_perday_level_${level}`] = count;
    result.flags[`caster1_spells_total_level_${level}`] = count;
  }
}

/**
 * The casting-stat modifier to default DCs with, or null when there's nothing to default (every
 * spell already has a DC from the stat block). Adds a note only when the choice deserves a look.
 */
function decideCastingMod(
  result: SpellRows,
  npc: Npc,
  block: SpellBlock,
  choice: CastingStatChoice,
): number | null {
  // Only groups whose level can be read produce rows (see addPreparedRows), so only they count.
  const groups = block.groups.flatMap((group) => {
    const level = parseSpellLevelHeading(group.frequency);
    return level === null ? [] : [{ level, spells: group.spells.filter((entry) => entry.name) }];
  });

  if (groups.every((group) => group.spells.every((entry) => entry.dc !== null))) return null;

  const knownDcs = groups.flatMap(({ level, spells }) =>
    spells.flatMap((entry) => (entry.dc === null ? [] : [{ level, dc: Number(entry.dc) }])),
  );

  const stat = chooseCastingStat({
    choice,
    scores: npc.abilityScores,
    casterLevel: block.casterLevel,
    concentration: block.concentration,
    knownDcs,
    spellClass: npc.spellClass,
    classLine: npc.classLine,
  });

  if (stat.note) {
    result.warnings.push(
      `${stat.note}. Spell DCs the stat block doesn't give are 10 + spell level + ${stat.ability} ` +
        'modifier; pick a "Casting stat" in the panel and re-import to change it',
    );
  }

  return stat.mod;
}

/** How many times an entry is prepared: a bare number in its note ("(2)") is a count. */
function copies(entry: SpellLikeEntry): number {
  const match = entry.notes?.match(/^(\d+)$/);
  return match ? Math.max(1, Number(match[1])) : 1;
}

/** The Nethys title when we have it, else the statblock's wording; metamagic stays in front. */
const displayName = (base: string, metamagic: string[], spells: ResolvedSpells | null) =>
  [...metamagic.map(titleCase), spells?.get(base)?.name ?? titleCase(base)].join(" ");

/** What the stat block itself says about the spell: its DC and any note. */
function entryFields(entry: SpellLikeEntry): Record<string, Value> {
  return {
    ...(entry.dc !== null && { spelldc_mod: Number(entry.dc) }),
    ...(entry.notes !== null && { notes: entry.notes }),
  };
}

function withDerived(
  kind: "like" | number,
  fields: Record<string, Value>,
  context: { caster2_level?: string },
  dcFromStatBlock = true,
): Record<string, Value> {
  // A DC the stat block printed, without a save from Nethys, still means the spell allows one.
  // A *default* DC says nothing about that: every spell would be flagged as having a save.
  const withSave =
    dcFromStatBlock && fields.spelldc_mod !== undefined && !fields.spellsaveflag
      ? { ...fields, spellsaveflag: "{{save=1}}" }
      : fields;

  return { ...withSave, ...calcNpcSpell(kind, withSave, context) };
}

/** The Nethys-sourced fields of a row, using the sheet's own field names and flag syntax. */
function detailFields(
  spell: Spell | null,
  caster: SpellType,
  warnings: string[],
): Record<string, Value> {
  if (!spell) return {};

  const school = [
    spell.school,
    spell.subschools.length ? `(${spell.subschools.join(", ")})` : null,
    spell.descriptors.length ? `[${spell.descriptors.join(", ")}]` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const fields: Record<string, Value> = {
    spellschool: school,
    spellclasslevel: spell.levels.map((l) => `${l.class} ${l.level}`).join(", "),
    spellcastingtime: spell.castingTime,
    spellcomponent: spell.components,
    spellrange: spell.range,
    spellarea: spell.area,
    spelltargets: spell.target,
    spelleffect: spell.effect,
    spellduration: spell.duration,
  };

  if (spell.savingThrow) {
    fields.spellsave = spell.savingThrow;
    fields.spellsaveflag = spell.savingThrow.trim().toLowerCase() === "none" ? "0" : "{{save=1}}";
  }

  if (spell.spellResistance) {
    fields.spellresistance = spell.spellResistance;
    fields.spellresistanceflag =
      spell.spellResistance.trim().toLowerCase() === "no" ? "0" : "{{sr=1}}";
  }

  const { attack, damage } = parseSpellCombat(spell.description);

  if (attack) {
    fields.spellatkflag = "{{attack=1}}";
    fields.spellatktype = attack;
  }

  if (damage) {
    const formula = compendiumFormula(damage.text, caster, false);

    // The sheet only understands a few ways of scaling by level. When it can't convert the
    // clause, rolling the bare dice would be wrong, so leave damage blank and say so.
    const roll = formula !== damage.text ? formula : damage.scalesWithLevel ? null : damage.dice;

    if (roll) {
      fields.spelldmg = roll;
      fields.spelldmgflag = "{{damage=1}} {{dmg1flag=1}}";
      fields.spelldmgtype = damage.type;
    } else {
      warnings.push(
        `Could not convert the damage for ${spell.name} ("${damage.text}"); left blank`,
      );
    }
  }

  if (spell.description) {
    fields.spelldesc = compendiumFormula(spell.description, caster, true);
    fields.spelldescflag = "{{descflag=[[1]]}}";
  }

  return fields;
}
