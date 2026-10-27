import type { FetchPageResponse } from "../shared/protocol";
import { parseNethysUrl } from "../shared/urls";

const TIMEOUT_MS = 15_000;

/**
 * Fetches a Nethys page. This runs in the background script because the content script
 * lives on roll20.net and would be blocked by CORS.
 */
export async function fetchPage(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchPageResponse> {
  const url = parseNethysUrl(rawUrl);

  if (!url) return { ok: false, error: "That doesn't look like an aonprd.com link." };

  try {
    const response = await fetchImpl(url.href, { signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (!response.ok) return { ok: false, error: `Nethys returned HTTP ${response.status}.` };

    return { ok: true, html: await response.text() };
  } catch (error) {
    return { ok: false, error: `Could not reach Nethys: ${(error as Error).message}` };
  }
}
