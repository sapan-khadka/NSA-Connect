import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cx } from "../cx";

export type CardVariant = "default" | "nested" | "outline";
export type CardPadding = "none" | "sm" | "md" | "lg";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  variant?: CardVariant;
  padding?: CardPadding;
  /** Enables hover lift + stronger shadow. */
  interactive?: boolean;
  children: ReactNode;
};

const PADDING_CLASS: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/**
 * CampusOS surface card.
 * Uses `.ds-card` / `.ds-card-nested` so existing mobile-edge CSS hooks keep working.
 */
export function Card({
  as: Component = "section",
  variant = "default",
  padding = "md",
  interactive = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cx(
        variant === "nested"
          ? "ds-card-nested"
          : variant === "outline"
            ? "rounded-card border border-gray-200 bg-transparent"
            : "ds-card",
        interactive ? "ds-card-interactive" : "",
        PADDING_CLASS[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
