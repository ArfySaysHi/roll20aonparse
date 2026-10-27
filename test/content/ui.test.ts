import { beforeEach, describe, test, expect, vi } from "vitest";
import type { ImportOptions, ImportOutcome } from "../../src/content/importer";
import { HOST_ID, mountUi } from "../../src/content/ui";

const ok = (warnings: string[] = []): ImportOutcome => ({ ok: true, name: "Solar", warnings });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  document.body.innerHTML = "";
});

type OnImport = (url: string, options: ImportOptions) => Promise<ImportOutcome>;

function mount(onImport: OnImport = async () => ok(), onClearCache?: () => Promise<string>) {
  const { host, shadow } = mountUi(onImport, document, onClearCache);
  const $ = <T extends Element>(selector: string) => shadow.querySelector(selector) as T;

  return {
    host,
    shadow,
    $,
    panel: $<HTMLElement>("#panel"),
    toggle: $<HTMLButtonElement>("#toggle"),
    input: $<HTMLInputElement>("#url"),
    importButton: $<HTMLButtonElement>("#import"),
    status: $<HTMLElement>("#status"),
    warnings: () => Array.from(shadow.querySelectorAll("#warnings li")).map((li) => li.textContent),
  };
}

const key = (name: string) => new KeyboardEvent("keydown", { key: name, bubbles: true, composed: true });

describe("mountUi", () => {
  test("mounting again replaces the old panel instead of stacking a second", () => {
    mount();
    mount();

    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
  });

  test("keyboard and clipboard events stop at the panel, so Roll20's hotkeys never see them", () => {
    const { input } = mount();
    const reachedPage = vi.fn();

    for (const type of ["keydown", "keyup", "keypress", "paste", "copy", "cut"]) {
      document.body.addEventListener(type, reachedPage);
      input.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    }

    expect(reachedPage).toHaveBeenCalledTimes(0);
  });

  test("Enter in the link box starts the import with what was typed", async () => {
    const onImport = vi.fn(async (_url: string, _options: ImportOptions) => ok());
    const { input } = mount(onImport);
    input.value = "https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar";

    input.dispatchEvent(key("Enter"));
    await flush();

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0]![0]).toBe("https://aonprd.com/MonsterDisplay.aspx?ItemName=Solar");
  });

  test("passes the chosen casting stat to the import, defaulting to auto", async () => {
    const onImport = vi.fn(async (_url: string, _options: ImportOptions) => ok());
    const { shadow, importButton } = mount(onImport);

    importButton.click();
    await flush();
    shadow.querySelector<HTMLSelectElement>("#castingStat")!.value = "Cha";
    importButton.click();
    await flush();

    expect(onImport.mock.calls[0]![1].castingStat).toBe("auto");
    expect(onImport.mock.calls[1]![1].castingStat).toBe("Cha");
  });

  test("the toggle opens the panel and reports it to assistive technology", () => {
    const { toggle, panel } = mount();

    expect(toggle.getAttribute("aria-label")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    toggle.click();

    expect(panel.classList.contains("open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  test("Escape closes the panel", () => {
    const { toggle, panel, input } = mount();
    toggle.click();

    input.dispatchEvent(key("Escape"));

    expect(panel.classList.contains("open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("warnings are listed in the panel, and the status counts them", async () => {
    const { importButton, status, warnings } = mount(vi.fn(async () => ok(["first", "second"])));

    importButton.click();
    await flush();

    expect(warnings()).toEqual(["first", "second"]);
    expect(status.textContent).toBe("Imported Solar, with 2 notes to check (listed below).");
  });

  test("a long list of warnings is cut off with a count of the rest", async () => {
    const many = Array.from({ length: 11 }, (_, i) => `warning ${i}`);
    const { importButton, warnings } = mount(vi.fn(async () => ok(many)));

    importButton.click();
    await flush();

    expect(warnings()).toHaveLength(9);
    expect(warnings().at(-1)).toMatch(/and 3 more/);
  });

  test("a failed import shows the error and no warnings", async () => {
    const { importButton, status, warnings } = mount(
      vi.fn(async (): Promise<ImportOutcome> => ({ ok: false, error: "nope" })),
    );

    importButton.click();
    await flush();

    expect(status.textContent).toBe("Failed: nope");
    expect(status.classList.contains("error")).toBe(true);
    expect(warnings()).toEqual([]);
  });

  test("the import button is disabled while an import runs and re-enabled after", async () => {
    let finish: (o: ImportOutcome) => void = () => {};
    const { importButton } = mount(vi.fn(() => new Promise<ImportOutcome>((resolve) => (finish = resolve))));

    importButton.click();
    expect(importButton.disabled).toBe(true);

    finish(ok());
    await flush();

    expect(importButton.disabled).toBe(false);
  });

  test("there is no clear-cache control unless a handler is given", () => {
    expect(mount().shadow.querySelector("#clear")).toBeNull();
  });

  test("the clear-cache control reports what it did", async () => {
    const { shadow, status } = mount(undefined, async () => "Cleared 2 cached pages.");

    shadow.querySelector<HTMLButtonElement>("#clear")!.click();
    await flush();

    expect(status.textContent).toBe("Cleared 2 cached pages.");
  });
});
