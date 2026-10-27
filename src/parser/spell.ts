import { splitBody } from "./split";
import type { RawEntry, RawSection } from "./types";
import { trimTrailing } from "../shared/strings";
import { fieldText, sectionProse } from "./values/entries";
import { parseSource } from "./values/fields/details";
import { parseSpellLevels, parseSpellSchool, type SpellLevel } from "./values/fields/spell";

export interface Spell {
  name: string;
  source: { name: string; page: string } | null;
  school: string | null;
  subschools: string[];
  descriptors: string[];
  levels: SpellLevel[];
  castingTime: string | null;
  components: string | null;
  range: string | null;
  area: string | null;
  target: string | null;
  effect: string | null;
  duration: string | null;
  savingThrow: string | null;
  spellResistance: string | null;
  description: string | null;
}

const TABLE = "#MainContent_DataListTypes";
const RESULT_SPAN_PREFIX = "MainContent_DataListTypes_LabelName_";

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;
const isTitle = (node: Node) => isElement(node) && node.matches("h1.title");
// The mythic version of a spell sits in an <h2 class="title"> inside the base spell's block.
const isMythicTitle = (node: Node) => isElement(node) && node.matches("h2.title");
const isSectionHeading = (node: Node) => isElement(node) && node.matches("h3.framing");

/**
 * Parses a Nethys spell page. One page can hold several spells: searching for
 * "Spell Immunity, Greater" returns the whole Spell Immunity family, and "fireball" returns
 * Fireball and Controlled Fireball. Use `findSpell` to pick the one you asked for.
 */
export function parseSpellPage(doc: Document): Spell[] {
  const table = doc.querySelector(TABLE);
  if (!table) return [];

  const spells: Spell[] = [];

  for (const span of Array.from(table.querySelectorAll("span"))) {
    if (!span.id.startsWith(RESULT_SPAN_PREFIX)) continue;

    for (const { title, body } of splitAtTitles(Array.from(span.childNodes))) {
      const spell = parseSpell(title, body);
      if (spell) spells.push(spell);
    }
  }

  return spells;
}

function splitAtTitles(nodes: Node[]) {
  const groups: { title: Node; body: Node[] }[] = [];

  for (const node of nodes) {
    if (isTitle(node)) groups.push({ title: node, body: [] });
    else groups.at(-1)?.body.push(node);
  }

  return groups;
}

function parseSpell(title: Node, body: Node[]): Spell | null {
  const name = title.textContent?.trim() ?? "";
  if (!name) return null;

  // header (source / school / level), then Casting / Effect / Description sections
  const header: Node[] = [];
  const sections: { heading: string; nodes: Node[] }[] = [];

  for (const node of body) {
    if (isMythicTitle(node)) break; // everything after belongs to the mythic variant
    if (isSectionHeading(node))
      sections.push({ heading: node.textContent?.trim() ?? "", nodes: [] });
    else (sections.at(-1)?.nodes ?? header).push(node);
  }

  const entries: RawEntry[] = [
    ...splitBody(header),
    ...sections.filter((s) => s.heading !== "Description").flatMap((s) => splitBody(s.nodes)),
  ];
  const fields: RawSection = { heading: name, entries };

  const description = sections.find((s) => s.heading === "Description");
  const text = (...labels: string[]) => {
    for (const label of labels) {
      const value = fieldText(fields, label);
      if (value !== null && trimTrailing(value) !== "") return trimTrailing(value);
    }
    return null;
  };

  const school = parseSpellSchool(text("School") ?? "");
  const source = text("Source");

  return {
    name,
    source: source ? parseSource(source) : null,
    school: school?.school ?? null,
    subschools: school?.subschools ?? [],
    descriptors: school?.descriptors ?? [],
    levels: parseSpellLevels(text("Level") ?? ""),
    castingTime: text("Casting Time"),
    components: text("Components"),
    range: text("Range"),
    area: text("Area"),
    target: text("Target", "Targets"),
    effect: text("Effect"),
    duration: text("Duration"),
    savingThrow: text("Saving Throw"),
    spellResistance: text("Spell Resistance"),
    description: description
      ? sectionProse({ heading: "Description", entries: splitBody(description.nodes) })
      : null,
  };
}
