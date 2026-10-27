// Library entry point: parse a Nethys monster page and map it onto the Roll20 sheet.
export { parseNpc, type Npc } from "./parser/npc";
export { toSheet } from "./sheet/pathfinder1";
export type { SheetImport, AttributeWrite } from "./sheet/types";
