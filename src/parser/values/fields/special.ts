export interface SpecialAbility {
  name: string;
  type: string | null;
  description: string;
}

// "Water Mastery (Ex)", "Vortex (Su)", "Slaying Arrow (Ex or Su)"
const KIND = "(?:Ex|Su|Sp|Ps)";
const ABILITY_LABEL = new RegExp(`^(.+?)\\s*\\((${KIND}(?:\\s*(?:or|/)\\s*${KIND})*)\\)$`);

export function parseSpecialAbility(label: string, text: string): SpecialAbility {
  const match = label.trim().match(ABILITY_LABEL);

  return {
    name: match ? match[1]!.trim() : label.trim(),
    type: match ? match[2]! : null,
    description: text.trim(),
  };
}
