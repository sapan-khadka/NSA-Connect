import { useId, type ReactNode } from "react";

import { cx } from "../../cx";
import { useBodyScrollLock, useEscapeKey } from "./useOverlay";

export type DrawerSide = "left" | "right";
export type DrawerSize = "sm" | "md" | "lg";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: DrawerSide;
  size?: DrawerSize;
  closeOnBackdrop?: boolean;
  showClose?: boolean;
  className?: string;
};

const SIZE_CLASS: Record<DrawerSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

/**
 * Side panel overlay. Consistent motion with Modal.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "right",
  size = "md",
  closeOnBackdrop = true,
  showClose = true,
  className = "",
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close panel"
        className="ds-animate-fade-in absolute inset-0 bg-black/40"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={cx(
          "absolute inset-y-0 flex w-full flex-col border-gray-200 bg-surface-card shadow-card-hover",
          side === "right"
            ? "right-0 border-l ds-animate-slide-in-right"
            : "left-0 border-r ds-animate-slide-in-left",
          SIZE_CLASS[size],
          className,
        )}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div className="min-w-0">
              {title ? (
                <h2
                  id={titleId}
                  className="text-lg font-semibold text-foreground"
                >
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-label">
                  {description}
                </p>
              ) : null}
            </div>
            {showClose ? (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-label transition hover:bg-surface-muted hover:text-foreground"
              >
                Close
              </button>
            ) : null}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
