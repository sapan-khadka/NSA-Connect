import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "../../design-system/cx";
import { AppIcon } from "../ui/AppIcon";

export type DetailsTimelineItem = {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  icon?: LucideIcon;
};

type DetailsTimelineProps = {
  items: DetailsTimelineItem[];
  className?: string;
};

/** Vertical activity / history list. */
export function DetailsTimeline({ items, className }: DetailsTimelineProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ol className={cx("details-panel-timeline", className)}>
      {items.map((item) => (
        <li key={item.id} className="details-panel-timeline-item">
          {item.icon ? (
            <span className="details-panel-timeline-icon" aria-hidden="true">
              <AppIcon icon={item.icon} size="xs" />
            </span>
          ) : (
            <span className="details-panel-timeline-dot" aria-hidden="true" />
          )}
          <div className="details-panel-timeline-body">
            <p className="details-panel-timeline-title">{item.title}</p>
            {item.meta != null ? (
              <p className="details-panel-timeline-meta">{item.meta}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
