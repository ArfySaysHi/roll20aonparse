export const isHeading = (e: Node) => ["H1", "H2", "H3"].includes(e.nodeName);

export function findElementsUntil(startNode: Element, predicate: (e: Element) => boolean) {
  const elements = [startNode];
  let element = startNode.nextSibling;

  while (element) {
    if (predicate(element as Element)) break;

    elements.push(element as Element);
    element = element.nextSibling;
  }

  return elements;
}
