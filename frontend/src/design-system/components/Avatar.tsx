import { useState, type HTMLAttributes } from "react";

import {
  avatarColorFromSeed,
  personAvatarSeed,
} from "../../lib/avatar-color";
import { cx } from "../cx";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export type AvatarTone = "colorful" | "neutral";

export type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  /** Image URL. Falls back to initials when missing or failed. */
  src?: string | null;
  /** Required for accessibility when `src` is provided. */
  alt?: string;
  /** Display name used to derive initials when no image. */
  name?: string;
  /**
   * Platform member id — preferred for color so chat, Home, Members, etc. match.
   * Same as `colorSeed={personAvatarSeed(memberId, name)}`.
   */
  memberId?: number | null;
  size?: AvatarSize;
  /** Colorful = seeded palette; neutral = gray initials. */
  tone?: AvatarTone;
  /**
   * Optional override seed. Prefer `memberId` for people.
   * Rooms/channels may pass a room id seed instead.
   */
  colorSeed?: string;
};

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * User avatar with image or initials fallback.
 * Colors are stable per member id (not random per session).
 */
export function Avatar({
  src,
  alt = "",
  name = "",
  memberId = null,
  size = "md",
  tone = "colorful",
  colorSeed,
  className = "",
  ...rest
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const initials = name ? initialsFromName(name) : "?";
  const label = alt || name || "Avatar";
  const resolvedSeed =
    colorSeed?.trim() || personAvatarSeed(memberId, name || alt);
  const palette =
    tone === "neutral"
      ? { background: "#F0F0EE", color: "#52525B" }
      : avatarColorFromSeed(resolvedSeed);

  return (
    <span
      role="img"
      aria-label={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        SIZE_CLASS[size],
        className,
      )}
      style={
        showImage
          ? undefined
          : { backgroundColor: palette.background, color: palette.color }
      }
      {...rest}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
