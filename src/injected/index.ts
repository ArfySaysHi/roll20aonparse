import {
  CHANNEL,
  isPageImportRequest,
  type PageImportAck,
  type PageImportRequest,
  type PageImportResult,
} from "../shared/protocol";
import { retryingWait, waitForCampaign, type Roll20Globals } from "./campaign";
import { writeImport } from "./writer";

// Runs in the page's own world (manifest `world: "MAIN"`), so it can see Roll20's globals.
// The wait starts lazily on the first import and is retried after a timeout (see retryingWait),
// so it neither raises an unhandled rejection at load nor gets stuck on a failed wait.
const campaign = retryingWait(() => waitForCampaign(window as unknown as Roll20Globals));

function ack(requestId: string) {
  const message: PageImportAck = {
    channel: CHANNEL,
    direction: "from-page",
    kind: "import-ack",
    requestId,
  };
  window.postMessage(message, window.location.origin);
}

function reply(
  requestId: string,
  outcome: { ok: true; notified: boolean } | { ok: false; error: string },
) {
  const result: PageImportResult = {
    channel: CHANNEL,
    direction: "from-page",
    kind: "import-result",
    requestId,
    ...outcome,
  };
  window.postMessage(result, window.location.origin);
}

async function handle(request: PageImportRequest) {
  ack(request.requestId);

  try {
    const { characters } = await campaign();
    if (!characters) throw new Error("Roll20 isn't ready yet");

    const { notified } = await writeImport(
      { createCharacter: (props) => characters.create(props) },
      request.payload,
    );

    if (!notified) {
      console.warn(
        "[nethys-importer] the character has no d20.journal; its sheet workers weren't notified",
      );
    }

    reply(request.requestId, { ok: true, notified });
  } catch (error) {
    console.error("[nethys-importer] import failed", error);
    reply(request.requestId, { ok: false, error: (error as Error).message });
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !isPageImportRequest(event.data)) return;
  void handle(event.data);
});
