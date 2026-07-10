import type { ElementType, ReactNode } from "react";

import {
  Card as DesignSystemCard,
  type CardPadding,
} from "../../design-system/components/Card";

export type { CardPadding };

export type CardProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  nested?: boolean;
  padding?: CardPadding;
};

/**
 * App-facing Card — wraps the design-system Card with the legacy `nested` API.
 * Default padding is `none` so callers that pass padding via className stay unchanged.
 */
export function Card({
  as,
  children,
  className = "",
  interactive = false,
  nested = false,
  padding = "none",
  ...rest
}: CardProps & Record<string, unknown>) {
  return (
    <DesignSystemCard
      as={as}
      variant={nested ? "nested" : "default"}
      padding={padding}
      interactive={interactive}
      className={className}
      {...rest}
    >
      {children}
    </DesignSystemCard>
  );
}
