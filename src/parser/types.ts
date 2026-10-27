export interface NpcNodes {
  name: Node | null;
  flavour: Node | null;
  details: Node[] | null;
  defense: Node[] | null;
  offense: Node[] | null;
  statistics: Node[] | null;
  ecology: Node[] | null;
  specialAbilities: Node[] | null;
  description: Node[] | null;
}

export type Section =
  | "Defense"
  | "Offense"
  | "Statistics"
  | "Ecology"
  | "Special Abilities"
  | "Description";

export type RawEntry =
  | { kind: "field"; label: string; text: string }
  | { kind: "text"; text: string };

export interface RawSection {
  heading: string;
  entries: RawEntry[];
}

export interface NpcRaw {
  name: string | null;
  flavour: string | null;
  details: RawSection | null;
  defense: RawSection | null;
  offense: RawSection | null;
  statistics: RawSection | null;
  ecology: RawSection | null;
  specialAbilities: RawSection | null;
  description: RawSection | null;
}
