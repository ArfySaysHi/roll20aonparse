import type { AttributeWrite, SheetImport } from "../sheet/types";

// The slice of Roll20's Backbone models we use.
export interface AttribModel {
  get(name: string): unknown;
  syncedSave(values: Record<string, string>): Promise<unknown> | unknown;
}

/** Every character carries its own `d20.journal`, which can tell its sheet workers about changes. */
export interface CharacterJournal {
  notifyWorkersOfAttrChanges?(characterId: string, names: string[], who: string): void;
}

export interface CharacterModel {
  id: string;
  /** Backbone's `destroy`: removes the character, used to clean up after a failed import. */
  destroy?(): unknown;
  d20?: { journal?: CharacterJournal };
  attribs: {
    /** Backbone's model list. Read once up front so we don't search it for every attribute. */
    models?: AttribModel[];
    find(predicate: (attrib: AttribModel) => boolean): AttribModel | undefined;
    /** Saves the new attribute with everything passed in: one write, no follow-up save. */
    create(props: { name: string; current?: string; max?: string }): AttribModel;
  };
}

export interface Roll20Env {
  createCharacter(props: { name: string }): CharacterModel;
}

export interface WriteOptions {
  /** Attributes sent per batch. `Infinity` sends everything at once. */
  batchSize?: number;
  /** Pause between batches, so a big import doesn't hit Roll20 in one burst. */
  batchDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_BATCH_SIZE = 100;
export const DEFAULT_BATCH_DELAY_MS = 100;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const lower = (value: unknown) => String(value ?? "").toLowerCase();

/** Looks an attribute up by name (case-insensitive), from one snapshot of the existing ones. */
function indexAttributes(character: CharacterModel): (name: string) => AttribModel | undefined {
  const { models } = character.attribs;

  if (!Array.isArray(models)) {
    return (name) => character.attribs.find((a) => lower(a.get("name")) === name.toLowerCase());
  }

  const byName = new Map<string, AttribModel>();
  for (const model of models) byName.set(lower(model.get("name")), model);
  return (name) => byName.get(name.toLowerCase());
}

/** Only send what we have: an explicit `max: undefined` could clear an existing value. */
function valuesOf({ current, max }: AttributeWrite): Record<string, string> {
  const values: Record<string, string> = {};
  if (current !== undefined) values.current = current;
  if (max !== undefined) values.max = max;
  return values;
}

async function writeOne(
  character: CharacterModel,
  existing: (name: string) => AttribModel | undefined,
  write: AttributeWrite,
) {
  const attrib = existing(write.name);

  // An attribute that's already there is updated; a new one is created in a single write.
  if (attrib) await attrib.syncedSave(valuesOf(write));
  else character.attribs.create({ name: write.name, ...valuesOf(write) });
}

/** The row-order attribute for each repeating section, appended to whatever order already exists. */
function rowOrderWrites(
  data: SheetImport,
  existing: (name: string) => AttribModel | undefined,
): AttributeWrite[] {
  return Object.entries(data.rowOrders).map(([section, ids]) => {
    const name = `_reporder_repeating_${section}`;
    const previous = String(existing(name)?.get("current") ?? "")
      .split(",")
      .filter(Boolean);

    return { name, current: [...previous, ...ids].join(",") };
  });
}

/** Best effort: true when the character was removed. */
function discard(character: CharacterModel): boolean {
  try {
    if (typeof character.destroy !== "function") return false;
    character.destroy();
    return true;
  } catch {
    return false;
  }
}

export interface WriteResult {
  characterId: string;
  /** False when the character had no journal to notify, so its sheet workers weren't told. */
  notified: boolean;
}

/** Creates the character and writes every attribute in batches, then notifies its sheet workers. */
export async function writeImport(
  env: Roll20Env,
  data: SheetImport,
  {
    batchSize = DEFAULT_BATCH_SIZE,
    batchDelayMs = DEFAULT_BATCH_DELAY_MS,
    sleep = defaultSleep,
  }: WriteOptions = {},
): Promise<WriteResult> {
  const character = env.createCharacter({ name: data.name });
  const existing = indexAttributes(character);

  const writes = [...data.attributes, ...rowOrderWrites(data, existing)];
  const size = Math.max(1, batchSize);

  try {
    for (let start = 0; start < writes.length; start += size) {
      const batch = writes.slice(start, start + size);
      await Promise.all(batch.map((write) => writeOne(character, existing, write)));

      if (start + size < writes.length) await sleep(batchDelayMs);
    }
  } catch (error) {
    // The character already exists in the journal. Don't leave a half-filled one behind.
    const removed = discard(character);
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `${message}. ` +
        (removed
          ? "The partly written character was removed."
          : "A partly written character may remain in the journal; delete it before retrying."),
      { cause: error },
    );
  }

  // Asks the sheet to recalculate the changed attributes. Best effort: the journal belongs to the
  // character's sheet, and what it does when the sheet isn't open isn't something we control.
  const journal = character.d20?.journal;
  const names = writes.map((w) => w.name);
  const notified = typeof journal?.notifyWorkersOfAttrChanges === "function";

  if (notified) journal!.notifyWorkersOfAttrChanges!(character.id, names, "player");

  return { characterId: character.id, notified };
}
