import { useEffect, useState } from "react";

import {
  EVENT_ACTIVITY_ICONS,
  formatActivityTimeLabel,
  groupEventActivityByDay,
  type EventActivityItem as TimelineItem,
} from "../lib/event-activity-timeline";
import {
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECTION_SUBTITLE,
  EVENT_MANAGE_SECTION_TITLE,
} from "../lib/event-manage-ui";
import {
  fetchEventActivity,
  type EventActivityItem,
} from "../lib/events-api";
import { AppIcon } from "./ui/AppIcon";
import { HomeCard } from "./ui/HomeCard";

type EventManageActivityFeedProps = {
  eventId: number;
};

function toTimelineItem(item: EventActivityItem): TimelineItem {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    detail: item.detail ?? undefined,
    occurredAt: item.occurred_at,
  };
}

export function EventManageActivityFeed({ eventId }: EventManageActivityFeedProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchEventActivity(eventId)
      .then((response) => {
        if (!cancelled) {
          setItems(response.items.map(toTimelineItem));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const now = new Date();
  const groups = groupEventActivityByDay(items, now);

  return (
    <HomeCard
      padding="md"
      className={EVENT_MANAGE_SECTION_CARD_CLASS}
      aria-label="Event Activity"
    >
      <div>
        <h2 className={EVENT_MANAGE_SECTION_TITLE}>Activity</h2>
        <p className={EVENT_MANAGE_SECTION_SUBTITLE}>
          Recent RSVPs, check-ins, announcements, and reminders.
        </p>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No activity yet.</p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {group.label}
              </p>
              <ul className="mt-3 space-y-0">
                {group.items.map((item) => {
                  const Icon = EVENT_ACTIVITY_ICONS[item.kind];
                  return (
                    <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span className="z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600">
                          <AppIcon icon={Icon} size="sm" className="text-current" />
                        </span>
                        <span
                          aria-hidden="true"
                          className="mt-1 w-px flex-1 bg-gray-200"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <time
                            dateTime={item.occurredAt}
                            className="shrink-0 text-xs tabular-nums text-gray-400"
                          >
                            {formatActivityTimeLabel(item.occurredAt, now)}
                          </time>
                        </div>
                        {item.detail ? (
                          <p className="mt-1 text-sm text-gray-500">{item.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </HomeCard>
  );
}
