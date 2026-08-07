/** Stable avatar colors from a person/id seed — same person → same color everywhere. */

export type AvatarColor = {
  background: string;
  color: string;
};

/**
 * Fixed palette (not random per render). Index is chosen by hashing the seed.
 * Same seed always maps to the same color.
 */
const AVATAR_PALETTE: AvatarColor[] = [
  { background: "#0F766E", color: "#FFFFFF" }, // teal
  { background: "#0369A1", color: "#FFFFFF" }, // sky
  { background: "#B45309", color: "#FFFFFF" }, // amber
  { background: "#BE123C", color: "#FFFFFF" }, // rose
  { background: "#15803D", color: "#FFFFFF" }, // green
  { background: "#C2410C", color: "#FFFFFF" }, // orange
  { background: "#0E7490", color: "#FFFFFF" }, // cyan
  { background: "#A16207", color: "#FFFFFF" }, // gold / sand
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

/**
 * Canonical seed for a chapter member's avatar.
 *
 * Priority:
 * 1. `member:{id}` when we know the member id (chat, tasks, directory, Home)
 * 2. `name:{normalized full name}` only when id is missing
 *
 * Not random: stable hash of this seed → palette index.
 * Using name-only vs id for the same person used to produce different colors —
 * always pass `memberId` when you have it.
 */
export function personAvatarSeed(
  memberId?: number | null,
  fullName?: string | null,
): string {
  if (memberId != null && Number.isFinite(Number(memberId))) {
    return `member:${Number(memberId)}`;
  }
  const name = fullName?.trim().toLowerCase() ?? "";
  if (name) {
    return `name:${name}`;
  }
  return "member:unknown";
}

/** Pick a consistent color pair for a person, room, or other label seed. */
export function avatarColorFromSeed(seed: string): AvatarColor {
  const cleaned = seed.trim().toLowerCase() || "?";
  const index = hashSeed(cleaned) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] ?? AVATAR_PALETTE[0]!;
}

/** Convenience: palette for a member when you have id and/or name. */
export function avatarColorForPerson(
  memberId?: number | null,
  fullName?: string | null,
): AvatarColor {
  return avatarColorFromSeed(personAvatarSeed(memberId, fullName));
}
