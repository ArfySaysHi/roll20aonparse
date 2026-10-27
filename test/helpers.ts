import { readFileSync } from "node:fs";
import { parseNpc, type Npc } from "../src/parser/npc";
import { parseSpellPage, type Spell } from "../src/parser/spell";

export const docFromHtml = (html: string) => new DOMParser().parseFromString(html, "text/html");

export function loadFixture(name: "solar" | "marid" | "mummy-lord" | "lich"): Npc {
  const npc = parseNpc(docFromHtml(readFileSync(`./fixtures/${name}.html`, "utf8")));
  if (!npc) throw new Error(`fixture ${name} did not parse`);
  return npc;
}

/** A small hand-written stat block, for testing absent / malformed sections. */
export function statblock(parts: { details?: string; sections?: string } = {}) {
  return docFromHtml(
    `<span id="MainContent_DataListFeats_Label1_0">` +
      `<h1 class="title">Goblin</h1>` +
      `<h2 class="title">Goblin CR 1/3</h2>` +
      (parts.details ?? `<b>XP</b> 135<br>NE Small humanoid (goblinoid)<br><b>Init</b> +6;`) +
      (parts.sections ?? "") +
      `</span>`,
  );
}

export type SpellFixture =
  | "spell-cure-light-wounds-mass"
  | "spell-fireball"
  | "spell-immunity-greater"
  | "spell-bulls-strength";

export function loadSpellPage(name: SpellFixture): Spell[] {
  return parseSpellPage(docFromHtml(readFileSync(`./fixtures/${name}.html`, "utf8")));
}
