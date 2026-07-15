/**
 * Placeholder card for Member Workspace sections that are not built yet.
 * Static "Coming soon" — not a loading skeleton.
 */

import type { LucideIcon } from "lucide-react";

import { AppIcon } from "../ui/AppIcon";

type MemberWorkspacePlaceholderCardProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Visual height hint for hierarchy (does not load data). */
  density?: "compact" | "default" | "tall";
  className?: string;
  /** Grid column span helpers applied by the parent layout. */
  spanClassName?: string;
};

export function MemberWorkspacePlaceholderCard({
  title,
  description = "Coming soon",
  icon,
  density = "default",
  className = "",
  spanClassName = "",
}: MemberWorkspacePlaceholderCardProps) {
  return (
    <section
      className={[
        "member-workspace-card",
        `member-workspace-card--${density}`,
        "member-workspace-card--coming-soon",
        spanClassName,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      <div className="member-workspace-card-header">
        <div className="member-workspace-card-heading">
          {icon ? (
            <span className="member-workspace-card-icon" aria-hidden="true">
              <AppIcon icon={icon} size="sm" className="text-current" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">{title}</h2>
            {description ? (
              <p className="member-workspace-card-desc">{description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="member-workspace-card-body">
        <p className="member-workspace-coming-soon">Coming soon</p>
      </div>
    </section>
  );
}
