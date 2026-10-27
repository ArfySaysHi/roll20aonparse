/**
 * Works out which ability a spellcaster casts with, so spells whose stat block gives no save DC can
 * default to the PF1 formula: 10 + spell level + casting-stat modifier.
 *
 * The class says what the *usual* stat is, but archetypes and a few prestige classes change it, so
 * the class is only one of several clues, and the person can always override the result.
 */

export type Ability = "Int" | "Wis" | "Cha";

/** What the person picks in the panel: let the importer work it out, or force one stat. */
export type CastingStatChoice = "auto" | Ability;

export const CASTING_ABILITIES: readonly Ability[] = ["Int", "Wis", "Cha"];

export type AbilityScores = Partial<Record<string, number | null>>;

/** PF1 ability modifier. A missing score (—) counts as 0, as the rest of the importer does. */
export const modifier = (score: number | null | undefined) =>
  score === null || score === undefined ? 0 : Math.floor((score - 10) / 2);

export const spellDc = (level: number, castingMod: number) => 10 + level + castingMod;

/**
 * The usual casting stat of each spellcasting class. "Psychic" is left out on purpose: its stat
 * depends on the discipline chosen, so there is no safe default and the other clues decide.
 */
const CLASS_ABILITY: Readonly<Record<string, Ability>> = {
  alchemist: "Int",
  arcanist: "Int",
  investigator: "Int",
  magus: "Int",
  occultist: "Int",
  witch: "Int",
  wizard: "Int",

  adept: "Wis",
  cleric: "Wis",
  druid: "Wis",
  hunter: "Wis",
  inquisitor: "Wis",
  ranger: "Wis",
  shaman: "Wis",
  spiritualist: "Wis",
  warpriest: "Wis",

  antipaladin: "Cha",
  bard: "Cha",
  bloodrager: "Cha",
  medium: "Cha",
  mesmerist: "Cha",
  oracle: "Cha",
  paladin: "Cha",
  skald: "Cha",
  sorcerer: "Cha",
  summoner: "Cha",
};

const CLASS_WORDS = new RegExp(`\\b(${Object.keys(CLASS_ABILITY).join("|")})\\b`, "i");

/** The first known casting class mentioned in `text` ("Cleric", "Human oracle 7/fighter 2"). */
export function abilityForClass(text: string | null | undefined): Ability | null {
  const word = text?.match(CLASS_WORDS)?.[1];
  return word ? CLASS_ABILITY[word.toLowerCase()]! : null;
}

export interface CastingStatInput {
  choice: CastingStatChoice;
  scores: AbilityScores;
  casterLevel: number | null;
  concentration: number | null;
  /** DCs the stat block itself printed, with the level of the spell level group they sit in. */
  knownDcs: { level: number; dc: number }[];
  /** The class named in the casting block's label, e.g. "Cleric" from "Cleric Spells Prepared". */
  spellClass: string | null | undefined;
  /** The race/class line, e.g. "Male human mummy lord cleric 9". */
  classLine: string | null | undefined;
}

export interface CastingStat {
  ability: Ability;
  mod: number;
  /** How it was decided, for the note shown to the person. */
  source: "your choice" | "the stat block" | "the class" | "a guess";
  /** Set when the result deserves a second look; null when it is safe to stay quiet. */
  note: string | null;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function chooseCastingStat(input: CastingStatInput): CastingStat {
  const modOf = (ability: Ability) => modifier(input.scores[ability]);
  const result = (
    ability: Ability,
    source: CastingStat["source"],
    note: string | null = null,
  ): CastingStat => ({ ability, mod: modOf(ability), source, note });

  if (input.choice !== "auto") return result(input.choice, "your choice");

  // Clues from the stat block itself. Each one removes the abilities that can't explain it; a clue
  // that rules out everything (a feat or item adding to the number) is ignored rather than trusted.
  let candidates: Ability[] = [...CASTING_ABILITIES];
  const narrow = (fits: (ability: Ability) => boolean) => {
    const next = candidates.filter(fits);
    if (next.length) candidates = next;
  };

  // concentration = caster level + casting-stat modifier
  if (input.concentration !== null && input.casterLevel !== null) {
    const expected = input.concentration - input.casterLevel;
    narrow((a) => modOf(a) === expected);
  }

  // DC = 10 + spell level + casting-stat modifier
  for (const { level, dc } of input.knownDcs) narrow((a) => spellDc(level, modOf(a)) === dc);

  const byClass = abilityForClass(input.spellClass) ?? abilityForClass(input.classLine);

  if (byClass) {
    // Evidence that points firmly at a different stat beats the class: that's an archetype.
    if (candidates.length === 1 && candidates[0] !== byClass) {
      const found = candidates[0]!;
      return result(
        found,
        "the stat block",
        `The stat block's numbers fit ${found}, not the ${byClass} this class usually casts with`,
      );
    }
    return result(byClass, "the class");
  }

  if (candidates.length === 1) return result(candidates[0]!, "the stat block");

  // Nothing identifies the caster: take the strongest of the three and say it was a guess.
  const best = candidates.reduce((top, a) => (modOf(a) > modOf(top) ? a : top));
  return result(
    best,
    "a guess",
    `Could not tell which stat this caster uses, so ${best} (${signed(modOf(best))}) was assumed`,
  );
}
