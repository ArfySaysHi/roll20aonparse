// Same alphabet Firebase push ids use. Roll20 repeating row ids look like "-Nabc...", 20 chars.
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function makeRowId(random: () => number = Math.random): string {
  let id = "-";
  for (let i = 0; i < 19; i++) id += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return id;
}
