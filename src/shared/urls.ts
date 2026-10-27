const ALLOWED_HOSTS = new Set(["aonprd.com", "www.aonprd.com"]);

/**
 * Accepts only Archives of Nethys (PF1) pages. Returns a normalised https URL, or null.
 * Used by the UI for early feedback *and* by the background script, which must not trust
 * whatever a content script asks it to fetch.
 */
export function parseNethysUrl(input: string): URL | null {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // The site serves https; upgrade a pasted http link rather than reject it.
  url.protocol = "https:";
  return url;
}
