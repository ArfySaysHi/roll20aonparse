import { describe, test, expect, vi } from "vitest";
import { fetchPage } from "../../src/background/fetchPage";

const okResponse = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response;

describe("fetchPage", () => {
  test("returns the page html", async () => {
    const fetchImpl = vi.fn(async () => okResponse("<html></html>"));

    const result = await fetchPage("https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar", fetchImpl);

    expect(result).toEqual({ ok: true, html: "<html></html>" });
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar");
  });

  test("upgrades http links before fetching", async () => {
    const fetchImpl = vi.fn(async () => okResponse(""));

    await fetchPage("http://aonprd.com/x", fetchImpl);

    expect(fetchImpl.mock.calls[0]![0]).toBe("https://aonprd.com/x");
  });

  test("refuses other hosts without making a request", async () => {
    const fetchImpl = vi.fn(async () => okResponse(""));

    const result = await fetchPage("https://example.com/", fetchImpl);

    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(0);
  });

  test("reports an HTTP error status", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }) as Response);

    expect(await fetchPage("https://aonprd.com/x", fetchImpl)).toEqual({
      ok: false,
      error: "Nethys returned HTTP 404.",
    });
  });

  test("reports a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    expect(await fetchPage("https://aonprd.com/x", fetchImpl)).toEqual({
      ok: false,
      error: "Could not reach Nethys: offline",
    });
  });
});
