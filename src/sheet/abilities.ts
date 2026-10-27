export type AbilityAttribute =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

/**
 * Port of the sheet's `calc_ability_mod`, which it runs when an NPC's ability score changes.
 * Our writes don't trigger it, so we derive the same attributes ourselves.
 *
 * A missing score (mindless Int, undead Con) is a modifier of 0, *not* "-": modifiers are
 * substituted into roll formulas, where "-" would break them. Strength and Dexterity also get
 * the half / one-and-a-half modifiers the sheet uses for off-hand and two-handed attacks.
 */
export function abilityModAttributes(
  attribute: AbilityAttribute,
  score: number | null,
): Record<string, number> {
  if (score === null) return { [`${attribute}_mod`]: 0 };

  const mod = Math.floor((score - 10) / 2);
  const attributes: Record<string, number> = { [`${attribute}_mod`]: mod };

  if (attribute === "strength" || attribute === "dexterity") {
    attributes[`${attribute}_half_mod`] = Math.floor(mod * 0.5);
    attributes[`${attribute}_oneandahalf_mod`] = Math.floor(mod * 1.5);
  }

  return attributes;
}
