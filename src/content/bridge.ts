import {
  CHANNEL,
  isPageImportAck,
  isPageImportResult,
  type PageImportRequest,
  type PageImportResult,
} from "../shared/protocol";
import type { SheetImport } from "../sheet/types";

// Writing ~250 attributes is paced (Roll20 rate-limits), so give it plenty of room: 2 minutes.
export const TIMEOUT_MS = 120_000;

// The page script acknowledges a request immediately. If it hasn't within this long it isn't
// running (Roll20 not fully loaded, or the extension was reloaded), so fail fast, not after minutes.
export const ACK_TIMEOUT_MS = 5_000;

/** Sends a sheet to the page-world script and waits for its reply. */
export function sendToPage(
  payload: SheetImport,
  win: Window = window,
  timeoutMs = TIMEOUT_MS,
  ackTimeoutMs = Math.min(ACK_TIMEOUT_MS, timeoutMs),
): Promise<PageImportResult> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    const finish = (result: PageImportResult | { ok: false; error: string }) => {
      win.removeEventListener("message", onMessage);
      clearTimeout(timer);
      clearTimeout(ackTimer);
      resolve(result as PageImportResult);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== win) return;

      if (isPageImportAck(event.data)) {
        if (event.data.requestId === requestId) clearTimeout(ackTimer);
      } else if (isPageImportResult(event.data) && event.data.requestId === requestId) {
        finish(event.data); // a result also proves the page script is alive
      }
    };

    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          error: "Timed out waiting for Roll20. Is the game fully loaded?",
        }),
      timeoutMs,
    );

    const ackTimer = setTimeout(
      () =>
        finish({
          ok: false,
          error:
            "Timed out waiting for the importer's Roll20 script. Reload the Roll20 page and try again.",
        }),
      ackTimeoutMs,
    );

    win.addEventListener("message", onMessage);

    const request: PageImportRequest = {
      channel: CHANNEL,
      direction: "to-page",
      kind: "import-npc",
      requestId,
      payload,
    };
    win.postMessage(request, win.location.origin);
  });
}
