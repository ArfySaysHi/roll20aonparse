/**
 * English labels the sheet shows after a spell-like ability's name ("Heal — <label>").
 *
 * PROVISIONAL: the sheet reads these from its translation.json via getTranslationByKey, which
 * wasn't available, so the wording below is a best guess. Only `spelldisplay` text depends on
 * it; correcting a string here is the whole fix.
 */
export const SPELL_LABELS = {
  constant: "Constant",
  "at-will": "At Will",
  "per-hour": "per hour",
  "per-day": "per day",
  "per-week": "per week",
  "per-month": "per month",
  "per-year": "per year",
  // "X" is replaced with the number of hours
  "every-hours": "every X hours",
  // The sheet's name for the second damage line, used only when a spell has one.
  damage2: "Damage 2",
} as const;

export type SpellLabels = Record<keyof typeof SPELL_LABELS, string>;
