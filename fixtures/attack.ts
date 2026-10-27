import { Attack } from "../src/parser/values/fields/offense";

export const attacks: [string, Partial<Attack>][] = [
  [
    "bite +26 (2d8+14 plus 3d6 electricity and energy drain)",
    {
      name: "bite",
      iteratives: [26],
      damage: "2d8+14",
      additionalEffects: "3d6 electricity and energy drain",
    },
  ],
  [
    "2 claws +15/+10 melee (1d10+4/19-20)",
    {
      quantity: 2,
      name: "claws",
      iteratives: [15, 10],
      kind: "melee",
      damage: "1d10+4",
      critRange: "19-20",
    },
  ],
  [
    "+5 composite longbow (+9 Str bonus) +31/+26/+21/+16 (2d6+14 plus slaying arrow)",
    {
      name: "+5 composite longbow",
      attackNotes: "+9 Str bonus",
      iteratives: [31, 26, 21, 16],
      damage: "2d6+14",
      additionalEffects: "slaying arrow",
    },
  ],
  [
    "1d4 tentacles +10 (1d6+2 plus grab)",
    {
      quantityRoll: "1d4",
      name: "tentacles",
      iteratives: [10],
      damage: "1d6+2",
      additionalEffects: "grab",
    },
  ],
  [
    "+10 incorporeal touch (1d6 Con drain)",
    {
      name: "touch",
      iteratives: [10],
      kind: "incorporeal",
      touch: true,
      damage: "1d6",
      damageType: "Con drain",
    },
  ],
  ["bite (1d6)", { name: "bite", damage: "1d6" }],
  ["bite +10", { name: "bite", iteratives: [10] }],
  [
    "bite +10 (1d6) plus poison",
    { name: "bite", iteratives: [10], damage: "1d6", additionalEffects: "poison" },
  ],
  [
    "bite +10 (1d6) (only while raging)",
    { name: "bite", iteratives: [10], damage: "1d6", restriction: "only while raging" },
  ],
  [
    "bite +20 (1d6 plus acid (DC 15 Fort))",
    { name: "bite", iteratives: [20], damage: "1d6", additionalEffects: "acid (DC 15 Fort)" },
  ],
  [
    "scimitar +10 (1d6+3/x3)",
    { name: "scimitar", iteratives: [10], damage: "1d6+3", critMultiplier: 3 },
  ],
  [
    "slam +9 (10d6+5/19-20/x3 electricity)",
    {
      name: "slam",
      iteratives: [9],
      damage: "10d6+5",
      critRange: "19-20",
      critMultiplier: 3,
      damageType: "electricity",
    },
  ],
  [
    "longsword +10 (1d8+3/19-20/\u00d73)",
    {
      name: "longsword",
      iteratives: [10],
      damage: "1d8+3",
      critRange: "19-20",
      critMultiplier: 3,
    },
  ],
  ["slam +12 (grab)", { name: "slam", iteratives: [12], additionalEffects: "grab" }],
];
