import { useId, type ReactNode } from "react";

import { cx } from "../../cx";
import { useBodyScrollLock, useEscapeKey } from "./useOverlay";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** Close when backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /** Show header close control. Default true. */
  showClose?: boolean;
  className?: string;
};

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Centered dialog with backdrop, escape-to-close, and scroll lock.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  showClose = true,
  className = "",
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="ds-animate-fade-in absolute inset-0 bg-black/40"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={cx(
          "ds-animate-slide-up relative z-10 flex max-h-[min(90vh,48rem)] w-full flex-col overflow-hidden rounded-card border border-gray-200 bg-surface-card shadow-card-hover",
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
                <p
                  id={descriptionId}
                  className="mt-1 text-sm text-label"
                >
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
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
