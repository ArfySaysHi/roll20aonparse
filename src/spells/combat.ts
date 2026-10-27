export interface SpellDamage {
  /** The clause as Nethys words it, e.g. "1d6 points of fire damage per caster level (maximum 10d6)". */
  text: string;
  /** The leading dice, e.g. "1d6" / "2d6+5": what to roll when the spell doesn't scale. */
  dice: string;
  /** "fire", "force", ... or null for plain "points of damage". */
  type: string | null;
  /** True when the text scales with caster level ("per caster level", "per two caster levels"). */
  scalesWithLevel: boolean;
}

export interface SpellCombat {
  attack: "melee" | "ranged" | null;
  damage: SpellDamage | null;
}

const DICE = String.raw`\d+d\d+(?:\s*[+-]\s*\d+)?`;

// "1d6 points of fire damage per caster level (maximum 10d6)"
// "1d6 points of damage per two caster levels (maximum 10d6)"
// "1d8 points of damage + 1 point per caster level (maximum +25)"
// "3d6 fire damage"
const DAMAGE_CLAUSE = new RegExp(
  `(${DICE})\\s+(?:points?\\s+of\\s+)?(?:([a-z]+)\\s+)?damage` +
    String.raw`(?:\s*\+\s*\d+\s+points?\s+per\s+caster\s+levels?)?` +
    String.raw`(?:\s+per\s+(?:(?:two|three|four)\s+)?(?:caster\s+)?levels?)?` +
    String.raw`(?:\s*\([^)]*maximum[^)]*\))?`,
  "i",
);

const SCALES = /\bper\s+(?:(?:two|three|four)\s+)?(?:caster\s+)?levels?\b/i;

// Words that sit where a damage type would, but aren't one ("1d6 points of additional damage").
const NOT_A_TYPE = new Set(["additional", "extra", "bonus", "total", "normal", "any", "the"]);

/**
 * Pulls the primary damage clause and the attack kind out of a spell description, following the
 * way Pathfinder 1e words these. It's a heuristic: it reads the first damage clause only, and
 * only the first paragraph for the attack, because later paragraphs often discuss touch
 * attacks in passing (Fireball's "hit the opening with a ranged touch attack").
 */
export function parseSpellCombat(description: string | null): SpellCombat {
  if (!description) return { attack: null, damage: null };

  return { attack: parseAttack(description), damage: parseDamage(description) };
}

function parseDamage(description: string): SpellDamage | null {
  const match = description.match(DAMAGE_CLAUSE);
  if (!match) return null;

  const [text, dice, type] = match;
  const normalizedType = type?.toLowerCase() ?? null;

  return {
    text: text.replace(/\s+/g, " ").trim(),
    dice: dice!.replace(/\s+/g, ""),
    type: normalizedType && !NOT_A_TYPE.has(normalizedType) ? normalizedType : null,
    scalesWithLevel: SCALES.test(text),
  };
}

function parseAttack(description: string): SpellCombat["attack"] {
  const firstParagraph = description.split("\n\n")[0] ?? "";

  if (/\branged touch attack/i.test(firstParagraph)) return "ranged";
  if (/\b(?:melee )?touch attack/i.test(firstParagraph)) return "melee";
  return null;
}
