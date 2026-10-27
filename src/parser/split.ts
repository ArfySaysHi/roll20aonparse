import { isHeading } from "./dom/walk";
import { NpcNodes, RawEntry, RawSection, NpcRaw } from "./types";

export function splitNpcNodes(npc: NpcNodes): NpcRaw {
  return {
    name: npc.name?.textContent?.trim() ?? null,
    flavour: npc.flavour?.textContent?.trim() ?? null,
    details: splitSectionNodes(npc.details),
    defense: splitSectionNodes(npc.defense),
    offense: splitSectionNodes(npc.offense),
    statistics: splitSectionNodes(npc.statistics),
    ecology: splitSectionNodes(npc.ecology),
    specialAbilities: splitSectionNodes(npc.specialAbilities),
    description: splitSectionNodes(npc.description),
  };
}

export function splitSectionNodes(nodes: Node[] | null): RawSection | null {
  if (nodes === null) return null;

  const [first, ...body] = nodes;

  if (first === undefined || !isHeading(first)) {
    throw new Error("splitSectionNodes: node list must start with a heading");
  }

  return {
    heading: first.textContent?.trim() ?? "",
    entries: splitBody(body),
  };
}

export function splitBody(nodes: Node[]): RawEntry[] {
  const entries: RawEntry[] = [];
  let current: RawEntry = { kind: "text", text: "" };

  const finish = () => {
    const text = current.text.trim();

    if (current.kind === "field") {
      entries.push({ kind: "field", label: current.label, text });
    } else if (text !== "") {
      entries.push({ kind: "text", text });
    }
  };

  for (const node of nodes) {
    const label = node.nodeName === "B" ? (node.textContent?.trim() ?? "") : "";

    if (label !== "") {
      finish();
      current = { kind: "field", label, text: "" };
    } else if (node.nodeType === Node.COMMENT_NODE) {
      continue;
    } else if (node.nodeName === "BR") {
      current.text += "\n";
    } else {
      current.text += textWithoutSup(node);
    }
  }

  finish();

  return entries;
}

// Nethys marks bonus feats with a superscript ("Improved Initiative<sup>B</sup>"); the mark is
// not part of the name, so drop it rather than let it glue onto the text.
function textWithoutSup(node: Node): string {
  if (node.nodeType !== Node.ELEMENT_NODE) return node.textContent ?? "";

  const element = node as Element;
  if (element.tagName === "SUP") return "";
  if (element.querySelector("sup") === null) return element.textContent ?? "";

  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("sup").forEach((sup) => sup.remove());
  return clone.textContent ?? "";
}
