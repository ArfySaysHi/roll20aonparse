import { extensionApi } from "../shared/browser";
import type { ClearCacheResponse, FetchPageResponse } from "../shared/protocol";
import { sendToPage } from "./bridge";
import { importFromUrl, type ImportOptions } from "./importer";
import { mountUi } from "./ui";

const api = extensionApi();

// After the extension is updated or reloaded, tabs that were already open keep a content script
// whose connection to the extension is dead. Say what to do instead of showing the raw error.
const STALE_MESSAGE =
  "The extension was updated or reloaded. Reload this Roll20 tab to keep using it.";

const describeSendError = (error: unknown) =>
  /context invalidated/i.test((error as Error)?.message ?? "")
    ? STALE_MESSAGE
    : `Could not reach the extension: ${(error as Error)?.message ?? error}`;

async function ask<T>(message: unknown, fail: (error: string) => T): Promise<T> {
  try {
    return (await api.runtime.sendMessage(message)) as T;
  } catch (error) {
    return fail(describeSendError(error));
  }
}

async function onImport(url: string, options: ImportOptions) {
  const outcome = await importFromUrl(
    url,
    {
      fetchPage: (u) =>
        ask<FetchPageResponse>({ type: "nethys-importer:fetch-page", url: u }, (error) => ({
          ok: false,
          error,
        })),
      sendToPage,
      parseHtml: (html) => new DOMParser().parseFromString(html, "text/html"),
    },
    options,
  );

  if (outcome.ok)
    for (const warning of outcome.warnings) console.warn("[nethys-importer]", warning);
  else console.error("[nethys-importer]", outcome.error);

  return outcome;
}

async function onClearCache() {
  const response = await ask<ClearCacheResponse>(
    { type: "nethys-importer:clear-cache" },
    (error) => ({
      ok: false,
      error,
    }),
  );

  if (!response.ok) throw new Error(response.error);
  return response.removed === 1
    ? "Cleared 1 cached page."
    : `Cleared ${response.removed} cached pages.`;
}

mountUi(onImport, document, onClearCache);
