// Statblocks use a real minus sign / en dash for negatives ("–1 size").
const LEADING_MINUS = /^[\u2212\u2013\u2014]/;

const MODIFIER = /(\-)?(\d+)/;

export function parseModifier(text: string) {
  const match = text.trim().replace(LEADING_MINUS, "-").match(MODIFIER);

  return match && !isNaN(Number(match[0])) ? Number(match[0]) : null;
}

const MODIFIER_NOTES = /^([+-]?\d+)[\;\,]?(?:\s(.+))?$/;

export function parseModifierPlusNotes(text: string) {
  const match = text.trim().replace(LEADING_MINUS, "-").match(MODIFIER_NOTES);

  if (!match) return null;

  const [, rawMod, notes] = match;

  if (!rawMod) return null;

  const mod = !isNaN(Number(rawMod)) ? Number(rawMod) : null;

  return { mod, notes: notes ?? null };
}

const DISTANCE = /^(\d+)\s(\w+)/;

export function parseDistance(text: string) {
  const match = text.match(DISTANCE);

  if (!match) return null;

  const [, value, unit] = match;

  return { value, unit };
}
