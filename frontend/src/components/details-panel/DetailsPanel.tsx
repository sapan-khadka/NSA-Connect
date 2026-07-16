import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../design-system/cx";

type DetailsPanelProps = {
  children: ReactNode;
  /** Soft elevated surface (default true). */
  elevated?: boolean;
  /** Stick to viewport when scrolling a parent column. */
  sticky?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;

/**
 * Domain-agnostic details shell. Compose with DetailsHero, DetailsSection, etc.
 * Never encodes Event / Member / Task / Finance semantics.
 */
export function DetailsPanel({
  children,
  elevated = true,
  sticky = false,
  className,
  ...rest
}: DetailsPanelProps) {
  return (
    <div
      {...rest}
      className={cx(
        "details-panel",
        elevated && "details-panel--elevated",
        sticky && "details-panel--sticky",
        className,
      )}
    >
      {children}
    </div>
  );
}
