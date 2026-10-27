import styles from "./importerToggle.css";

export class ImporterToggle extends HTMLElement {
  private button: HTMLButtonElement;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${styles}</style>
      <button
        class="toggle"
        type="button"
        title="Nethys NPC Importer"
        aria-label="Nethys NPC Importer"
        aria-expanded="false"
        aria-controls="panel"
      >N</button>
    `;

    this.button = shadow.querySelector("button")!;
    this.button.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("toggle-importer", {
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  setExpanded(expanded: boolean) {
    this.button.setAttribute("aria-expanded", String(expanded));
  }
}

customElements.define("nethys-importer-toggle", ImporterToggle);
