import styles from "./importerPanel.css";
import type { CastingStatChoice } from "../../sheet/castingStat";
import { describeOutcome, type ImportOptions, type ImportOutcome } from "../importer";

type ImportHandler = (url: string, options: ImportOptions) => Promise<ImportOutcome>;

type ClearCacheHandler = () => Promise<string>;

export class ImporterPanel extends HTMLElement {
  onImport?: ImportHandler;
  onClearCache?: ClearCacheHandler;

  private shadow: ShadowRoot;
  private busy = false;

  constructor() {
    super();

    this.shadow = this.attachShadow({ mode: "open" });

    this.shadow.innerHTML = `
      <style>${styles}</style>
      <section class="panel" id="panel"
        role="dialog" aria-label="Nethys NPC Importer">
        <h2>Nethys NPC Importer</h2>

        <label>
          Monster link
          <input type="text" id="url" autocomplete="off"
            spellcheck="false"
            placeholder="https://aonprd.com/MonsterDisplay.aspx?ItemName=..." />
        </label>

        <label class="check">
          <input type="checkbox" id="spells" />
          Look up spell details (extra requests to Nethys)
        </label>

        <label>
          Casting stat (for spell DCs the stat block doesn't give)
          <select id="castingStat">
            <option value="auto">Auto: from the stat block and class</option>
            <option value="Int">Intelligence</option>
            <option value="Wis">Wisdom</option>
            <option value="Cha">Charisma</option>
          </select>
        </label>

        <button class="import" id="import">Import</button>
        <button class="link" id="clear" type="button" hidden>
          Clear cached pages
        </button>

        <p class="status" id="status" role="status"
          aria-live="polite"></p>
        <ul class="warnings" id="warnings"></ul>
      </section>
    `;
  }

  connectedCallback() {
    const $ = <T extends HTMLElement>(id: string) => this.shadow.querySelector<T>(`#${id}`)!;

    const input = $<HTMLInputElement>("url");
    const spells = $<HTMLInputElement>("spells");
    const castingStat = $<HTMLSelectElement>("castingStat");
    const button = $<HTMLButtonElement>("import");
    const clearButton = $<HTMLButtonElement>("clear");
    const status = $<HTMLParagraphElement>("status");
    const warningList = $<HTMLUListElement>("warnings");

    clearButton.hidden = !this.onClearCache;

    const setStatus = (message: string, error = false) => {
      status.textContent = message;
      status.classList.toggle("error", error);
    };

    const setBusy = (busy: boolean) => {
      this.busy = busy;
      button.disabled = busy;
      clearButton.disabled = busy;
    };

    const run = async () => {
      if (this.busy || !this.onImport) return;

      setBusy(true);
      warningList.replaceChildren();
      setStatus("Importing…");

      try {
        const outcome = await this.onImport(input.value, {
          includeSpells: spells.checked,
          castingStat: castingStat.value as CastingStatChoice,
          onProgress: (done, total) => setStatus(`Fetching spells ${done}/${total}…`),
        });

        setStatus(describeOutcome(outcome), !outcome.ok);

        if (outcome.ok) {
          warningList.replaceChildren(
            ...outcome.warnings.slice(0, 8).map((warning) => {
              const li = document.createElement("li");
              li.textContent = warning;
              return li;
            }),
          );

          if (outcome.warnings.length > 8) {
            const li = document.createElement("li");
            li.textContent = `…and ${outcome.warnings.length - 8} more (see the console)`;
            warningList.append(li);
            console.warn("Additional import warnings:", outcome.warnings);
          }
        }
      } catch (error) {
        setStatus(`Failed: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        setBusy(false);
      }
    };

    const clear = async () => {
      if (this.busy || !this.onClearCache) return;

      setBusy(true);
      try {
        setStatus(await this.onClearCache());
      } catch (error) {
        setStatus(`Failed: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        setBusy(false);
      }
    };

    button.addEventListener("click", () => void run());
    clearButton.addEventListener("click", () => void clear());

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") void run();
    });
  }
}

customElements.define("nethys-importer-panel", ImporterPanel);
