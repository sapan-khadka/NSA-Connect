import { useState, type HTMLAttributes } from "react";

import { cx } from "../cx";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  /** Image URL. Falls back to initials when missing or failed. */
  src?: string | null;
  /** Required for accessibility when `src` is provided. */
  alt?: string;
  /** Display name used to derive initials when no image. */
  name?: string;
  size?: AvatarSize;
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
 */
export function Avatar({
  src,
  alt = "",
  name = "",
  size = "md",
  className = "",
  ...rest
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const initials = name ? initialsFromName(name) : "?";
  const label = alt || name || "Avatar";

  return (
    <span
      role="img"
      aria-label={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-badge-teal-bg font-semibold text-badge-teal",
        SIZE_CLASS[size],
        className,
      )}
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
