// Skill name on the statblock -> attribute name on the Pathfinder 1 (Roll20) sheet.
const PLAIN_SKILLS = new Set([
  "acrobatics",
  "appraise",
  "bluff",
  "climb",
  "craft",
  "diplomacy",
  "disable_device",
  "disguise",
  "escape_artist",
  "fly",
  "handle_animal",
  "heal",
  "intimidate",
  "linguistics",
  "perception",
  "perform",
  "profession",
  "ride",
  "sense_motive",
  "sleight_of_hand",
  "spellcraft",
  "stealth",
  "survival",
  "swim",
  "use_magic_device",
]);

const KNOWLEDGE = new Set([
  "arcana",
  "dungeoneering",
  "engineering",
  "geography",
  "history",
  "local",
  "nature",
  "nobility",
  "planes",
  "religion",
]);

const SUBJECT = /^(.+?)\s*\((.+)\)$/;

export interface ResolvedSkill {
  key: string;
  /** "any one" in "Craft (any one)" — the sheet has no field for it, so it goes in the notes. */
  subject: string | null;
}

/** Returns null for skills the sheet has no field for (e.g. "Knowledge (all)"). */
export function resolveSkill(name: string): ResolvedSkill | null {
  const trimmed = name.trim().toLowerCase();
  const match = trimmed.match(SUBJECT);
  const base = (match ? match[1]! : trimmed).trim();
  const subject = match ? match[2]!.trim() : null;

  if (base === "knowledge") {
    return subject && KNOWLEDGE.has(subject) ? { key: `knowledge_${subject}`, subject: null } : null;
  }

  const key = base.replace(/\s+/g, "_");
  return PLAIN_SKILLS.has(key) ? { key, subject } : null;
}
