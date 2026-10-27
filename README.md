# Roll20 Nethys NPC Importer

Browser extension (Chrome + Firefox) that imports a Pathfinder 1e monster stat block from
[Archives of Nethys](https://aonprd.com) into Roll20, using the **Pathfinder by Roll20** sheet.

## Use

1. `yarn install && yarn build` (or `yarn build:chrome` / `yarn build:firefox`)
2. Load the extension
   - **Chrome** (111+): `chrome://extensions` → Developer mode → *Load unpacked* → `dist/chrome`
   - **Firefox** (128+): `about:debugging` → *Load Temporary Add-on* → `dist/firefox/manifest.json`.
     Firefox MV3 treats host permissions as optional: in `about:addons` → the extension →
     *Permissions*, allow access to aonprd.com.
3. Open a Roll20 game (the editor), click the **N** button bottom-right, paste a link such as
   `https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar`, and press Import.

A new character is created and filled in. The status line says what happened, and anything that
couldn't be read (or needs a second look) is listed under it and logged to the console as
`[nethys-importer]`. If the import fails part-way, the half-written character is removed.

Fetched Nethys pages are cached for a week (capped at 150 pages / 4 MB, oldest first). **Clear
cached pages** in the panel empties the cache.

## How it works

```
Nethys page ──fetch──▶ background ──html──▶ content script
                                              │ parseNpc()  (src/parser)
                                              │ toSheet()   (src/sheet)
                                              ▼
                                  postMessage ▶ injected script (Roll20's own JS world)
                                              writes attributes via Campaign / d20
```

| Dir | Role |
| --- | --- |
| `src/parser/dom` | locate the stat block and its sections in the page |
| `src/parser/split.ts` | split each section into labelled fields |
| `src/parser/values/fields` | parse individual fields (AC, attacks, skills, spell blocks, ...) |
| `src/parser/npc.ts` | `parseNpc(document)` → typed `Npc` (+ `warnings`) |
| `src/sheet` | `toSheet(npc)` → Roll20 attribute names / repeating rows |
| `src/background` | fetches Nethys (avoids CORS); only allows aonprd.com |
| `src/content` | UI panel, import pipeline, postMessage bridge |
| `src/injected` | runs in Roll20's page world and writes the character |
| `manifest/` | per-browser manifests (service worker vs. background scripts) |

## Tests

`yarn test` (vitest + jsdom). Fixtures are in `fixtures/`; attack-string cases live in
`fixtures/attack.ts`. `yarn typecheck` runs `tsc`.

## Spell DCs

A DC printed in the stat block is always used. For prepared / known spells that print none, the
importer sets 10 + spell level + the casting stat's modifier. The casting stat comes from, in order:
the **Casting stat** you pick in the panel, then the stat block's own numbers (concentration is
caster level + casting modifier, and any printed DCs), then the class's usual stat. If those don't
agree (an archetype that casts with a different stat) or nothing identifies the caster, the import
lists a note saying what was assumed. Spell-like abilities keep only their printed DCs.

## Known limits

- A page with several stat blocks (dragons by age, elementals by size) imports only the first, and
  says so. Multiple casting blocks are merged and use the first block's caster level.
- Mythic rank has no sheet field, so it is written at the top of the background text.
- Skills the sheet has a single field for (Craft / Perform / Profession with several subjects) keep
  the first in the field; the rest go in `skills_notes`.
- Spells / spell-like abilities are written as the sheet's *notes* fields (plus caster level),
  not as compendium-linked spell rows.
- Feats are written as plain feat rows (no compendium lookup / descriptions).
- Skills with no sheet field (e.g. `Knowledge (all)`) go into `skills_notes`.
