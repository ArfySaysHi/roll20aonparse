import { describe, test, expect, vi } from "vitest";
import {
  DEFAULT_BATCH_DELAY_MS,
  DEFAULT_BATCH_SIZE,
  writeImport,
  type AttribModel,
  type CharacterJournal,
  type CharacterModel,
} from "../../src/injected/writer";
import type { SheetImport } from "../../src/sheet/types";

interface FakeAttrib {
  name: string;
  current?: string;
  max?: string;
  /** What `create` was called with, if it was created rather than pre-existing. */
  created?: Record<string, string>;
  saves: Record<string, string>[];
}

/** A character that records every create and save, in the order they happen. */
function fakeCharacter(
  existing: Record<string, string> = {},
  { journal, exposeModels = true }: { journal?: CharacterJournal; exposeModels?: boolean } = {},
) {
  const attribs: FakeAttrib[] = Object.entries(existing).map(([name, current]) => ({
    name,
    current,
    saves: [],
  }));
  const log: string[] = [];

  const wrap = (a: FakeAttrib): AttribModel => ({
    get: (key) => (key === "name" ? a.name : key === "current" ? a.current : undefined),
    syncedSave: async (values) => {
      log.push(`save:${a.name}`);
      a.saves.push(values);
      if (values.current !== undefined) a.current = values.current;
    },
  });

  const character: CharacterModel = {
    id: "char-1",
    ...(journal && { d20: { journal } }),
    attribs: {
      ...(exposeModels && {
        get models() {
          return attribs.map(wrap);
        },
      }),
      find: (predicate) => {
        const found = attribs.find((a) => predicate(wrap(a)));
        return found && wrap(found);
      },
      create: (props) => {
        log.push(`create:${props.name}`);
        const { name, ...values } = props;
        const a: FakeAttrib = { name, ...values, created: { ...values }, saves: [] };
        attribs.push(a);
        return wrap(a);
      },
    },
  };

  return { character, attribs, log, get: (name: string) => attribs.find((a) => a.name === name) };
}

const sheet = (overrides: Partial<SheetImport> = {}): SheetImport => ({
  name: "Solar",
  attributes: [
    { name: "npc", current: "1" },
    { name: "hp", current: "363", max: "363" },
    { name: "repeating_npcatk-melee_-id1_atkname", current: "slam" },
  ],
  rowOrders: { "npcatk-melee": ["-id1"] },
  warnings: [],
  ...overrides,
});

const many = (n: number): SheetImport["attributes"] =>
  Array.from({ length: n }, (_, i) => ({ name: `attr${i}`, current: String(i) }));

const instant = async () => {};

function setup(
  existing: Record<string, string> = {},
  options: Parameters<typeof fakeCharacter>[1] = {},
) {
  const journal = { notifyWorkersOfAttrChanges: vi.fn() };
  const fake = fakeCharacter(existing, { journal, ...options });
  const env = { createCharacter: vi.fn(() => fake.character) };
  return { fake, env, journal };
}

describe("writeImport: writing attributes", () => {
  test("creates the character with the sheet's name", async () => {
    const { env } = setup();

    await writeImport(env, sheet(), { sleep: instant });

    expect(env.createCharacter).toHaveBeenCalledWith({ name: "Solar" });
  });

  test("a new attribute is created with its value in a single write, with no follow-up save", async () => {
    const { env, fake } = setup();

    await writeImport(env, sheet(), { sleep: instant });

    expect(fake.get("npc")?.created).toEqual({ current: "1" });
    expect(fake.get("hp")?.created).toEqual({ current: "363", max: "363" });
    expect(fake.get("repeating_npcatk-melee_-id1_atkname")?.created).toEqual({ current: "slam" });
    expect(fake.attribs.every((a) => a.saves.length === 0)).toBe(true);
  });

  test("never sends a max that wasn't given", async () => {
    const { env, fake } = setup();

    await writeImport(env, sheet(), { sleep: instant });

    expect(fake.get("npc")?.created).not.toHaveProperty("max");
  });

  test("updates an attribute that already exists instead of creating a duplicate", async () => {
    const { env, fake } = setup({ npc: "0" });

    await writeImport(env, sheet(), { sleep: instant });

    expect(fake.attribs.filter((a) => a.name === "npc")).toHaveLength(1);
    expect(fake.get("npc")?.saves).toEqual([{ current: "1" }]);
    expect(fake.get("npc")?.created).toBeUndefined();
  });

  test("matches existing attribute names case-insensitively", async () => {
    const { env, fake } = setup({ NPC: "0" });

    await writeImport(env, sheet(), { sleep: instant });

    expect(fake.attribs.filter((a) => a.name.toLowerCase() === "npc")).toHaveLength(1);
  });

  test("falls back to searching when the collection doesn't expose its models", async () => {
    const { env, fake } = setup({ npc: "0" }, { exposeModels: false });

    await writeImport(env, sheet(), { sleep: instant });

    expect(fake.attribs.filter((a) => a.name === "npc")).toHaveLength(1);
    expect(fake.get("npc")?.saves).toEqual([{ current: "1" }]);
    expect(fake.get("hp")?.created).toEqual({ current: "363", max: "363" });
  });
});

describe("writeImport: repeating row order", () => {
  test("creates the row order for each section", async () => {
    const { env, fake } = setup();

    await writeImport(env, sheet(), { sleep: instant });

    expect(fake.get("_reporder_repeating_npcatk-melee")?.created).toEqual({ current: "-id1" });
  });

  test("appends to an existing row order instead of replacing it", async () => {
    const { env, fake } = setup({ "_reporder_repeating_npcatk-melee": "-old1,-old2" });

    await writeImport(env, sheet(), { sleep: instant });

    expect(fake.get("_reporder_repeating_npcatk-melee")?.saves).toEqual([
      { current: "-old1,-old2,-id1" },
    ]);
  });

  test("writes one row order per section", async () => {
    const { env, fake } = setup();

    await writeImport(env, sheet({ rowOrders: { feats: ["-a", "-b"], abilities: ["-c"] } }), {
      sleep: instant,
    });

    expect(fake.get("_reporder_repeating_feats")?.created).toEqual({ current: "-a,-b" });
    expect(fake.get("_reporder_repeating_abilities")?.created).toEqual({ current: "-c" });
  });
});

describe("writeImport: batching", () => {
  test("defaults to a few large batches rather than one write at a time", async () => {
    const { env } = setup();
    const sleep = vi.fn(async () => {});

    await writeImport(env, sheet({ attributes: many(250), rowOrders: {} }), { sleep });

    // 250 attributes -> batches of 100, 100, 50 -> two pauses
    expect(DEFAULT_BATCH_SIZE).toBe(100);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(DEFAULT_BATCH_DELAY_MS);
  });

  test("a batch is sent together, with no pause inside it", async () => {
    const { env, fake } = setup();
    const sleep = vi.fn(async () => {
      // by the time we pause, the whole first batch has been created
      expect(fake.log.filter((l) => l.startsWith("create:"))).toHaveLength(3);
    });

    await writeImport(env, sheet({ attributes: many(6), rowOrders: {} }), { batchSize: 3, sleep });

    expect(sleep).toHaveBeenCalledTimes(1);
  });

  test("respects the batch size and delay it's given", async () => {
    const { env } = setup();
    const sleep = vi.fn(async () => {});

    await writeImport(env, sheet({ attributes: many(10), rowOrders: {} }), {
      batchSize: 4,
      batchDelayMs: 7,
      sleep,
    });

    // batches of 4, 4, 2 -> two pauses of 7ms
    expect(sleep.mock.calls).toEqual([[7], [7]]);
  });

  test("Infinity sends everything at once, with no pause", async () => {
    const { env, fake } = setup();
    const sleep = vi.fn(async () => {});

    await writeImport(env, sheet({ attributes: many(500), rowOrders: {} }), {
      batchSize: Infinity,
      sleep,
    });

    expect(sleep).toHaveBeenCalledTimes(0);
    expect(fake.attribs).toHaveLength(500);
  });

  test("a small import needs no pause at all", async () => {
    const { env } = setup();
    const sleep = vi.fn(async () => {});

    await writeImport(env, sheet(), { sleep });

    expect(sleep).toHaveBeenCalledTimes(0);
  });

  test("a batch size below 1 is treated as 1", async () => {
    const { env, fake } = setup();

    await writeImport(env, sheet({ attributes: many(3), rowOrders: {} }), {
      batchSize: 0,
      sleep: instant,
    });

    expect(fake.attribs).toHaveLength(3);
  });
});

describe("writeImport: notifying the sheet", () => {
  test("notifies the character's sheet workers once, after everything is written", async () => {
    const { env, journal, fake } = setup();
    journal.notifyWorkersOfAttrChanges.mockImplementation(() => {
      // everything has been written by the time we're told
      expect(fake.attribs).toHaveLength(4);
    });

    const result = await writeImport(env, sheet(), { sleep: instant });

    expect(result).toEqual({ characterId: "char-1", notified: true });
    expect(journal.notifyWorkersOfAttrChanges).toHaveBeenCalledTimes(1);
    expect(journal.notifyWorkersOfAttrChanges).toHaveBeenCalledWith(
      "char-1",
      ["npc", "hp", "repeating_npcatk-melee_-id1_atkname", "_reporder_repeating_npcatk-melee"],
      "player",
    );
  });

  test("reports that nobody was notified when the character has no journal", async () => {
    const fake = fakeCharacter();
    const env = { createCharacter: vi.fn(() => fake.character) };

    expect(await writeImport(env, sheet(), { sleep: instant })).toEqual({
      characterId: "char-1",
      notified: false,
    });
  });

  test("a journal without the notify method is treated as no journal", async () => {
    const fake = fakeCharacter({}, { journal: {} });
    const env = { createCharacter: vi.fn(() => fake.character) };

    expect((await writeImport(env, sheet(), { sleep: instant })).notified).toBe(false);
  });

  test("does not notify the workers if a write fails", async () => {
    const { env, fake, journal } = setup();
    fake.character.attribs.create = () => {
      throw new Error("firebase said no");
    };

    await expect(writeImport(env, sheet(), { sleep: instant })).rejects.toThrow(/firebase said no/);
    expect(journal.notifyWorkersOfAttrChanges).toHaveBeenCalledTimes(0);
  });
});

describe("writeImport: a failed write", () => {
  const failing = (destroy?: () => void) => {
    const { env, fake } = setup();
    fake.character.attribs.create = () => {
      throw new Error("firebase said no");
    };
    if (destroy) fake.character.destroy = destroy;
    return env;
  };

  test("removes the half-written character and says so", async () => {
    const destroy = vi.fn();

    await expect(writeImport(failing(destroy), sheet(), { sleep: instant })).rejects.toThrow(
      /firebase said no\. The partly written character was removed\./,
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test("tells the person to clean up when the character can't be removed", async () => {
    const env = failing(() => {
      throw new Error("nope");
    });

    await expect(writeImport(env, sheet(), { sleep: instant })).rejects.toThrow(
      /may remain in the journal/,
    );
  });

  test("a character with no destroy method gets the same advice", async () => {
    await expect(writeImport(failing(), sheet(), { sleep: instant })).rejects.toThrow(
      /may remain in the journal/,
    );
  });

  test("a successful import never destroys anything", async () => {
    const { env, fake } = setup();
    const destroy = vi.fn();
    fake.character.destroy = destroy;

    await writeImport(env, sheet(), { sleep: instant });

    expect(destroy).toHaveBeenCalledTimes(0);
  });
});
