import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";

const load = (target: "chrome" | "firefox") =>
  JSON.parse(readFileSync(`./manifest/${target}.json`, "utf8"));

// Bundles scripts/build.mjs produces for each target.
const BUNDLES = ["background.js", "content.js", "injected.js"];

describe.each(["chrome", "firefox"] as const)("%s manifest", (target) => {
  const manifest = load(target);

  test("is Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test("can only fetch from Nethys, and only asks to store the page cache", () => {
    expect(manifest.host_permissions).toEqual(["https://aonprd.com/*", "https://www.aonprd.com/*"]);
    // The cache is capped (see background/cache.ts), so it needs no `unlimitedStorage`.
    expect(manifest.permissions).toEqual(["storage"]);
  });

  test("injects only into the Roll20 editor", () => {
    for (const script of manifest.content_scripts) {
      expect(script.matches).toEqual(["https://app.roll20.net/editor/*"]);
    }
  });

  test("runs the content script isolated and the injected script in the page's world", () => {
    const [isolated, page] = manifest.content_scripts;

    expect(isolated.js).toEqual(["content.js"]);
    expect(isolated.world).toBeUndefined();
    expect(page.js).toEqual(["injected.js"]);
    expect(page.world).toBe("MAIN");
  });

  test("references only bundles the build produces", () => {
    const referenced = [
      ...manifest.content_scripts.flatMap((s: { js: string[] }) => s.js),
      ...(manifest.background.scripts ?? [manifest.background.service_worker]),
    ];

    for (const file of referenced) expect(BUNDLES).toContain(file);
  });
});

describe("browser differences", () => {
  test("chrome uses a service worker", () => {
    expect(load("chrome").background).toEqual({ service_worker: "background.js" });
  });

  test("firefox uses background scripts and has an add-on id", () => {
    const manifest = load("firefox");

    expect(manifest.background).toEqual({ scripts: ["background.js"] });
    expect(manifest.browser_specific_settings.gecko.id).toMatch(/@/);
  });

  test("firefox declares that it collects no data", () => {
    expect(load("firefox").browser_specific_settings.gecko.data_collection_permissions).toEqual({
      required: ["none"],
    });
  });

  test("both ship the same name and version", () => {
    const { name, version } = load("chrome");

    expect(load("firefox")).toMatchObject({ name, version });
  });
});
