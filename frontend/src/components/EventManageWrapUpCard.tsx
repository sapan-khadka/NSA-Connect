import { Link } from "react-router-dom";

import type { EventAttendanceSummary } from "../lib/event-checkin-api";
import {
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECTION_SUBTITLE,
  EVENT_MANAGE_SECTION_TITLE,
} from "../lib/event-manage-ui";
import type { EventDetailResponse } from "../lib/events-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { photoAlbumPath } from "../lib/event-links";
import { HomeCard } from "./ui/HomeCard";

type EventManageWrapUpCardProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  attendanceSummary: EventAttendanceSummary | null;
  feedbackCount: number | null;
  onOpenFeedback: () => void;
  onOpenTransactions: () => void;
  onOpenAttendance: () => void;
};

type WrapItem = {
  id: string;
  label: string;
  done: boolean;
  actionLabel: string;
  onAction?: () => void;
  href?: string;
};

export function EventManageWrapUpCard({
  event,
  budget,
  attendanceSummary,
  feedbackCount,
  onOpenFeedback,
  onOpenTransactions,
  onOpenAttendance,
}: EventManageWrapUpCardProps) {
  if (!event.is_past) {
    return null;
  }

  const items: WrapItem[] = [
    {
      id: "photos",
      label: "Photos in archive",
      done: Boolean(event.show_in_photo_archive && event.event_photo_url),
      actionLabel: "Open album",
      href: photoAlbumPath(event.id),
    },
    {
      id: "feedback",
      label: "Collect member feedback",
      done: (feedbackCount ?? 0) > 0,
      actionLabel: "Review feedback",
      onAction: onOpenFeedback,
    },
    {
      id: "finance",
      label: "Finance closeout",
      done: Boolean(budget && budget.entry_count > 0),
      actionLabel: "View transactions",
      onAction: onOpenTransactions,
    },
    {
      id: "attendance",
      label: "Attendance recorded",
      done: Boolean(
        attendanceSummary &&
          attendanceSummary.going_attended.count +
            attendanceSummary.walk_ins.count >
            0,
      ),
      actionLabel: "Check attendance",
      onAction: onOpenAttendance,
    },
  ];

  const doneCount = items.filter((item) => item.done).length;

  return (
    <HomeCard
      padding="md"
      className={EVENT_MANAGE_SECTION_CARD_CLASS}
      aria-label="Post-event wrap-up"
    >
      <div>
        <h2 className={EVENT_MANAGE_SECTION_TITLE}>Post-event wrap-up</h2>
        <p className={EVENT_MANAGE_SECTION_SUBTITLE}>
          {doneCount}/{items.length} wrap-up items complete.
        </p>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {item.done ? "Done" : "Still open"}
              </p>
            </div>
            {item.href ? (
              <Link
                to={item.href}
                className="shrink-0 text-sm font-medium text-primary hover:text-primary/80"
              >
                {item.actionLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={item.onAction}
                className="shrink-0 text-sm font-medium text-primary hover:text-primary/80"
              >
                {item.actionLabel}
              </button>
            )}
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
