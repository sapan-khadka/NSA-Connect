import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../cx";

export type AlertTone = "info" | "success" | "warning" | "danger" | "neutral";

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
};

const TONE_CLASS: Record<AlertTone, string> = {
  info: "border-badge-blue/25 bg-badge-blue-bg text-badge-blue",
  success: "border-success/25 bg-success-surface text-success",
  warning: "border-warning/25 bg-warning-surface text-warning",
  danger: "border-overdue/25 bg-overdue-surface text-overdue",
  neutral: "border-gray-200 bg-surface-muted text-foreground",
};

/**
 * Inline feedback banner. Use Toast for transient notifications.
 */
export function Alert({
  tone = "info",
  title,
  children,
  icon,
  action,
  onDismiss,
  className = "",
  ...rest
}: AlertProps) {
  return (
    <div
      role="status"
      className={cx(
        "ds-animate-slide-up flex gap-3 rounded-card border px-4 py-3 text-sm",
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="font-semibold text-current">{title}</p>
        ) : null}
        {children ? (
          <div
            className={cx(
              title ? "mt-1 text-current/90" : "text-current",
              "leading-relaxed",
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 self-start rounded-lg px-1.5 py-0.5 text-current/70 transition hover:bg-black/5 hover:text-current"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
