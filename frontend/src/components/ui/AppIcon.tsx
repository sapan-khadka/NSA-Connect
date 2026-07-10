import type { LucideIcon, LucideProps } from "lucide-react";

import {
  ICON_SIZE_CLASS,
  ICON_STROKE,
  type IconSize,
} from "../../lib/icon-system";

type AppIconProps = Omit<LucideProps, "ref" | "size" | "strokeWidth"> & {
  icon: LucideIcon;
  size?: IconSize;
};

/**
 * Standardized lucide icon: fixed stroke, size tokens, aria-hidden by default.
 * Pass className for color (e.g. text-label, text-accent, text-overdue).
 */
export function AppIcon({
  icon: Icon,
  size = "sm",
  className,
  "aria-hidden": ariaHidden = true,
  ...props
}: AppIconProps) {
  return (
    <Icon
      className={[ICON_SIZE_CLASS[size], "shrink-0", className]
        .filter(Boolean)
        .join(" ")}
      strokeWidth={ICON_STROKE}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
}
