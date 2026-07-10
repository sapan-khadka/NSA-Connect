import type { LucideIcon } from "lucide-react";

import {
  BADGE_TONES,
  badgeToneForCategory,
  type BadgeCategory,
  type BadgeTone,
} from "../../lib/badge-tones";
import { AppIcon } from "./AppIcon";
import type { IconSize } from "../../lib/icon-system";

type IconBadgeProps = {
  icon: LucideIcon;
  tone?: BadgeTone;
  category?: BadgeCategory;
  size?: "sm" | "md" | "lg";
  shape?: "rounded" | "circle";
  className?: string;
};

const BADGE_BOX: Record<NonNullable<IconBadgeProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const ICON_SIZE: Record<NonNullable<IconBadgeProps["size"]>, IconSize> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

/**
 * Pastel rounded badge wrapping a lucide outline icon.
 * Prefer `category` so tones stay consistent by meaning.
 */
export function IconBadge({
  icon,
  tone,
  category,
  size = "md",
  shape = "rounded",
  className = "",
}: IconBadgeProps) {
  const resolvedTone = tone ?? (category ? badgeToneForCategory(category) : "teal");
  const colors = BADGE_TONES[resolvedTone];

  return (
    <span
      aria-hidden="true"
      className={[
        "ds-icon-btn shrink-0",
        BADGE_BOX[size],
        shape === "circle" ? "rounded-full" : "rounded-[10px]",
        className,
      ].join(" ")}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      <AppIcon icon={icon} size={ICON_SIZE[size]} className="text-current" />
    </span>
  );
}
