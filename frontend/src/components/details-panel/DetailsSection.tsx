import type { ReactNode } from "react";

import { cx } from "../../design-system/cx";

type DetailsSectionProps = {
  children: ReactNode;
  /** Optional quiet section label (prefer none for denser layouts). */
  label?: ReactNode;
  "aria-label"?: string;
  className?: string;
};

export function DetailsSection({
  children,
  label,
  "aria-label": ariaLabel,
  className,
}: DetailsSectionProps) {
  return (
    <section
      className={cx("details-panel-section", className)}
      aria-label={ariaLabel}
    >
      {label ? <p className="details-panel-section-label">{label}</p> : null}
      {children}
    </section>
  );
}
