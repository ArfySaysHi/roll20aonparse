// Firefox exposes the promise-based `browser` namespace; Chrome exposes `chrome`
// (promise-based as well under Manifest V3). Use whichever exists.
export interface ExtensionApi {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string[]): Promise<void>;
    };
  };
  runtime: {
    id?: string;
    sendMessage(message: unknown): Promise<unknown>;
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: { id?: string },
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ): void;
    };
  };
}

export function extensionApi(): ExtensionApi {
  const g = globalThis as unknown as { browser?: ExtensionApi; chrome?: ExtensionApi };
  const api = g.browser ?? g.chrome;

  if (!api?.runtime) throw new Error("No extension API available in this context");
  return api;
}
