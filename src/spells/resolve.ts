import { parseSpellPage, type Spell } from "../parser/spell";
import type { SpellBlock } from "../parser/values/fields/offense";
import { isUnreachableError, type FetchPageResponse } from "../shared/protocol";
import { findSpell, nethysSpellName, spellPageUrl } from "./lookup";
import { splitMetamagic } from "./metamagic";

export interface SpellResolverDeps {
  fetchPage(url: string): Promise<FetchPageResponse>;
  parseHtml(html: string): Document;
  onProgress?(done: number, total: number): void;
}

export interface ResolveOptions {
  /** Pages fetched at once. Kept low so a big statblock doesn't hammer Nethys. */
  concurrency?: number;
}

export interface ResolvedSpells {
  /** Looks a spell up by the name as written in the statblock (case-insensitive). */
  get(name: string): Spell | null;
  /** Names that couldn't be fetched, weren't on the page, or didn't match a title exactly. */
  missed: string[];
  /**
   * The subset of `missed` whose page couldn't be fetched at all (offline, no permission, the
   * extension unreachable), as opposed to Nethys answering without the spell (a 404, or a page
   * that loaded but doesn't hold it). Optional so a hand-built
   * resolver, as in tests, doesn't need it.
   */
  unreachable?: string[];
}

/** One key per spell, however the statblock spells it: "Fireball" and "fireball" are the same. */
export const spellKey = (name: string) => nethysSpellName(name).toLowerCase();

/** Every spell written in the given casting blocks, without any metamagic prefix. */
export function spellNames(...blocks: (SpellBlock | null)[]): string[] {
  return blocks.flatMap((block) =>
    (block?.groups ?? []).flatMap((group) =>
      group.spells.flatMap((spell) => (spell.name ? [splitMetamagic(spell.name).base] : [])),
    ),
  );
}

/**
 * Fetches and parses the Nethys page for each distinct spell. Never throws: a spell that can't
 * be resolved is reported in `missed` and the import carries on without its details.
 */
export async function resolveSpells(
  names: string[],
  deps: SpellResolverDeps,
  { concurrency = 3 }: ResolveOptions = {},
): Promise<ResolvedSpells> {
  // distinct by key, keeping the first spelling and the statblock's order
  const distinct = new Map<string, string>();
  for (const name of names) if (!distinct.has(spellKey(name))) distinct.set(spellKey(name), name);
  const wanted = [...distinct.values()];
  const results: (Spell | null)[] = new Array(wanted.length).fill(null);
  const unreachableKeys = new Set<string>();

  let next = 0;
  let done = 0;

  const worker = async () => {
    while (next < wanted.length) {
      const index = next++;
      const outcome = await resolveOne(wanted[index]!, deps);
      results[index] = outcome.spell;
      if (outcome.unreachable) unreachableKeys.add(spellKey(wanted[index]!));
      deps.onProgress?.(++done, wanted.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, wanted.length) }, worker));

  const found = new Map<string, Spell>();
  const missed: string[] = [];

  wanted.forEach((name, index) => {
    const spell = results[index];
    if (spell) found.set(spellKey(name), spell);
    else missed.push(name);
  });

  return {
    get: (name) => found.get(spellKey(name)) ?? null,
    missed,
    unreachable: missed.filter((name) => unreachableKeys.has(spellKey(name))),
  };
}

async function resolveOne(
  name: string,
  deps: SpellResolverDeps,
): Promise<{ spell: Spell | null; unreachable: boolean }> {
  let page: FetchPageResponse;

  try {
    page = await deps.fetchPage(spellPageUrl(name));
  } catch {
    return { spell: null, unreachable: true }; // e.g. a rejected extension message
  }

  if (!page.ok) return { spell: null, unreachable: isUnreachableError(page.error) };

  try {
    return { spell: findSpell(parseSpellPage(deps.parseHtml(page.html)), name), unreachable: false };
  } catch {
    return { spell: null, unreachable: false }; // a parse error: the page loaded but is unreadable
  }
}
