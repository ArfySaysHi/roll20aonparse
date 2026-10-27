import { Section } from "../types";
import { findElementsUntil, isHeading } from "./walk";

export function findStatblock(document: Document) {
  return document.querySelector("#MainContent_DataListFeats_Label1_0");
}

export function findSectionContent(statblock: Document, section: Section) {
  const node = findSectionHeading(statblock, section);

  if (!node) return null;

  return findElementsUntil(node, isHeading);
}

export function findName(statblock: Document) {
  return statblock.querySelector("h1.title");
}

// Go element-by-element to find an italics tag after the statblock title,
// if you find a subheading first, break and return null
export function findFlavourDescription(statblock: Document) {
  const name = findName(statblock);

  if (!name) return null;

  const elements = findElementsUntil(name, isHeading);

  for (const el of elements) {
    if (el.tagName === "I") return el;
  }

  return null;
}

export function findSubheading(statblock: Document) {
  return statblock.querySelector("h2.title");
}

export function findDetails(statblock: Document) {
  const subheading = findSubheading(statblock);

  if (!subheading) return null;

  const elements = findElementsUntil(subheading, isHeading);

  return elements;
}

export function findSectionHeading(statblock: Document, section: Section) {
  const sections = statblock.querySelectorAll("h3.framing");

  for (const sectionHeader of sections) {
    if (sectionHeader.textContent.trim() === section) return sectionHeader;
  }

  return null;
}
