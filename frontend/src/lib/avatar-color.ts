/** Stable pastel avatar colors from a name/id seed. */

export type AvatarColor = {
  background: string;
  color: string;
};

const AVATAR_PALETTE: AvatarColor[] = [
  { background: "#0F766E", color: "#FFFFFF" }, // teal
  { background: "#0369A1", color: "#FFFFFF" }, // sky
  { background: "#B45309", color: "#FFFFFF" }, // amber
  { background: "#BE123C", color: "#FFFFFF" }, // rose
  { background: "#15803D", color: "#FFFFFF" }, // green
  { background: "#C2410C", color: "#FFFFFF" }, // orange
  { background: "#0E7490", color: "#FFFFFF" }, // cyan
  { background: "#A16207", color: "#FFFFFF" }, // gold
  { background: "#1D4ED8", color: "#FFFFFF" }, // blue
  { background: "#9F1239", color: "#FFFFFF" }, // crimson
  { background: "#047857", color: "#FFFFFF" }, // emerald
  { background: "#B91C1C", color: "#FFFFFF" }, // red
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Pick a consistent color pair for a person/room label. */
export function avatarColorFromSeed(seed: string): AvatarColor {
  const cleaned = seed.trim().toLowerCase() || "?";
  const index = hashSeed(cleaned) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] ?? AVATAR_PALETTE[0];
}
