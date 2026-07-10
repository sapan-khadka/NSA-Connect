import type { ReactNode } from "react";

import { cx } from "../../cx";

export type ToastTone = "info" | "success" | "warning" | "danger" | "neutral";

export type ToastProps = {
  title?: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  open?: boolean;
  onClose?: () => void;
  action?: ReactNode;
  className?: string;
};

const TONE_CLASS: Record<ToastTone, string> = {
  info: "border-badge-blue/20 bg-surface-card",
  success: "border-success/25 bg-surface-card",
  warning: "border-warning/25 bg-surface-card",
  danger: "border-overdue/25 bg-surface-card",
  neutral: "border-gray-200 bg-surface-card",
};

const ACCENT: Record<ToastTone, string> = {
  info: "bg-badge-blue",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-overdue",
  neutral: "bg-label",
};

/**
 * Single toast notification. Place inside ToastViewport for stacking.
 */
export function Toast({
  title,
  description,
  tone = "neutral",
  open = true,
  onClose,
  action,
  className = "",
}: ToastProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "ds-animate-slide-up pointer-events-auto flex w-full max-w-sm gap-3 overflow-hidden rounded-card border shadow-card",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cx("w-1 shrink-0", ACCENT[tone])} />
      <div className="min-w-0 flex-1 py-3 pr-1">
        {title ? (
          <p className="text-sm font-semibold text-foreground">{title}</p>
        ) : null}
        {description ? (
          <p className={cx("text-sm text-label", title ? "mt-1" : "")}>
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="m-2 h-8 w-8 shrink-0 rounded-lg text-label transition hover:bg-surface-muted hover:text-foreground"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export type ToastViewportProps = {
  children: ReactNode;
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
  className?: string;
};

const POSITION_CLASS: Record<
  NonNullable<ToastViewportProps["position"]>,
  string
> = {
  "top-right": "top-4 right-4 items-end",
  "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-4 right-4 items-end",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
};

/**
 * Fixed region for stacking toasts.
 */
export function ToastViewport({
  children,
  position = "top-right",
  className = "",
}: ToastViewportProps) {
  return (
    <div
      aria-label="Notifications"
      className={cx(
        "pointer-events-none fixed z-[60] flex w-[min(100%-2rem,24rem)] flex-col gap-2",
        POSITION_CLASS[position],
        className,
      )}
    >
      {children}
    </div>
  );
}
