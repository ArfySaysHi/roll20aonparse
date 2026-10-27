import { describe, test, expect } from "vitest";
import {
  CHANNEL,
  isClearCacheRequest,
  isFetchPageRequest,
  isPageImportAck,
  isUnreachableError,
  isPageImportRequest,
  isPageImportResult,
} from "../../src/shared/protocol";

const request = {
  channel: CHANNEL,
  direction: "to-page",
  kind: "import-npc",
  requestId: "abc",
  payload: { name: "Solar", attributes: [], rowOrders: {}, warnings: [] },
};

const result = {
  channel: CHANNEL,
  direction: "from-page",
  kind: "import-result",
  requestId: "abc",
  ok: true,
};

describe("isFetchPageRequest", () => {
  test("accepts a well-formed request", () => {
    expect(isFetchPageRequest({ type: "nethys-importer:fetch-page", url: "https://x" })).toBe(true);
  });

  test.each([[null], [undefined], ["x"], [{}], [{ type: "other", url: "x" }], [{ type: "nethys-importer:fetch-page" }]])(
    "rejects %j",
    (value) => {
      expect(isFetchPageRequest(value)).toBe(false);
    },
  );
});

describe("isPageImportRequest", () => {
  test("accepts a well-formed request", () => {
    expect(isPageImportRequest(request)).toBe(true);
  });

  test.each([
    ["null", null],
    ["a string", "hello"],
    ["another page's message", { type: "something-else" }],
    ["a wrong channel", { ...request, channel: "other" }],
    ["a result, not a request", result],
    ["no request id", { ...request, requestId: undefined }],
    ["no payload", { ...request, payload: undefined }],
    ["attributes that aren't a list", { ...request, payload: { name: "x", attributes: {} } }],
  ])("rejects %s", (_label, value) => {
    expect(isPageImportRequest(value)).toBe(false);
  });
});

describe("isPageImportResult", () => {
  test("accepts success and failure results", () => {
    expect(isPageImportResult(result)).toBe(true);
    expect(isPageImportResult({ ...result, ok: false, error: "nope" })).toBe(true);
  });

  test.each([
    ["null", null],
    ["a request, not a result", request],
    ["a wrong channel", { ...result, channel: "other" }],
    ["a non-boolean ok", { ...result, ok: "yes" }],
    ["no request id", { ...result, requestId: 5 }],
  ])("rejects %s", (_label, value) => {
    expect(isPageImportResult(value)).toBe(false);
  });
});

describe("isPageImportAck", () => {
  const ack = { channel: CHANNEL, direction: "from-page", kind: "import-ack", requestId: "abc" };

  test("accepts a well-formed ack", () => {
    expect(isPageImportAck(ack)).toBe(true);
  });

  test.each([
    ["null", null],
    ["a result, not an ack", result],
    ["a request", request],
    ["a wrong channel", { ...ack, channel: "other" }],
    ["no request id", { ...ack, requestId: undefined }],
  ])("rejects %s", (_label, value) => {
    expect(isPageImportAck(value)).toBe(false);
  });

  test("an ack is not mistaken for a result", () => {
    expect(isPageImportResult(ack)).toBe(false);
  });
});

describe("isClearCacheRequest", () => {
  test("accepts the request and nothing else", () => {
    expect(isClearCacheRequest({ type: "nethys-importer:clear-cache" })).toBe(true);
    expect(isClearCacheRequest({ type: "nethys-importer:fetch-page", url: "x" })).toBe(false);
    expect(isClearCacheRequest(null)).toBe(false);
    expect(isClearCacheRequest("clear")).toBe(false);
  });
});

describe("isUnreachableError", () => {
  test.each([
    ["Could not reach Nethys: NetworkError"],
    ["Fetch failed: boom"],
    ["Could not reach the extension: nope"],
    ["The extension was updated or reloaded. Reload this Roll20 tab to keep using it."],
  ])("%s is unreachable", (error) => {
    expect(isUnreachableError(error)).toBe(true);
  });

  test.each([["Nethys returned HTTP 404."], ["Nethys returned HTTP 500."], ["That doesn't look like an aonprd.com link."]])(
    "%s is an answer from Nethys, not a failure to reach it",
    (error) => {
      expect(isUnreachableError(error)).toBe(false);
    },
  );
});
