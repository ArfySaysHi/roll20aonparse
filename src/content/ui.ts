import "./components/importerToggle";
import "./components/importerPanel";

import type { ImporterPanel } from "./components/importerPanel";
import type { ImporterToggle } from "./components/importerToggle";
import type { ImportOptions, ImportOutcome } from "./importer";

export const HOST_ID = "nethys-importer-ui";

const LEAKY_EVENTS = ["keydown", "keyup", "keypress", "paste", "copy", "cut"] as const;

function setupUiResizing(host: HTMLDivElement, doc: Document) {
  const sidebar = doc.getElementById("rightsidebar");

  if (sidebar) {
    const updatePosition = () => {
      const width = sidebar.getBoundingClientRect().width;

      host.style.right = `${width + 13}px`;
    };

    const observer = new ResizeObserver(updatePosition);
    observer.observe(sidebar);

    updatePosition();
  }
}

function setupLeakyEventStopper(host: HTMLDivElement) {
  for (const type of LEAKY_EVENTS) {
    host.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  }
}

export function mountUi(
  onImport: (url: string, options: ImportOptions) => Promise<ImportOutcome>,
  doc: Document = document,
  onClearCache?: () => Promise<string>,
) {
  doc.getElementById(HOST_ID)?.remove();

  const host = doc.createElement("div");
  host.id = HOST_ID;

  Object.assign(host.style, {
    position: "fixed",
    right: "373px",
    bottom: "13px",
    zIndex: "2147483647",
    isolation: "isolate",
  });

  doc.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const toggle = doc.createElement("nethys-importer-toggle") as ImporterToggle;
  const panel = doc.createElement("nethys-importer-panel") as ImporterPanel;

  panel.onImport = onImport;
  panel.onClearCache = onClearCache;

  shadow.append(toggle, panel);

  let open = false;

  const setOpen = (next: boolean) => {
    open = next;
    panel.toggleAttribute("open", open);
  };

  shadow.addEventListener("toggle-importer", () => {
    setOpen(!open);
  });

  shadow.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;

    if (event.key === "Escape" && open) {
      setOpen(false);
      toggle.shadowRoot?.querySelector("button")?.focus();
    }
  });

  setupLeakyEventStopper(host);
  setupUiResizing(host, doc);

  return { host, shadow };
}
