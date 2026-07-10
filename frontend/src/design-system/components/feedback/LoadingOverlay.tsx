import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Spinner } from "../Spinner";
import { useBodyScrollLock } from "./useOverlay";

export type LoadingOverlayProps = {
  open: boolean;
  label?: string;
  /** Optional custom content instead of the default spinner. */
  children?: ReactNode;
  /** Cover only the parent (relative) instead of the viewport. */
  contained?: boolean;
  className?: string;
};

/**
 * Blocking loading veil. Use `contained` inside a relative parent.
 */
export function LoadingOverlay({
  open,
  label = "Loading",
  children,
  contained = false,
  className = "",
}: LoadingOverlayProps) {
  useBodyScrollLock(open && !contained);

  if (!open) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cx(
        "ds-animate-fade-in z-50 flex items-center justify-center bg-surface/70 backdrop-blur-[2px]",
        contained ? "absolute inset-0" : "fixed inset-0",
        className,
      )}
    >
      {children ?? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-surface-card px-6 py-5 shadow-card">
          <Spinner size="lg" label={label} />
          <p className="text-sm font-medium text-foreground">{label}</p>
        </div>
      )}
    </div>
  );
}
