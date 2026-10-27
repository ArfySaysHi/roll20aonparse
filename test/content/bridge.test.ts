import { describe, test, expect } from "vitest";
import { ACK_TIMEOUT_MS, sendToPage, TIMEOUT_MS } from "../../src/content/bridge";
import { CHANNEL, type PageImportRequest } from "../../src/shared/protocol";
import type { SheetImport } from "../../src/sheet/types";

const payload: SheetImport = { name: "Solar", attributes: [], rowOrders: {}, warnings: [] };

/** A stand-in for `window`: an EventTarget whose postMessage hands the message to `onPost`. */
function fakeWindow(onPost: (data: unknown, win: FakeWindow) => void) {
  const target = new EventTarget() as FakeWindow;
  target.location = { origin: "https://app.roll20.net" };
  target.postMessage = (data: unknown, origin: string) => {
    target.lastOrigin = origin;
    onPost(data, target);
  };
  target.deliver = (data: unknown, source: unknown = target) => {
    const event = new Event("message") as Event & { data?: unknown; source?: unknown };
    event.data = data;
    event.source = source;
    target.dispatchEvent(event);
  };
  return target;
}

interface FakeWindow extends EventTarget {
  location: { origin: string };
  lastOrigin?: string;
  postMessage(data: unknown, origin: string): void;
  deliver(data: unknown, source?: unknown): void;
}

const reply = (request: PageImportRequest, extra: object = {}) => ({
  channel: CHANNEL,
  direction: "from-page",
  kind: "import-result",
  requestId: request.requestId,
  ok: true,
  ...extra,
});

const ack = (request: PageImportRequest) => ({
  channel: CHANNEL,
  direction: "from-page",
  kind: "import-ack",
  requestId: request.requestId,
});

describe("sendToPage: timeouts", () => {
  test("the overall timeout is two minutes, not twenty", () => {
    expect(TIMEOUT_MS).toBe(120_000);
    expect(ACK_TIMEOUT_MS).toBeLessThan(TIMEOUT_MS);
  });

  test("fails fast, with a reload hint, when the page script never acknowledges", async () => {
    const win = fakeWindow(() => {});

    const result = await sendToPage(payload, win as unknown as Window, 1000, 20);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Reload the Roll20 page/);
  });

  test("an acknowledged request waits for the result instead of giving up early", async () => {
    const win = fakeWindow((data, w) => {
      const request = data as PageImportRequest;
      queueMicrotask(() => w.deliver(ack(request)));
      setTimeout(() => w.deliver(reply(request)), 60); // slower than the ack timeout
    });

    const result = await sendToPage(payload, win as unknown as Window, 1000, 20);

    expect(result.ok).toBe(true);
  });

  test("an acknowledged request that never finishes still times out", async () => {
    const win = fakeWindow((data, w) => queueMicrotask(() => w.deliver(ack(data as PageImportRequest))));

    const result = await sendToPage(payload, win as unknown as Window, 60, 20);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Timed out waiting for Roll20/);
  });

  test("an ack for another request doesn't count", async () => {
    const win = fakeWindow((data, w) =>
      queueMicrotask(() => w.deliver(ack({ ...(data as PageImportRequest), requestId: "other" }))),
    );

    const result = await sendToPage(payload, win as unknown as Window, 1000, 20);

    expect(result.error).toMatch(/Reload the Roll20 page/);
  });
});

describe("sendToPage", () => {
  test("posts the payload to our own origin and resolves with the page's reply", async () => {
    const win = fakeWindow((data, w) => {
      const request = data as PageImportRequest;
      expect(request).toMatchObject({ channel: CHANNEL, direction: "to-page", payload });
      queueMicrotask(() => w.deliver(reply(request)));
    });

    const result = await sendToPage(payload, win as unknown as Window, 1000);

    expect(result.ok).toBe(true);
    expect(win.lastOrigin).toBe("https://app.roll20.net");
  });

  test("passes an error reply through", async () => {
    const win = fakeWindow((data, w) =>
      queueMicrotask(() => w.deliver(reply(data as PageImportRequest, { ok: false, error: "boom" }))),
    );

    expect(await sendToPage(payload, win as unknown as Window, 1000)).toMatchObject({
      ok: false,
      error: "boom",
    });
  });

  test("ignores replies for other requests and messages from other windows", async () => {
    const win = fakeWindow((data, w) => {
      const request = data as PageImportRequest;
      queueMicrotask(() => {
        w.deliver(reply({ ...request, requestId: "someone-else" }, { error: "wrong" }));
        w.deliver(reply(request, { error: "spoofed" }), { not: "our window" });
        w.deliver("noise");
        w.deliver(reply(request));
      });
    });

    const result = await sendToPage(payload, win as unknown as Window, 1000);

    expect(result).toMatchObject({ ok: true });
    expect((result as { error?: string }).error).toBeUndefined();
  });

  test("gives up with a helpful error when nobody answers", async () => {
    const win = fakeWindow(() => {});

    const result = await sendToPage(payload, win as unknown as Window, 20);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Timed out/);
  });
});
