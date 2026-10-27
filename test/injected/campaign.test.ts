import { describe, test, expect, vi } from "vitest";
import { retryingWait, waitForCampaign, type Roll20Globals } from "../../src/injected/campaign";

describe("waitForCampaign", () => {
  test("resolves immediately when Campaign is ready", async () => {
    const campaign = { characters: { create: () => ({}) as never } };

    expect(await waitForCampaign({ Campaign: campaign }, 1000, 5)).toBe(campaign);
  });

  test("keeps polling until Campaign appears", async () => {
    const win: Roll20Globals = {};
    const campaign = { characters: { create: () => ({}) as never } };
    setTimeout(() => (win.Campaign = campaign), 30);

    expect(await waitForCampaign(win, 1000, 5)).toBe(campaign);
  });

  test("ignores a Campaign that has no characters yet", async () => {
    const win: Roll20Globals = { Campaign: {} };
    const campaign = { characters: { create: () => ({}) as never } };
    setTimeout(() => (win.Campaign = campaign), 30);

    expect(await waitForCampaign(win, 1000, 5)).toBe(campaign);
  });

  test("rejects after the timeout", async () => {
    await expect(waitForCampaign({}, 30, 5)).rejects.toThrow(/Timed out/);
  });
});

describe("retryingWait", () => {
  test("runs the wait once and shares its result", async () => {
    const wait = vi.fn(async () => "ready");
    const get = retryingWait(wait);

    expect(await get()).toBe("ready");
    expect(await get()).toBe("ready");
    expect(wait).toHaveBeenCalledTimes(1);
  });

  test("shares one wait between callers that arrive while it is pending", async () => {
    const wait = vi.fn(() => new Promise<string>((resolve) => setTimeout(() => resolve("ready"), 10)));
    const get = retryingWait(wait);

    expect(await Promise.all([get(), get()])).toEqual(["ready", "ready"]);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  test("a failed wait is not remembered: the next call waits again", async () => {
    const wait = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Timed out waiting for Roll20"))
      .mockResolvedValueOnce("ready");
    const get = retryingWait(wait);

    await expect(get()).rejects.toThrow(/Timed out/);
    expect(await get()).toBe("ready");
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
