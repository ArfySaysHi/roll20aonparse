import { normalize, splitTopLevel } from "../../../shared/strings";
import { parseModifier } from "./shared";

// Matches the name of the npc til " CR ", then tries to match numbers until it hits a non-number.
// If the non-number is a '/' it will try to continue matching (for fractional CRs).
// Mythic monsters print "CR 10/MR 3"; the mythic rank is returned separately, only when present.
const HEADING = /^(.+?)\sCR\s(\d+(?:\/\d+)?)(?:\/MR\s(\d+))?$/;

export function parseHeading(text: string) {
  const match = text.match(HEADING);
  if (!match) return null;

  const [, name, cr, mythicRank] = match;
  return { name: name!, cr: cr!, ...(mythicRank && { mythicRank: Number(mythicRank) }) };
}

const SOURCE = /^(.+?)\spg\.\s(\d+)/;

export function parseSource(text: string) {
  const match = text.match(SOURCE);
  return match ? { name: match[1]!, page: match[2]! } : null;
}

// Only the first line is XP: the class / type lines Nethys prints underneath it
// end up in the same field (they have no <b> label of their own).
const XP = /^(\d[\d,]*)/;

export function parseXp(text: string) {
  const match = text.trim().match(XP);
  return match ? Number(match[1]!.replace(/,/g, "")) : null;
}

const NOTE_TAIL = /\s*\(([^)]*)\)$/;
const CLASS_PART = /^([A-Za-z][\w' -]*?)\s(\d+)$/;

export function parseClassLine(text: string) {
  const note = text.match(NOTE_TAIL)?.[1] ?? null;
  const body = text.replace(NOTE_TAIL, "").trim();

  const parts = splitTopLevel(body, "/").map((p) => p.trim().match(CLASS_PART));
  if (parts.length === 0 || parts.some((p) => p === null)) return null;

  return {
    classes: parts.map((p) => ({ name: p![1]!, level: Number(p![2]) })),
    note,
  };
}

const TYPE_LINE = /^(.+?)\s(.+?)\s(.+)/;

export function parseTypeLine(text: string) {
  const note = text.match(NOTE_TAIL)?.[1] ?? null;
  const body = text.replace(NOTE_TAIL, "").trim();

  const match = body.match(TYPE_LINE);
  return match ? { alignment: match[1]!, size: match[2]!, type: match[3]!, subtypes: note } : null;
}

export function parseInit(text: string) {
  return parseModifier(text);
}

// "darkvision 60 ft.; Perception +33" or just "Perception +5" when there are no other senses
const SENSES_PERCEPTION = /^(?:(.*?);\s*)?Perception\s*([+-]\d+)\s*$/;

export function parseSenses(text: string) {
  const perceptionMatch = normalize(text).match(SENSES_PERCEPTION);

  if (!perceptionMatch) return null;
  const [, senses, perceptionMod] = perceptionMatch;
  const perception = perceptionMod ? parseModifier(perceptionMod) : null;

  const sensesFormatted = splitTopLevel(senses ?? "", ",").map(parseSense);

  return { senses: sensesFormatted, perception };
}

const SENSE = /^(.+?)(?:\s+(\d+\s+ft\.?))?$/;

export function parseSense(text: string) {
  const match = text.match(SENSE);

  if (!match) return null;

  const [, sense, distance] = match;

  return { name: sense ?? null, range: distance ?? null };
}

const ALIGNMENTS = "LG|LN|LE|NG|NE|CG|CN|CE|N";
const SIZES = "Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal";
const TYPE_LINE_START = new RegExp(`^(?:${ALIGNMENTS})\\s+(?:${SIZES})\\b`);

/**
 * The lines under XP are "[race/class line]" then "alignment size type (subtypes)".
 * The type line is the one that starts with an alignment and a size; a class line,
 * when present, sits directly above it.
 */
export function classifyDetailLines(lines: string[]) {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);
  const typeIndex = trimmed.findIndex((l) => TYPE_LINE_START.test(l));

  if (typeIndex === -1) return { classLine: null, typeLine: null };

  return {
    classLine: typeIndex > 0 ? trimmed[typeIndex - 1]! : null,
    typeLine: trimmed[typeIndex]!,
  };
}
