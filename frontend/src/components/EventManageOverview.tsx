import type { EventDetailResponse } from "../lib/events-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import {
  buildNeedsAttentionItems,
  type AttentionAction,
  type EventManageTab,
} from "../lib/event-manage-command";
import { EventManageActivityFeed } from "./EventManageActivityFeed";
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";

export type { EventManageTab };

type EventManageOverviewProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  volunteerCount: number | null;
  volunteerNeeded?: number | null;
  volunteersLoading: boolean;
  openTasks: EventTaskResponse[];
  onAttentionAction: (action: AttentionAction) => void;
};

export function EventManageOverview({
  event,
  budget,
  volunteerCount,
  volunteerNeeded = null,
  volunteersLoading,
  openTasks,
  onAttentionAction,
}: EventManageOverviewProps) {
  const attention = buildNeedsAttentionItems({
    event,
    readinessInput: {
      event,
      budget,
      volunteerCount,
      volunteerNeeded,
      volunteersLoading,
    },
    openTasks,
  });

  return (
    <div className="event-command">
      <div className="event-command-layout">
        <section
          className="event-command-section is-flush"
          aria-label="Needs attention"
        >
          <div className="event-command-section-head">
            <h2 className="event-command-kicker">Needs attention</h2>
            <p className="event-command-count" aria-live="polite">
              {attention.length === 0 ? "Ready" : String(attention.length)}
            </p>
          </div>
          {attention.length === 0 ? (
            <p className="event-command-stat">
              Everything is ready for this event.
            </p>
          ) : (
            <ul className="event-attention-list">
              {attention.map((item) => (
                <li
                  key={item.id}
                  className={[
                    "event-attention-item",
                    item.severity === "fail" ? "is-fail" : "",
                    item.severity === "open" ? "is-open" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="event-attention-mark" aria-hidden="true" />
                  <span className="event-attention-label">{item.label}</span>
                  <button
                    type="button"
                    className={EVENT_MANAGE_ACTION_LINK}
                    onClick={() => onAttentionAction(item.action)}
                  >
                    {item.actionLabel}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="event-command-section event-command-aside">
          <EventManageActivityFeed eventId={event.id} compact />
        </aside>
      </div>
    </div>
  );
}
