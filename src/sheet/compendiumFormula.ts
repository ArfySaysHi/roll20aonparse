export enum SpellType {
  SPELL = "1",
  SPELLLIKE = "2",
}

/**
 * Port of the sheet's `parse_compendium_formula`: turns the prose damage / duration text the
 * sheet's compendium stores ("1d6 points of fire damage per caster level (maximum 10d6)")
 * into a roll expression that reads the caster's level from the sheet.
 *
 * Only these shapes are converted (anything else comes back unchanged):
 *   1d6 ... per caster level (... maximum 10d6)
 *   1d6 ... per two caster levels (... maximum 10d6)
 *   1d8 ... + 1 point per caster level (maximum +25)
 *   2d10 rounds   (the "rounds" is dropped)
 *
 * @param caster which caster block the spell uses: "1" for spells, "2" for spell-like abilities
 * @param inline keep the original text and append the roll, e.g. for descriptions
 */
export function compendiumFormula(
  formula: string,
  caster = SpellType.SPELL,
  inline = false,
): string {
  let result = formula.trim();
  if (!result) return result;

  const level = `@{caster${caster}_level}`;

  const rules: { pattern: RegExp; original: string; replacement: string }[] = [
    {
      pattern: /(\d+)(d\d+)([^$,\.]*per\s+caster\s+level\s+\([^\)]*maximum\s+)(\d+)(d\d+\))/gi,
      original: "$1$2$3$4$5",
      replacement: `[[{($1*${level}),$4}kl1]]$2`,
    },
    {
      pattern:
        /(\d+)(d\d+)([^$,\.]*per\s+two\s+caster\s+levels\s+\([^\)]*maximum\s+)(\d+)(d\d+\))/gi,
      original: "$1$2$3$4$5",
      replacement: `[[{($1*[[{floor((${level}/2)),1}kh1]]),$4}kl1]]$2`,
    },
    {
      pattern:
        /(\d+d\d+)([^,\.]*?(?=\+))(\+\s*)(\d+)(.+?(?=per))(per\s+caster\s+level\s+\(maximum\s+\+)(\d+)(\s*\))/gi,
      original: "$1$2$3$4$5$6$7$8",
      replacement: `$1+{($4*${level}),$7}kl1`,
    },
    { pattern: /(\d+d\d+)(\s+rounds)/gi, original: "$1$2", replacement: "$1" },
  ];

  for (const { pattern, original, replacement } of rules) {
    if (!pattern.test(result)) continue;
    pattern.lastIndex = 0; // `test` on a global regex advances it

    result = result.replace(pattern, inline ? `${original} ([[${replacement}]])` : replacement);
  }

  return result;
}
