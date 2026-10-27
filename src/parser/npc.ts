import { findNpcNodes } from "./dom/nodes";
import { splitNpcNodes } from "./split";
import type { RawSection } from "./types";
import { collapseWhitespace, trimTrailing } from "../shared/strings";
import { fieldText as rawFieldText, fieldsMatching, sectionProse } from "./values/entries";
import {
  parseAc,
  parseDefensiveAbilities,
  parseDr,
  parseHp,
  parseImmune,
  parseResist,
  parseSave,
  parseSr,
  parseWeaknesses,
} from "./values/fields/defense";
import {
  classifyDetailLines,
  parseHeading,
  parseInit,
  parseSenses,
  parseSource,
  parseTypeLine,
  parseXp,
} from "./values/fields/details";
import {
  parseAttackLine,
  parseReach,
  parseSpace,
  parseSpecialAttacks,
  parseSpeed,
  parseSpellBlock,
  type AttackLine,
  type SpellBlock,
} from "./values/fields/offense";
import { parseSpecialAbility, type SpecialAbility } from "./values/fields/special";
import {
  parseAbilityScore,
  parseBab,
  parseFeats,
  parseManeuver,
  parseSkills,
  type SkillsLine,
} from "./values/fields/statistics";

export const ABILITIES = ["Str", "Dex", "Con", "Int", "Wis", "Cha"] as const;
export type AbilityName = (typeof ABILITIES)[number];

export interface Save {
  mod: number | null;
  notes: string | null;
}

export interface Npc {
  /** "Solar" — the name from the CR heading, which is what you'd put on a token. */
  name: string;
  /** "Angel, Solar" — the page title. */
  title: string | null;
  flavour: string | null;
  cr: string | null;
  /** Mythic rank from a "CR 10/MR 3" heading; absent for non-mythic monsters. */
  mythicRank?: number;
  source: { name: string; page: string } | null;
  xp: number | null;
  /** Race/class line, e.g. "Enlightened troglodyte cleric 7/fighter 2" */
  classLine: string | null;
  alignment: string | null;
  size: string | null;
  type: string | null;
  subtypes: string | null;
  init: number | null;
  senses: { name: string | null; range: string | null }[];
  perception: number | null;
  aura: string | null;

  ac: { ac: string; touch: string; flatFooted: string; notes: string | null } | null;
  hp: { hp: string; hd: string; notes: string | null } | null;
  saves: { fort: Save | null; ref: Save | null; will: Save | null };
  defensiveAbilities: string | null;
  dr: string | null;
  immune: string | null;
  resist: string | null;
  weaknesses: string | null;
  sr: number | null;

  speed: string | null;
  melee: AttackLine;
  ranged: AttackLine;
  space: string | null;
  reach: string | null;
  specialAttacks: string[];
  spellLikeAbilities: SpellBlock | null;
  /** "Spells Prepared" / "Spells Known" */
  spells: SpellBlock | null;
  /** The class named in the casting block's label ("Cleric" from "Cleric Spells Prepared"), if any. */
  spellClass?: string;

  abilityScores: Record<AbilityName, number | null>;
  bab: number | null;
  cmb: { value: number; notes: string | null } | null;
  cmd: { value: number; notes: string | null } | null;
  feats: string[];
  skills: SkillsLine | null;
  languages: string | null;
  sq: string | null;
  gear: string | null;

  environment: string | null;
  organization: string | null;
  treasure: string | null;

  specialAbilities: SpecialAbility[];
  description: string | null;

  /** Present-but-unparseable fields, so callers can tell the person what was skipped. */
  warnings: string[];
}

/**
 * Field text with line breaks flattened. Stat blocks wrap long lines in the HTML, and a stray
 * newline inside e.g. the AC or a skill name would break parsing. XP and the casting blocks
 * are the exceptions (their line structure matters), so those use the raw text.
 */
const fieldText = (section: RawSection | null, label: string) => {
  const value = rawFieldText(section, label);
  return value === null ? null : collapseWhitespace(value);
};

const emptyAttackLine = (): AttackLine => ({ attacks: [], unparsed: [] });

/**
 * Turns a Nethys (AoNPRD) monster page into an Npc. Returns null when the document
 * doesn't look like a monster page at all (no title, or no CR heading).
 */
export function parseNpc(doc: Document): Npc | null {
  const raw = splitNpcNodes(findNpcNodes(doc));

  if (!raw.details) return null;

  const warnings: string[] = [];
  const heading = parseHeading(raw.details.heading);

  if (!heading) return null;

  // Pages such as dragons (by age) or elementals (by size) hold several stat blocks. Only the
  // first is read, so say so instead of letting the person assume it was the one they wanted.
  const blocks = countStatBlocks(doc);
  if (blocks > 1) {
    warnings.push(
      `This page has ${blocks} stat blocks; only the first (${heading.name}) was imported`,
    );
  }

  // Parse a field when it is present; flag it when it is present but unreadable.
  const parsed = <T>(
    section: RawSection | null,
    label: string,
    parser: (text: string) => T | null,
  ): T | null => {
    const text = fieldText(section, label);
    if (text === null) return null;

    const result = parser(text);
    if (result === null) warnings.push(`Could not read ${label}: "${text}"`);
    return result;
  };

  // --- Details ---------------------------------------------------------------------------
  const xpText = rawFieldText(raw.details, "XP");
  const detailLines = [
    ...(xpText?.split("\n").slice(1) ?? []),
    ...raw.details.entries.flatMap((e) => (e.kind === "text" ? e.text.split("\n") : [])),
  ];
  const { classLine, typeLine } = classifyDetailLines(detailLines);
  const type = typeLine ? parseTypeLine(typeLine) : null;
  if (typeLine && !type) warnings.push(`Could not read type line: "${typeLine}"`);
  if (!typeLine) warnings.push("Could not find the alignment / size / type line");

  const senses = parsed(raw.details, "Senses", parseSenses);

  // --- Defense ---------------------------------------------------------------------------
  const { defense, offense, statistics, ecology } = raw;
  const text = (section: RawSection | null, label: string, parser: (t: string) => string) => {
    const value = fieldText(section, label);
    return value === null ? null : parser(value) || null;
  };

  // --- Offense ---------------------------------------------------------------------------
  const attackLine = (label: string) => {
    const value = fieldText(offense, label);
    return value === null ? emptyAttackLine() : parseAttackLine(value);
  };
  const melee = attackLine("Melee");
  const ranged = attackLine("Ranged");
  for (const [label, line] of [
    ["Melee", melee],
    ["Ranged", ranged],
  ] as const) {
    for (const piece of line.unparsed) warnings.push(`Could not read ${label} attack: "${piece}"`);
  }

  const spellField = (test: (label: string) => boolean) => {
    const found = fieldsMatching(offense, test);

    if (found.length > 1) {
      warnings.push(
        `Found ${found.length} casting blocks (${found.map((f) => f.label).join(", ")}); ` +
          "they were merged and use the first block's caster level",
      );
    }

    return found.length ? parseSpellBlock(found.map((f) => f.text).join("\n")) : null;
  };

  const spellClass = fieldsMatching(offense, (l) => SPELLS_LABEL.test(l.trim()))[0]
    ?.label.trim()
    .match(SPELLS_LABEL)?.[1];

  // --- Statistics ------------------------------------------------------------------------
  const abilityScores = Object.fromEntries(
    ABILITIES.map((a) => {
      const value = fieldText(statistics, a);
      return [a, value === null ? null : parseAbilityScore(value)];
    }),
  ) as Record<AbilityName, number | null>;

  const skills = parsed(statistics, "Skills", (t) => parseSkills(t));
  // Nethys sometimes puts "Racial Modifiers" behind its own bold label, which splits it off.
  const racialModifiers = fieldText(statistics, "Racial Modifiers");
  if (skills && !skills.racialModifiers && racialModifiers) {
    skills.racialModifiers = trimTrailing(racialModifiers);
  }
  for (const piece of skills?.unparsed ?? []) warnings.push(`Could not read skill: "${piece}"`);

  const featsText = fieldText(statistics, "Feats");

  // --- Special abilities -----------------------------------------------------------------
  const specialAbilities = (raw.specialAbilities?.entries ?? [])
    .filter((e) => e.kind === "field")
    .map((e) => parseSpecialAbility(e.label, e.text));

  return {
    name: heading.name,
    title: raw.name,
    flavour: raw.flavour,
    cr: heading.cr,
    ...("mythicRank" in heading && { mythicRank: heading.mythicRank }),
    source: parsed(raw.details, "Source", parseSource),
    xp: xpText === null ? null : parseXp(xpText),
    classLine,
    alignment: type?.alignment ?? null,
    size: type?.size ?? null,
    type: type?.type ?? null,
    subtypes: type?.subtypes ?? null,
    init: parsed(raw.details, "Init", parseInit),
    senses: senses?.senses.flatMap((s) => (s ? [s] : [])) ?? [],
    perception: senses?.perception ?? null,
    aura: text(raw.details, "Aura", trimTrailing),

    ac: parsed(defense, "AC", parseAc),
    hp: parsed(defense, "hp", parseHp),
    saves: {
      fort: parsed(defense, "Fort", parseSave),
      ref: parsed(defense, "Ref", parseSave),
      will: parsed(defense, "Will", parseSave),
    },
    defensiveAbilities: text(defense, "Defensive Abilities", parseDefensiveAbilities),
    dr: text(defense, "DR", parseDr),
    immune: text(defense, "Immune", parseImmune),
    resist: text(defense, "Resist", parseResist),
    weaknesses: text(defense, "Weaknesses", parseWeaknesses),
    sr: parsed(defense, "SR", parseSr),

    speed: text(offense, "Speed", parseSpeed),
    melee,
    ranged,
    space: text(offense, "Space", parseSpace),
    reach: text(offense, "Reach", parseReach),
    specialAttacks: parseSpecialAttacksField(fieldText(offense, "Special Attacks")),
    spellLikeAbilities: spellField((l) => /spell-like abilities$/i.test(l.trim())),
    spells: spellField((l) => /spells (prepared|known)$/i.test(l.trim())),
    ...(spellClass && { spellClass }),

    abilityScores,
    bab: parsed(statistics, "Base Atk", parseBab),
    cmb: parsed(statistics, "CMB", parseManeuver),
    cmd: parsed(statistics, "CMD", parseManeuver),
    feats: featsText === null ? [] : parseFeats(featsText),
    skills,
    languages: text(statistics, "Languages", trimTrailing),
    sq: text(statistics, "SQ", trimTrailing),
    gear: joinFields(
      [fieldText(statistics, "Combat Gear"), fieldText(statistics, "Other Gear")],
      "; ",
    ),

    environment: text(ecology, "Environment", trimTrailing),
    organization: text(ecology, "Organization", trimTrailing),
    treasure: text(ecology, "Treasure", trimTrailing),

    specialAbilities,
    description: sectionProse(raw.description),

    warnings,
  };
}

/** "Cleric Spells Prepared" / "Sorcerer Spells Known": group 1 is the class, absent for a bare label. */
const SPELLS_LABEL = /^(?:(.+?)\s+)?spells (?:prepared|known)$/i;

/** How many "<name> CR <n>" headings the page has (one per stat block). */
function countStatBlocks(doc: Document): number {
  let count = 0;

  for (const heading of Array.from(doc.querySelectorAll("h2.title"))) {
    if (parseHeading(collapseWhitespace(heading.textContent ?? ""))) count++;
  }

  return count;
}

function parseSpecialAttacksField(value: string | null) {
  return value === null ? [] : parseSpecialAttacks(value);
}

function joinFields(values: (string | null)[], separator: string) {
  const present = values.filter((v): v is string => v !== null && v.trim() !== "");
  return present.length ? present.map(trimTrailing).join(separator) : null;
}
