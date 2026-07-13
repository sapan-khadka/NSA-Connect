import {
  buildEventActivityTimeline,
  EVENT_ACTIVITY_ICONS,
  formatActivityTimeLabel,
  groupEventActivityByDay,
  type EventActivityItem,
} from "../lib/event-activity-timeline";
import {
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECTION_SUBTITLE,
  EVENT_MANAGE_SECTION_TITLE,
} from "../lib/event-manage-ui";
import type { EventDetailResponse } from "../lib/events-api";
import { AppIcon } from "./ui/AppIcon";
import { HomeCard } from "./ui/HomeCard";

type EventManageActivityTimelineProps = {
  event: EventDetailResponse;
  volunteerCount: number;
  hasBudget: boolean;
};

function ActivityRow({ item, now }: { item: EventActivityItem; now: Date }) {
  const Icon = EVENT_ACTIVITY_ICONS[item.kind];

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600">
          <AppIcon icon={Icon} size="sm" className="text-current" />
        </span>
        <span aria-hidden="true" className="mt-1 w-px flex-1 bg-gray-200" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <time
            dateTime={item.occurredAt}
            className="shrink-0 text-xs tabular-nums text-gray-400"
          >
            {formatActivityTimeLabel(item.occurredAt, now)}
          </time>
        </div>
        {item.detail ? (
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {item.detail}
          </p>
        ) : null}
        {item.isPlaceholder ? (
          <p className={`mt-1.5 ${EVENT_MANAGE_EYEBROW}`}>Preview</p>
        ) : null}
      </div>
    </li>
  );
}

export function EventManageActivityTimeline({
  event,
  volunteerCount,
  hasBudget,
}: EventManageActivityTimelineProps) {
  const now = new Date();
  const items = buildEventActivityTimeline({
    event,
    volunteerCount,
    hasBudget,
    now,
  });
  const groups = groupEventActivityByDay(items, now);

  return (
    <HomeCard
      padding="md"
      className={EVENT_MANAGE_SECTION_CARD_CLASS}
      aria-label="Event Activity Timeline"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={EVENT_MANAGE_SECTION_TITLE}>Activity Timeline</h2>
          <p className={EVENT_MANAGE_SECTION_SUBTITLE}>
            Recent changes and milestones for this event.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`activity-day-${group.key}`}>
            <h3
              id={`activity-day-${group.key}`}
              className={EVENT_MANAGE_EYEBROW}
            >
              {group.label}
            </h3>
            <ol className="mt-3">
              {group.items.map((item) => (
                <ActivityRow key={item.id} item={item} now={now} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </HomeCard>
  );
}
