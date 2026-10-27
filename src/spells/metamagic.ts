// Metamagic feats show up in stat blocks as a prefix: "maximized fireball", "quickened magic missile".
// Only prefixes that can't also start a real spell name are listed. "silent", "still",
// "persistent" and "solid" are left out on purpose: "silent image", "persistent image" and
// "solid fog" are spells, and guessing wrong would turn them into a different spell.
const METAMAGIC = new Set([
  "empowered",
  "enlarged",
  "extended",
  "heightened",
  "maximized",
  "quickened",
  "widened",
  "bouncing",
  "burrowing",
  "concussive",
  "dazing",
  "disruptive",
  "ectoplasmic",
  "echoing",
  "elemental",
  "flaring",
  "intensified",
  "lingering",
  "merciful",
  "piercing",
  "rime",
  "sculpted",
  "selective",
  "sickening",
  "tenacious",
  "thanatopic",
  "threatening",
  "toppling",
]);

export interface SplitSpellName {
  /** The spell itself, e.g. "fireball". */
  base: string;
  /** Metamagic applied to it, in the order written, e.g. ["maximized"]. */
  metamagic: string[];
}

/** "maximized fireball" -> { base: "fireball", metamagic: ["maximized"] } */
export function splitMetamagic(name: string): SplitSpellName {
  const words = name.trim().split(/\s+/);
  const metamagic: string[] = [];

  // Always leave at least one word: a name made only of prefixes isn't a spell.
  while (words.length > 1 && METAMAGIC.has(words[0]!.toLowerCase())) {
    metamagic.push(words.shift()!.toLowerCase());
  }

  return { base: words.join(" "), metamagic };
}
