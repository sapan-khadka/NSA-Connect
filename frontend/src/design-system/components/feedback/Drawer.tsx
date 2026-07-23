import { useEffect, useId, useRef, type ReactNode } from "react";

import { cx } from "../../cx";
import { useBodyScrollLock, useEscapeKey } from "./useOverlay";

export type DrawerSide = "left" | "right" | "bottom";
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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side panel overlay. Consistent motion with Modal.
 * Moves focus into the panel on open and restores it on close.
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
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusTarget =
        panel.querySelector<HTMLElement>("[data-drawer-initial-focus]") ??
        panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        panel;
      focusTarget.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ].filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          "absolute flex flex-col border-gray-200 bg-surface-card shadow-card-hover",
          side === "bottom"
            ? "inset-x-0 bottom-0 max-h-[min(88vh,40rem)] w-full rounded-t-2xl border-t ds-animate-slide-up"
            : [
                "inset-y-0 w-full",
                side === "right"
                  ? "right-0 border-l ds-animate-slide-in-right"
                  : "left-0 border-r ds-animate-slide-in-left",
                SIZE_CLASS[size],
              ],
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
                data-drawer-initial-focus
                onClick={onClose}
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-label transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
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
