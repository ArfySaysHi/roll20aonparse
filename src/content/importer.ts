import { parseNpc } from "../parser/npc";
import type { FetchPageResponse, PageImportResult } from "../shared/protocol";
import { parseNethysUrl } from "../shared/urls";
import type { CastingStatChoice } from "../sheet/castingStat";
import { toSheet } from "../sheet/pathfinder1";
import type { SheetImport } from "../sheet/types";
import { resolveSpells, spellNames } from "../spells/resolve";

export interface ImporterDeps {
  fetchPage(url: string): Promise<FetchPageResponse>;
  sendToPage(payload: SheetImport): Promise<PageImportResult>;
  parseHtml(html: string): Document;
}

export interface ImportOptions {
  /** Fetch each spell's Nethys page and fill in its details (one request per distinct spell). */
  includeSpells?: boolean;
  /** Stat that prepared / known spells cast with, for spells whose DC the stat block omits. */
  castingStat?: CastingStatChoice;
  /** Called as spell pages are fetched, so the panel can show "Fetching spells 3/12". */
  onProgress?(done: number, total: number): void;
}

export type ImportOutcome =
  | { ok: true; name: string; warnings: string[] }
  | { ok: false; error: string };

/** Nethys link -> fetched page -> Npc -> (spell details) -> sheet attributes -> written into Roll20. */
export async function importFromUrl(
  rawUrl: string,
  deps: ImporterDeps,
  options: ImportOptions = {},
): Promise<ImportOutcome> {
  const url = parseNethysUrl(rawUrl);
  if (!url) return { ok: false, error: "Paste a link from aonprd.com." };

  const page = await deps.fetchPage(url.href);
  if (!page.ok) return { ok: false, error: page.error };

  const npc = parseNpc(deps.parseHtml(page.html));
  if (!npc) return { ok: false, error: "That page doesn't look like a monster stat block." };

  const spells = options.includeSpells
    ? await resolveSpells(spellNames(npc.spellLikeAbilities, npc.spells), {
        fetchPage: deps.fetchPage,
        parseHtml: deps.parseHtml,
        onProgress: options.onProgress,
      })
    : null;

  const sheet = toSheet(npc, { spells, castingStat: options.castingStat });
  const unreachable = new Set(spells?.unreachable ?? []);
  const warnings = [
    ...sheet.warnings,
    ...(spells?.missed.map((name) =>
      unreachable.has(name)
        ? `Could not reach Nethys for spell "${name}"`
        : `No Nethys page found for spell "${name}"`,
    ) ?? []),
  ];

  const result = await deps.sendToPage({ ...sheet, warnings });
  if (!result.ok) return { ok: false, error: result.error ?? "Roll20 rejected the import." };

  // An explicit `false`: the character was written but its sheet couldn't be told to recalculate.
  if (result.notified === false) {
    warnings.push("The sheet was not asked to recalculate; if any values look wrong, open the character once");
  }

  return { ok: true, name: npc.name, warnings };
}

export function describeOutcome(outcome: ImportOutcome): string {
  if (!outcome.ok) return `Failed: ${outcome.error}`;

  const notes = outcome.warnings.length;
  return notes === 0
    ? `Imported ${outcome.name}.`
    : `Imported ${outcome.name}, with ${notes} note${notes === 1 ? "" : "s"} to check (listed below).`;
}
