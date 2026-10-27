import { normalize, splitTopLevel, trimTrailing } from "../../../shared/strings";
import { parseModifier } from "./shared";

// "28," -> 28. Mindless creatures print an em dash for a missing score -> null.
export function parseAbilityScore(text: string) {
  const match = text.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

export function parseBab(text: string) {
  return parseModifier(text);
}

const MANEUVER = /^([+-]?\d+)(?:\s*\((.+)\))?$/;

// CMB "+32" / CMD "47 (51 vs. trip)"
export function parseManeuver(text: string) {
  const match = normalize(trimTrailing(text)).match(MANEUVER);

  if (!match) return null;

  return { value: Number(match[1]), notes: match[2] ?? null };
}

export interface Skill {
  name: string;
  mod: number;
  notes: string | null;
}

export interface SkillsLine {
  skills: Skill[];
  racialModifiers: string | null;
  unparsed: string[];
}

// "Stealth +8 (+12 in shadows)", "Craft (any one) +17"
const SKILL = /^(.+?)\s([+-]\d+)(?:\s*\((.+)\))?$/;
const RACIAL_SPLIT = /;\s*(?=racial modifiers?)/i;
const RACIAL_PREFIX = /^racial modifiers?\s*/i;

export function parseSkills(text: string): SkillsLine {
  const [list = "", racial] = normalize(text).split(RACIAL_SPLIT);
  const result: SkillsLine = {
    skills: [],
    racialModifiers: racial ? racial.replace(RACIAL_PREFIX, "").trim() : null,
    unparsed: [],
  };

  for (const entry of splitTopLevel(trimTrailing(list), ",")) {
    const match = entry.match(SKILL);

    if (!match) {
      result.unparsed.push(entry);
      continue;
    }

    result.skills.push({ name: match[1]!.trim(), mod: Number(match[2]), notes: match[3] ?? null });
  }

  return result;
}

// Feats keep any parenthetical ("Weapon Focus (bite)") since the sheet matches on the full name.
export function parseFeats(text: string) {
  const cleaned = trimTrailing(text);

  if (cleaned === "" || /^[-\u2013\u2014]$/.test(cleaned)) return [];

  return splitTopLevel(cleaned, ",").map(normalize).filter(Boolean);
}
