import type { RawEntry, RawSection } from "../types";

type FieldEntry = Extract<RawEntry, { kind: "field" }>;

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function fieldsOf(section: RawSection | null): FieldEntry[] {
  return section?.entries.filter((e): e is FieldEntry => e.kind === "field") ?? [];
}

/** Text of the first field with this label (case-insensitive), or null. */
export function fieldText(section: RawSection | null, label: string): string | null {
  return fieldsOf(section).find((e) => sameLabel(e.label, label))?.text ?? null;
}

/** Fields whose label satisfies the predicate, in page order. */
export function fieldsMatching(section: RawSection | null, test: (label: string) => boolean) {
  return fieldsOf(section).filter((e) => test(e.label));
}

/** Everything in a section that isn't a heading, as readable prose. */
export function sectionProse(section: RawSection | null): string | null {
  if (!section) return null;

  const text = section.entries
    .map((e) => (e.kind === "field" ? `${e.label} ${e.text}`.trim() : e.text))
    .join("\n\n")
    .trim();

  return text === "" ? null : text;
}
