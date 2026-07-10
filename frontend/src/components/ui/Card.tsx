import type { ElementType, ReactNode } from "react";

import { cx } from "../../design-system/cx";

type CardPadding = "none" | "sm" | "md" | "lg";

export type CardProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  nested?: boolean;
  padding?: CardPadding;
};

const PADDING_CLASS: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

function buildCardClass({
  interactive = false,
  nested = false,
}: {
  interactive?: boolean;
  nested?: boolean;
}): string {
  if (nested) {
    return interactive ? "ds-card-nested ds-card-interactive" : "ds-card-nested";
  }

  return interactive ? "ds-card ds-card-interactive" : "ds-card";
}

/**
 * CampusOS surface card. Styles come from design tokens via `.ds-card`.
 * Existing callers (HomeCard, etc.) keep the same API and appearance.
 */
export function Card({
  as: Component = "section",
  children,
  className = "",
  interactive = false,
  nested = false,
  padding = "none",
  ...rest
}: CardProps & Record<string, unknown>) {
  return (
    <Component
      className={cx(
        buildCardClass({ interactive, nested }),
        PADDING_CLASS[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
