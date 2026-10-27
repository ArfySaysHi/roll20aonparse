import { describe, test, expect, vi } from "vitest";
import { createMessageHandler, type BackgroundDeps } from "../../src/background/handler";
import type { FetchPageResponse } from "../../src/shared/protocol";

const ME = "my-extension-id";

function setup(overrides: Partial<BackgroundDeps> = {}) {
  const deps: BackgroundDeps = {
    extensionId: ME,
    fetchPage: vi.fn(async (): Promise<FetchPageResponse> => ({ ok: true, html: "<html/>" })),
    clearCache: vi.fn(async () => 3),
    ...overrides,
  };
  const handle = createMessageHandler(deps);

  /** Runs the handler and resolves with whatever it passed to sendResponse. */
  const send = (message: unknown, sender: { id?: string } = { id: ME }) =>
    new Promise<{ keptOpen: boolean; response?: unknown }>((resolve) => {
      const keptOpen = handle(message, sender, (response) => resolve({ keptOpen, response }));
      if (!keptOpen) resolve({ keptOpen });
    });

  return { deps, send };
}

const fetchRequest = { type: "nethys-importer:fetch-page", url: "https://aonprd.com/x" };

describe("background message handler", () => {
  test("answers a fetch request and keeps the channel open for the reply", async () => {
    const { deps, send } = setup();

    expect(await send(fetchRequest)).toEqual({ keptOpen: true, response: { ok: true, html: "<html/>" } });
    expect(deps.fetchPage).toHaveBeenCalledWith("https://aonprd.com/x");
  });

  test("ignores messages from any other extension or page", async () => {
    const { deps, send } = setup();

    expect(await send(fetchRequest, { id: "someone-else" })).toEqual({ keptOpen: false });
    expect(await send(fetchRequest, {})).toEqual({ keptOpen: false });
    expect(deps.fetchPage).toHaveBeenCalledTimes(0);
  });

  test("ignores messages it doesn't understand", async () => {
    const { send } = setup();

    expect(await send({ type: "something-else" })).toEqual({ keptOpen: false });
    expect(await send(null)).toEqual({ keptOpen: false });
  });

  test("a fetch that throws becomes an error reply instead of a hung channel", async () => {
    const { send } = setup({
      fetchPage: async () => {
        throw new Error("boom");
      },
    });

    expect(await send(fetchRequest)).toEqual({
      keptOpen: true,
      response: { ok: false, error: "Fetch failed: boom" },
    });
  });

  test("clears the cache and reports how many pages went", async () => {
    const { send } = setup();

    expect(await send({ type: "nethys-importer:clear-cache" })).toEqual({
      keptOpen: true,
      response: { ok: true, removed: 3 },
    });
  });

  test("a failing clear is reported", async () => {
    const { send } = setup({
      clearCache: async () => {
        throw new Error("no remove");
      },
    });

    expect(await send({ type: "nethys-importer:clear-cache" })).toEqual({
      keptOpen: true,
      response: { ok: false, error: "no remove" },
    });
  });
});
