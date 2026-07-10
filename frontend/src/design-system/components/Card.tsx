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

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: "border border-gray-200 bg-surface-card shadow-card",
  nested: "border border-gray-200 bg-surface-muted",
  outline: "border border-gray-200 bg-transparent",
};

/**
 * CampusOS surface card. 16px radius and soft elevation from design tokens.
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
        "rounded-card transition duration-200 ease-out",
        VARIANT_CLASS[variant],
        PADDING_CLASS[padding],
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-card-hover"
          : "",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
