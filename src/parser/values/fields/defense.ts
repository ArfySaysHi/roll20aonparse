import { trimTrailing } from "../../../shared/strings";
import { parseModifier, parseModifierPlusNotes } from "./shared";

const AC = /^(\d+)\,\stouch\s(\d+)\,\sflat\-footed\s(\d+)(?:\s+\((.+)\))?$/;

export function parseAc(text: string) {
  const match = text.match(AC);

  if (!match) return null;

  const [, ac, touch, flatFooted, notes] = match;

  return { ac, touch, flatFooted, notes: notes ?? null };
}

const HP = /^(\d+)\s\((.+?)\)(?:\;\s+(.+?))?$/;

export function parseHp(text: string) {
  const match = text.match(HP);

  if (!match) return null;

  const [, hp, hd, notes] = match;

  return { hp, hd, notes: notes ?? null };
}

export function parseSave(text: string) {
  return parseModifierPlusNotes(text);
}

// DR / Immune / Resist / Weaknesses / Defensive Abilities are kept as the statblock's own
// prose (the Roll20 sheet stores them as free text); we only strip the field separator.
export function parseDr(text: string) {
  return trimTrailing(text);
}

export function parseImmune(text: string) {
  return trimTrailing(text);
}

export function parseResist(text: string) {
  return trimTrailing(text);
}

export function parseWeaknesses(text: string) {
  return trimTrailing(text);
}

export function parseDefensiveAbilities(text: string) {
  return trimTrailing(text);
}

export function parseSr(text: string) {
  return parseModifier(trimTrailing(text));
}
