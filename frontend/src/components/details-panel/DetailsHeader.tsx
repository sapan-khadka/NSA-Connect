import type { ReactNode } from "react";

import { cx } from "../../design-system/cx";

type DetailsHeaderProps = {
  /** Quiet back / clear control. */
  backLabel?: string;
  backAriaLabel?: string;
  onBack?: () => void;
  /** Muted title when there is no back action. */
  label?: ReactNode;
  /** Secondary trailing label (e.g. compact date). */
  trailing?: ReactNode;
  className?: string;
};

/** Lightweight breadcrumb bar — not a page header. */
export function DetailsHeader({
  backLabel,
  backAriaLabel,
  onBack,
  label,
  trailing,
  className,
}: DetailsHeaderProps) {
  const showBack = Boolean(onBack && backLabel);

  return (
    <div className={cx("details-panel-header", className)}>
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="details-panel-back"
          aria-label={backAriaLabel ?? backLabel}
        >
          <span aria-hidden="true">←</span> {backLabel}
        </button>
      ) : label ? (
        <div className="details-panel-header-label">{label}</div>
      ) : (
        <span />
      )}
      {trailing ? (
        <div className="details-panel-header-trailing">{trailing}</div>
      ) : null}
    </div>
  );
}
