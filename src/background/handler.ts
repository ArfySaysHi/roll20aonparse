import type { ClearCacheResponse, FetchPageResponse } from "../shared/protocol";
import { isClearCacheRequest, isFetchPageRequest } from "../shared/protocol";

export interface BackgroundDeps {
  /** This extension's id; messages from any other sender are ignored. */
  extensionId: string | undefined;
  fetchPage(url: string): Promise<FetchPageResponse>;
  clearCache(): Promise<number>;
}

/**
 * The `runtime.onMessage` listener, separated from the browser wiring so it can be tested.
 * Returns true when it will answer asynchronously (which keeps the channel open in Chrome and
 * Firefox alike).
 */
export function createMessageHandler(deps: BackgroundDeps) {
  return (
    message: unknown,
    sender: { id?: string },
    sendResponse: (response: unknown) => void,
  ): boolean => {
    if (sender.id !== deps.extensionId) return false; // only our own scripts

    if (isFetchPageRequest(message)) {
      deps
        .fetchPage(message.url)
        .then(sendResponse, (error: Error) =>
          sendResponse({ ok: false, error: `Fetch failed: ${error.message}` } satisfies FetchPageResponse),
        );
      return true;
    }

    if (isClearCacheRequest(message)) {
      deps.clearCache().then(
        (removed) => sendResponse({ ok: true, removed } satisfies ClearCacheResponse),
        (error: Error) => sendResponse({ ok: false, error: error.message } satisfies ClearCacheResponse),
      );
      return true;
    }

    return false;
  };
}
