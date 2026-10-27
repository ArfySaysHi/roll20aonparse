/**
 * Splits `str` on a single-character delimiter, ignoring delimiters inside parentheses.
 * "a (b, c), d" split on "," -> ["a (b, c)", "d"]
 */
export function splitTopLevel(str: string, delimiter = ",") {
  const parts = [];
  let depth = 0;
  let current = "";

  for (const char of str) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === delimiter && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) parts.push(current.trim());

  return parts.filter(Boolean);
}

/**
 * Like splitTopLevel, but splits on a whole word (case-insensitive, word boundaries)
 * rather than a character. "bite +5 (1d6 or 1d8) or claw +3" split on "or" ->
 * ["bite +5 (1d6 or 1d8)", "claw +3"]
 */
export function splitTopLevelOnWord(str: string, word: string) {
  const re = new RegExp(`\\b${word}\\b`, "gi");

  // Paren depth *before* each index, computed once over the whole string so that
  // word-boundary checks keep their surrounding context.
  const depthAt: number[] = new Array(str.length + 1).fill(0);
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    depthAt[i] = depth;
    if (str[i] === "(") depth++;
    else if (str[i] === ")") depth = Math.max(0, depth - 1);
  }
  depthAt[str.length] = depth;

  const parts: string[] = [];
  let segmentStart = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(str))) {
    if (depthAt[match.index] === 0) {
      parts.push(str.slice(segmentStart, match.index).trim());
      segmentStart = re.lastIndex;
    }
  }

  parts.push(str.slice(segmentStart).trim());

  return parts.filter(Boolean);
}

/**
 * Flattens the typographic characters Nethys uses (en/em dashes, smart quotes, the
 * multiplication sign, footnote marks) into plain ASCII and collapses whitespace.
 */
export function normalize(text: string): string {
  return text
    .replace(/[\u2212\u2013\u2014\u2010\u2011\u2012\u2015]/g, "-")
    .replace(/\u00ad/g, "")
    .replace(/[\u2019]/g, "'")
    .replace(/\u00d7/g, "x")
    .replace(/[*\u2020]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/([+-])\s+(\d)/g, "$1$2")
    .replace(/(\d)\s*-\s*(\d)/g, "$1-$2")
    .trim();
}

/** Trims whitespace plus the trailing `,` / `;` Nethys leaves between inline fields. */
export function trimTrailing(text: string): string {
  return text.trim().replace(/[\s,;]+$/, "");
}

/** Nethys wraps long lines in the HTML, so a field can contain stray newlines. Flatten them. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
