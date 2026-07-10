import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";
import { Avatar } from "../Avatar";
import { Card } from "../Card";

export type ProfileCardField = {
  label: ReactNode;
  value: ReactNode;
};

export type ProfileCardProps = {
  title?: ReactNode;
  name?: string;
  subtitle?: ReactNode;
  avatarSrc?: string | null;
  /** Leading icon next to the section title. */
  icon?: ReactNode;
  /** Alert / banner above fields (e.g. dues). */
  alert?: ReactNode;
  fields?: ProfileCardField[];
  badge?: ReactNode;
  actionLabel?: ReactNode;
  actionTo?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Generic profile summary card with optional fields and primary action.
 */
export function ProfileCard({
  title = "Profile",
  name,
  subtitle,
  avatarSrc,
  icon,
  alert,
  fields = [],
  badge,
  actionLabel,
  actionTo,
  actionHref,
  onAction,
  className = "",
}: ProfileCardProps) {
  const actionClass =
    "inline-flex w-full items-center justify-center rounded-full border border-gray-200 bg-surface-card px-4 py-2 text-sm font-semibold text-foreground transition duration-200 hover:border-primary/40 hover:bg-badge-teal-bg sm:w-auto";

  let action: ReactNode = null;
  if (actionLabel) {
    if (actionTo) {
      action = (
        <Link to={actionTo} className={actionClass} onClick={onAction}>
          {actionLabel}
        </Link>
      );
    } else if (actionHref) {
      action = (
        <a href={actionHref} className={actionClass} onClick={onAction}>
          {actionLabel}
        </a>
      );
    } else {
      action = (
        <button type="button" className={actionClass} onClick={onAction}>
          {actionLabel}
        </button>
      );
    }
  }

  return (
    <Card className={cx("flex h-full flex-col", className)} padding="md">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        {name || avatarSrc ? (
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={name ?? ""} src={avatarSrc} size="md" />
            <div className="min-w-0">
              {name ? (
                <p className="truncate font-semibold text-foreground">{name}</p>
              ) : null}
              {subtitle ? (
                <p className="truncate text-sm text-label">{subtitle}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {alert}

        {fields.length > 0 ? (
          <dl className="mt-4 space-y-4 text-sm">
            {fields.map((field, index) => (
              <div key={index}>
                <dt className="text-sm font-semibold text-label">
                  {field.label}
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {badge ? <div className="mt-4">{badge}</div> : null}

        {action ? <div className="mt-auto pt-4">{action}</div> : null}
      </div>
    </Card>
  );
}
