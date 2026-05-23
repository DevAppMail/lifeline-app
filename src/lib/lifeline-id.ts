// Avoids visually confusing characters: I, O, 0, 1
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLifelineId(): string {
  let id = "LL-";
  for (let i = 0; i < 8; i++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return id;
}
