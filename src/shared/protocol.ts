import type { SheetImport } from "../sheet/types";

// --- content script -> background (extension messaging) --------------------------------------

export interface FetchPageRequest {
  type: "nethys-importer:fetch-page";
  url: string;
}

export type FetchPageResponse = { ok: true; html: string; fromCache?: boolean } | { ok: false; error: string };

export interface ClearCacheRequest {
  type: "nethys-importer:clear-cache";
}

export type ClearCacheResponse = { ok: true; removed: number } | { ok: false; error: string };

export function isClearCacheRequest(message: unknown): message is ClearCacheRequest {
  return (message as Partial<ClearCacheRequest> | null)?.type === "nethys-importer:clear-cache";
}

/**
 * True for the errors that mean "couldn't get an answer from Nethys at all" (offline, blocked, the
 * extension unreachable), as opposed to Nethys answering with an HTTP error such as a 404. All of
 * these messages are produced by this extension (fetchPage, the background handler, the content
 * script), so matching their wording is reliable.
 */
export const isUnreachableError = (error: string) =>
  /^(?:Could not reach|Fetch failed)|extension was updated/i.test(error);

export function isFetchPageRequest(message: unknown): message is FetchPageRequest {
  const m = message as Partial<FetchPageRequest> | null;
  return m?.type === "nethys-importer:fetch-page" && typeof m.url === "string";
}

// --- content script <-> Roll20 page (window.postMessage) -------------------------------------
// The content script lives in an isolated world and can't touch Roll20's `Campaign` / `d20`
// objects, so a second script runs in the page's own world. They talk over postMessage.

export const CHANNEL = "nethys-roll20-importer";

export interface PageImportRequest {
  channel: typeof CHANNEL;
  direction: "to-page";
  kind: "import-npc";
  requestId: string;
  payload: SheetImport;
}

/** Sent the moment the page script receives a request, long before the (slow) import finishes. */
export interface PageImportAck {
  channel: typeof CHANNEL;
  direction: "from-page";
  kind: "import-ack";
  requestId: string;
}

export interface PageImportResult {
  channel: typeof CHANNEL;
  direction: "from-page";
  kind: "import-result";
  requestId: string;
  ok: boolean;
  error?: string;
  /** False when the character's sheet workers couldn't be told to recalculate. */
  notified?: boolean;
}

export function isPageImportRequest(data: unknown): data is PageImportRequest {
  const d = data as Partial<PageImportRequest> | null;
  return (
    d?.channel === CHANNEL &&
    d.direction === "to-page" &&
    d.kind === "import-npc" &&
    typeof d.requestId === "string" &&
    typeof d.payload?.name === "string" &&
    Array.isArray(d.payload.attributes)
  );
}

export function isPageImportAck(data: unknown): data is PageImportAck {
  const d = data as Partial<PageImportAck> | null;
  return (
    d?.channel === CHANNEL &&
    d.direction === "from-page" &&
    d.kind === "import-ack" &&
    typeof d.requestId === "string"
  );
}

export function isPageImportResult(data: unknown): data is PageImportResult {
  const d = data as Partial<PageImportResult> | null;
  return (
    d?.channel === CHANNEL &&
    d.direction === "from-page" &&
    d.kind === "import-result" &&
    typeof d.requestId === "string" &&
    typeof d.ok === "boolean"
  );
}
