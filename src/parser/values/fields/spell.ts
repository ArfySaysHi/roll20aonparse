import { splitTopLevel, trimTrailing } from "../../../shared/strings";

export interface SpellSchool {
  school: string;
  /** "(healing)" */
  subschools: string[];
  /** "[fire, ruse]" */
  descriptors: string[];
}

const list = (text: string | undefined) => (text ? splitTopLevel(text, ",") : []);

/** "conjuration (healing);", "evocation [fire, ruse];", "abjuration;" */
export function parseSpellSchool(text: string): SpellSchool | null {
  const cleaned = trimTrailing(text);
  const school = (cleaned.split(/[(\[]/)[0] ?? "").trim();

  if (!school) return null;

  return {
    school,
    subschools: list(cleaned.match(/\(([^)]*)\)/)?.[1]),
    descriptors: list(cleaned.match(/\[([^\]]*)\]/)?.[1]),
  };
}

export interface SpellLevel {
  /** "cleric", "summoner (unchained)" */
  class: string;
  level: number;
}

/** "bard 5, cleric 5, druid 6" */
export function parseSpellLevels(text: string): SpellLevel[] {
  return splitTopLevel(trimTrailing(text), ",").flatMap((entry) => {
    const match = entry.match(/^(.+?)\s+(\d+)$/);
    return match ? [{ class: match[1]!.trim(), level: Number(match[2]) }] : [];
  });
}
