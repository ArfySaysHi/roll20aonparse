import type { CharacterModel } from "./writer";

export interface Roll20Globals {
  Campaign?: { characters?: { create(props: { name: string }): CharacterModel } };
}

/** Resolves once Roll20 has built `window.Campaign.characters` (it loads after the page does). */
export function waitForCampaign(
  win: Roll20Globals = window as unknown as Roll20Globals,
  timeoutMs = 30_000,
  intervalMs = 100,
): Promise<NonNullable<Roll20Globals["Campaign"]>> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (win.Campaign?.characters) return resolve(win.Campaign);
      if (Date.now() - start > timeoutMs) return reject(new Error("Timed out waiting for Roll20"));
      setTimeout(check, intervalMs);
    };
    check();
  });
}

/**
 * Wraps a wait so that a *failed* wait isn't remembered. Without this, one slow Roll20 load would
 * leave a rejected promise behind and every later import would fail until the page was reloaded.
 * A successful wait is cached; a failure clears the cache so the next call starts a fresh wait.
 */
export function retryingWait<T>(wait: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;

  return () => {
    if (!pending) {
      pending = wait().catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}
