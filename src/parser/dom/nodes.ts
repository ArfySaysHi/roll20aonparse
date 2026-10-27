import { NpcNodes } from "../types";
import { findName, findFlavourDescription, findDetails, findSectionContent } from "./statblock";

export function findNpcNodes(statblock: Document) {
  const npcNodes: NpcNodes = {
    name: null,
    flavour: null,
    details: null,
    defense: null,
    offense: null,
    statistics: null,
    ecology: null,
    specialAbilities: null,
    description: null,
  };

  npcNodes["name"] = findName(statblock);
  npcNodes["flavour"] = findFlavourDescription(statblock);
  npcNodes["details"] = findDetails(statblock);
  npcNodes["defense"] = findSectionContent(statblock, "Defense");
  npcNodes["offense"] = findSectionContent(statblock, "Offense");
  npcNodes["statistics"] = findSectionContent(statblock, "Statistics");
  npcNodes["ecology"] = findSectionContent(statblock, "Ecology");
  npcNodes["specialAbilities"] = findSectionContent(statblock, "Special Abilities");
  npcNodes["description"] = findSectionContent(statblock, "Description");

  return npcNodes;
}
