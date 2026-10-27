import {
  normalize,
  splitTopLevel,
  splitTopLevelOnWord,
  trimTrailing,
} from "../../../shared/strings";

export interface Attack {
  quantity: number;
  quantityRoll: string | null;
  name: string;
  attackNotes: string | null;
  iteratives: number[];
  kind: "melee" | "ranged" | "incorporeal" | null;
  touch: boolean;
  damage: string | null;
  critRange: string | null; // "19-20"
  critMultiplier: number | null; // 3 for x3
  damageType: string | null;
  additionalEffects: string | null;
  restriction: string | null;
}

const NESTED = String.raw`[^()]*(?:\([^()]*\)[^()]*)*`;

const ATTACK_RE = new RegExp(
  String.raw`^(?:(?<quantity>\d+(?:d\d+(?:[+-]\d+)?)?)\s+)?` +
    String.raw`(?<name>[^(]*?)` +
    String.raw`(?:\s*\((?<attackNotes>[^)]+)\)(?=\s+[+-]\d))?` +
    String.raw`(?:(?:^|\s+)(?<iteratives>[+-]\d+(?:/[+-]\d+)*))?` +
    String.raw`(?:\s+(?<kind>melee|ranged|incorporeal))?` +
    String.raw`(?:\s+(?<touch>touch))?` +
    String.raw`(?:\s+attack)?` +
    String.raw`(?:\s*\((?<inner>${NESTED})\))?` +
    String.raw`(?:\s*\((?<restriction>[^)]+)\))?` +
    String.raw`(?:\s+plus\s+(?<postPlus>.+?))?$`,
  "i",
);

const DAMAGE_RE =
  /^(?<damage>(?:\d+d\d+|\d+(?:\.\d+)?)(?:\s*[+-]\s*(?:\d+d\d+|\d+(?:\.\d+)?))*)(?:\/(?:(?<range>\d+-\d+)(?:\/x(?<mult1>\d+))?|x(?<mult2>\d+)))?(?<rest>.*)$/i;

function splitRest(rest: string): { type: string | null; extra: string | null } {
  const r = rest.trim();
  if (!r) return { type: null, extra: null };
  const lead = r.match(/^(?:[;,]\s*|and\s+)(.+)$/i);
  if (lead) return { type: null, extra: lead[1] };
  const m = /(?:^|[,;]?\s+)plus\s+/i.exec(r);
  if (m) {
    return {
      type: r.slice(0, m.index).trim() || null,
      extra: r.slice(m.index + m[0].length).trim() || null,
    };
  }
  return { type: r, extra: null };
}

export function parseAttack(text: string): Attack | null {
  const m = normalize(text).match(ATTACK_RE);
  if (!m?.groups) return null;

  const g = m.groups;
  if (!g.iteratives && !g.inner) return null; // nothing attack-like found

  const dmg = g.inner?.match(DAMAGE_RE)?.groups;
  const { type, extra } = dmg ? splitRest(dmg.rest) : { type: null, extra: null };

  const isDice = g.quantity?.includes("d") ?? false;
  const effects = [dmg ? extra : (g.inner ?? null), g.postPlus].filter(Boolean).join("; ");

  const touch = Boolean(g.touch);

  return {
    quantity: g.quantity && !isDice ? Number(g.quantity) : 1,
    quantityRoll: isDice ? g.quantity : null,
    name: g.name.trim() || (touch ? "touch" : ""),
    attackNotes: g.attackNotes?.trim() ?? null,
    iteratives: g.iteratives ? g.iteratives.split("/").map(Number) : [],
    kind: (g.kind?.toLowerCase() as Attack["kind"]) ?? null,
    touch,
    damage: dmg?.damage.replace(/\s+/g, "") ?? null,
    critRange: dmg?.range ?? null,
    critMultiplier: dmg?.mult1 || dmg?.mult2 ? Number(dmg.mult1 ?? dmg.mult2) : null,
    damageType: type,
    additionalEffects: effects || null,
    restriction: g.restriction?.trim() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Melee / Ranged lines
// ---------------------------------------------------------------------------

export interface AttackLine {
  attacks: Attack[];
  /** Pieces of the line that did not look like an attack, kept so nothing is silently lost. */
  unparsed: string[];
}

/**
 * "mwk trident +18/+13/+8 (2d6+9) or 2 slams +17 (2d6+6), bite +10 (1d6)".
 * " or " separates alternative routines and "," separates attacks within one;
 * the Roll20 sheet wants each as its own row, so the result is flat.
 */
export function parseAttackLine(text: string): AttackLine {
  const result: AttackLine = { attacks: [], unparsed: [] };

  for (const alternative of splitTopLevelOnWord(text, "or")) {
    for (const piece of splitTopLevel(alternative, ",")) {
      const attack = parseAttack(piece);

      if (attack) result.attacks.push(attack);
      else result.unparsed.push(piece);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Speed / space / reach
// ---------------------------------------------------------------------------

// The sheet stores these as free text ("50 ft., fly 150 ft. (good)"), so we only clean them.
export function parseSpeed(text: string) {
  return trimTrailing(text);
}

export function parseSpace(text: string) {
  return trimTrailing(text);
}

export function parseReach(text: string) {
  return trimTrailing(text);
}

export function parseSpecialAttacks(text: string) {
  return splitTopLevel(trimTrailing(text), ",");
}

// ---------------------------------------------------------------------------
// Spell-like abilities / spells
// ---------------------------------------------------------------------------

export interface SpellLikeEntry {
  name: string | null;
  dc: string | null;
  notes: string | null;
}

const DC_PATTERN = /^DC\s+(\d+)(?:,\s*(.*))?$/;

/**
 * "discern lies (DC 21)", "lover's vengeance (DC 18, see page 62)", "holy aura (2) (DC 26)".
 * Every trailing parenthetical is read: a DC fills `dc`, anything else is joined into `notes`.
 */
export function parseSpellLikeEntry(text: string): SpellLikeEntry | null {
  const trimmed = text.trim();
  const firstParen = trimmed.indexOf("(");
  const rawName = firstParen === -1 ? trimmed : trimmed.slice(0, firstParen);
  const name = rawName.trim();

  if (!name) return null;
  if (firstParen === -1) return { name, dc: null, notes: null };

  // Spell notes can contain nested parens ("plane shift (a, b (c))"), so walk the groups
  // at depth 0 instead of using a regex over the whole tail.
  const groups = topLevelParenGroups(trimmed.slice(firstParen));
  let dc: string | null = null;
  const notes: string[] = [];

  for (const group of groups) {
    const dcMatch = group.match(DC_PATTERN);

    if (dcMatch) {
      dc = dcMatch[1]!;
      if (dcMatch[2]?.trim()) notes.push(dcMatch[2].trim());
    } else if (group.trim()) {
      notes.push(group.trim());
    }
  }

  return { name, dc, notes: notes.length ? notes.join("; ") : null };
}

function topLevelParenGroups(text: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (text[i] === ")" && depth > 0) {
      depth--;
      if (depth === 0) groups.push(text.slice(start, i));
    }
  }

  return groups;
}

export interface SpellGroup {
  /** "Constant", "At Will", "3/day", "9th", "0 (at will)" ... */
  frequency: string;
  spells: SpellLikeEntry[];
}

export interface SpellBlock {
  casterLevel: number | null;
  concentration: number | null;
  groups: SpellGroup[];
  body: string;
  unparsed: string[];
}

const BLOCK_HEADER = /^\(.*\)$/;
const CASTER_LEVEL = /\bCL\s*(\d+)/i;
const CONCENTRATION = /concentration\s*([+-]?\d+)/i;
const FREQUENCY_LINE = /^(.+?)\s*[\u2014\u2013]\s*(.+)$/;

/**
 * Parses the text of a "Spell-Like Abilities" / "Spells Prepared" / "Spells Known" field:
 *
 *   (CL 20th; concentration +25)
 *   Constant—detect evil, true seeing
 *   3/day—heal, wish (DC 25)
 */
export function parseSpellBlock(text: string): SpellBlock {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const block: SpellBlock = {
    casterLevel: null,
    concentration: null,
    groups: [],
    body: "",
    unparsed: [],
  };

  if (lines[0] && BLOCK_HEADER.test(lines[0])) {
    const header = lines.shift()!;
    const cl = header.match(CASTER_LEVEL)?.[1];
    const concentration = header.match(CONCENTRATION)?.[1];

    block.casterLevel = cl ? Number(cl) : null;
    block.concentration = concentration ? Number(normalize(concentration)) : null;
  }

  block.body = lines.join("\n");

  for (const line of lines) {
    const match = line.match(FREQUENCY_LINE);

    if (!match) {
      block.unparsed.push(line);
      continue;
    }

    const spells = splitTopLevel(match[2]!, ",")
      .map(parseSpellLikeEntry)
      .filter((e): e is SpellLikeEntry => e !== null);

    block.groups.push({ frequency: match[1]!.trim(), spells });
  }

  return block;
}
