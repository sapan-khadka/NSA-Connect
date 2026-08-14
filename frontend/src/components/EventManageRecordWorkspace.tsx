import { Link } from "react-router";

import type { EventAttendanceSummary } from "../lib/event-checkin-api";
import { photoAlbumPath } from "../lib/event-links";
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";
import type { EventDetailResponse } from "../lib/events-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { EventDeleteSection } from "./EventDeleteSection";
import { EventManageCommunicationsCard } from "./EventManageCommunicationsCard";

type EventManageRecordWorkspaceProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  attendanceSummary: EventAttendanceSummary | null;
  checkInCount: number;
  goingCount: number | null;
  onOpenFeedback: () => void;
  onOpenTransactions: () => void;
  onOpenAttendance: () => void;
  onOpenMeeting: () => void;
};

export function EventManageRecordWorkspace({
  event,
  budget,
  attendanceSummary,
  checkInCount,
  goingCount,
  onOpenFeedback,
  onOpenTransactions,
  onOpenAttendance,
  onOpenMeeting,
}: EventManageRecordWorkspaceProps) {
  const attended =
    (attendanceSummary?.going_attended.count ?? 0) +
    (attendanceSummary?.walk_ins.count ?? 0);
  const noShow = attendanceSummary?.going_no_show.count ?? 0;
  const going = goingCount ?? 0;
  const notes = event.description?.trim() || "No notes recorded yet.";

  return (
    <div className="event-command">
      <section className="event-command-section is-flush" aria-label="Event record">
        <div className="event-command-section-head">
          <h2 className="event-command-kicker">Record</h2>
        </div>
        <dl className="event-command-facts">
          <div>
            <dt>Attended</dt>
            <dd>
              {attended || going}
              {checkInCount > 0 ? ` · ${checkInCount} check-in` : ""}
              {attendanceSummary ? ` · ${noShow} no-show` : ""}
            </dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd>{budget ? formatCurrency(budget.actual_expense) : "—"}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{budget ? formatCurrency(budget.budget_remaining) : "—"}</dd>
          </div>
        </dl>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
          {event.is_past ? (
            <button
              type="button"
              className={EVENT_MANAGE_ACTION_LINK}
              onClick={onOpenFeedback}
            >
              Review feedback
            </button>
          ) : null}
          <button
            type="button"
            className={EVENT_MANAGE_ACTION_LINK}
            onClick={onOpenTransactions}
          >
            View financials
          </button>
          {attendanceSummary ? (
            <button
              type="button"
              className={EVENT_MANAGE_ACTION_LINK}
              onClick={onOpenAttendance}
            >
              Attendance report
            </button>
          ) : null}
          {event.event_type === "meeting" ? (
            <button
              type="button"
              className={EVENT_MANAGE_ACTION_LINK}
              onClick={onOpenMeeting}
            >
              Open meeting record
            </button>
          ) : null}
        </div>
      </section>

      <section className="event-command-section" aria-label="About this event">
        <div className="event-command-section-head">
          <h2 className="event-command-kicker">About</h2>
          <Link to={photoAlbumPath(event.id)} className={EVENT_MANAGE_ACTION_LINK}>
            Open album
          </Link>
        </div>
        <div className="flex items-start gap-3">
          {event.event_photo_url ? (
            <img
              src={event.event_photo_url}
              alt={`Cover for ${event.name}`}
              className="h-16 w-16 shrink-0 rounded object-cover"
            />
          ) : null}
          <p className="event-command-stat whitespace-pre-wrap">{notes}</p>
        </div>
      </section>

      <section className="event-command-section" aria-label="Share and announce">
        <EventManageCommunicationsCard event={event} />
      </section>

      <div className="event-command-section">
        <EventDeleteSection
          eventId={event.id}
          eventName={event.name}
          dangerZone
        />
      </div>
    </div>
  );
}
