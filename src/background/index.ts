import { extensionApi } from "../shared/browser";
import { clearCache, looksLikeNethysPage, withCache } from "./cache";
import { fetchPage } from "./fetchPage";
import { createMessageHandler } from "./handler";

const api = extensionApi();
const cachedFetchPage = withCache((url) => fetchPage(url), api.storage.local, {
  isCacheable: looksLikeNethysPage,
});

// Registered synchronously at the top level, as service workers and event pages require.
api.runtime.onMessage.addListener(
  createMessageHandler({
    extensionId: api.runtime.id,
    fetchPage: cachedFetchPage,
    clearCache: () => clearCache(api.storage.local),
  }),
);
