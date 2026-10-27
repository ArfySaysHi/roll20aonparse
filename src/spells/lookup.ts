import type { Spell } from "../parser/spell";

// Statblocks write "mass charm monster"; Nethys titles it "Charm Monster, Mass".
const MODIFIERS = new Set(["greater", "lesser", "mass", "communal"]);

const NUMERALS: Record<string, string> = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  V: "5",
  VI: "6",
  VII: "7",
  VIII: "8",
  IX: "9",
  X: "10",
  XI: "11",
  XII: "12",
};

/** Converts a statblock spell name into the title Nethys uses for it. */
export function nethysSpellName(name: string): string {
  const words = name
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => NUMERALS[word.toUpperCase()] ?? word);

  const modifiers: string[] = [];

  while (words.length > 1 && MODIFIERS.has(words[0]!.toLowerCase())) {
    modifiers.push(words.shift()!);
  }

  return modifiers.length ? `${words.join(" ")}, ${modifiers.join(" ")}` : words.join(" ");
}

export function spellPageUrl(name: string): string {
  // encodeURIComponent leaves ' alone; Nethys' own links write it as %27
  const itemName = encodeURIComponent(nethysSpellName(name)).replace(/'/g, "%27");
  return `https://aonprd.com/SpellDisplay.aspx?ItemName=${itemName}`;
}

const key = (name: string) =>
  name
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Picks the spell you asked for out of a results page. Only an exact title match counts:
 * a near miss (say "Fireball" on a page that only has "Delayed Blast Fireball") is a
 * different spell, so we'd rather report "not found" than import the wrong one.
 */
export function findSpell(spells: Spell[], name: string): Spell | null {
  const wanted = key(nethysSpellName(name));
  return spells.find((spell) => key(spell.name) === wanted) ?? null;
}
