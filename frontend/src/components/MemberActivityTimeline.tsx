/**
 * Recent Activity timeline — day-grouped feed from GET /v1/members/{id}/activity.
 * Placeholders removed; only real API items are rendered.
 */

import { Activity } from "lucide-react";
import { Link } from "react-router";

import { AppIcon } from "./ui/AppIcon";
import {
  formatActivityDateTimeLabel,
  formatActivityTimeLabel,
  groupMemberActivityByDay,
  MEMBER_ACTIVITY_ICONS,
  MEMBER_ACTIVITY_KINDS,
  MEMBER_ACTIVITY_TITLES,
  type MemberActivityItem,
  type MemberActivityKind,
} from "../lib/member-activity-timeline";

type MemberActivityTimelineProps = {
  items?: MemberActivityItem[];
  loading?: boolean;
  /** Override "now" for stable day labels in tests. */
  now?: Date;
  /**
   * Flat list without day headers — title stacked over “Jul 4 · 7:17 PM”.
   * Used by Member Workspace preview cards.
   */
  layout?: "grouped" | "flat";
};

function ActivitySkeleton() {
  return (
    <div
      className="member-activity-loading"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading activity…</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="member-activity-skeleton-group">
          <div className="member-activity-skeleton-label" />
          <div className="member-activity-skeleton-row">
            <div className="member-activity-skeleton-icon" />
            <div className="member-activity-skeleton-copy">
              <div className="member-activity-skeleton-line member-activity-skeleton-line--title" />
              <div className="member-activity-skeleton-line member-activity-skeleton-line--meta" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityEmpty() {
  return (
    <div className="member-activity-empty" role="status">
      <div className="member-activity-empty-hero">
        <span className="member-activity-empty-icon" aria-hidden="true">
          <AppIcon icon={Activity} size="md" className="text-current" />
        </span>
        <div className="min-w-0">
          <p className="member-activity-empty-title">No recent activity yet.</p>
          <p className="member-activity-empty-desc">
            Completed tasks, dues payments, event check-ins, and meeting notes
            will show up here as they happen.
          </p>
        </div>
      </div>

      <ul className="member-activity-empty-kinds" aria-label="Tracked activity">
        {MEMBER_ACTIVITY_KINDS.map((kind) => {
          const Icon = MEMBER_ACTIVITY_ICONS[kind];
          return (
            <li
              key={kind}
              className={`member-activity-empty-kind member-activity-empty-kind--${kind}`}
            >
              <span
                className="member-activity-empty-kind-icon"
                aria-hidden="true"
              >
                <AppIcon icon={Icon} size="xs" className="text-current" />
              </span>
              <span>{MEMBER_ACTIVITY_TITLES[kind]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function kindClass(kind: MemberActivityKind): string {
  return `member-activity-icon member-activity-icon--${kind}`;
}

function ActivityRow({
  item,
  now,
  isLast,
  flat,
}: {
  item: MemberActivityItem;
  now: Date;
  isLast: boolean;
  flat: boolean;
}) {
  const Icon = MEMBER_ACTIVITY_ICONS[item.kind];
  const whenLabel = flat
    ? formatActivityDateTimeLabel(item.occurredAt)
    : formatActivityTimeLabel(item.occurredAt, now);
  const body = (
    <>
      <div
        className={
          flat
            ? "member-activity-row-top member-activity-row-top--stacked"
            : "member-activity-row-top"
        }
      >
        <h4 className="member-activity-title">{item.title}</h4>
        <time dateTime={item.occurredAt} className="member-activity-time">
          {whenLabel}
        </time>
      </div>
      {item.detail ? (
        <p className="member-activity-detail">{item.detail}</p>
      ) : null}
    </>
  );

  return (
    <li className="member-activity-row">
      <div className="member-activity-rail" aria-hidden="true">
        <span className={kindClass(item.kind)}>
          <AppIcon icon={Icon} size="sm" className="text-current" />
        </span>
        {!isLast ? <span className="member-activity-rail-line" /> : null}
      </div>
      {item.href ? (
        <Link to={item.href} className="member-activity-card is-link">
          {body}
        </Link>
      ) : (
        <article className="member-activity-card">{body}</article>
      )}
    </li>
  );
}

export function MemberActivityTimeline({
  items = [],
  loading = false,
  now: nowProp,
  layout = "grouped",
}: MemberActivityTimelineProps) {
  const now = nowProp ?? new Date();
  const flat = layout === "flat";

  if (loading) {
    return <ActivitySkeleton />;
  }

  if (items.length === 0) {
    return <ActivityEmpty />;
  }

  if (flat) {
    return (
      <div
        className="member-activity member-activity--flat"
        aria-label="Member activity timeline"
      >
        <ol className="member-activity-list">
          {items.map((entry, index) => (
            <ActivityRow
              key={entry.id}
              item={entry}
              now={now}
              isLast={index === items.length - 1}
              flat
            />
          ))}
        </ol>
      </div>
    );
  }

  const groups = groupMemberActivityByDay(items, now);

  return (
    <div className="member-activity" aria-label="Member activity timeline">
      {groups.map((group) => (
        <section
          key={group.key}
          className="member-activity-group"
          aria-labelledby={`member-activity-${group.key}`}
        >
          <div className="member-activity-day-row">
            <h3
              id={`member-activity-${group.key}`}
              className="member-activity-day"
            >
              {group.label}
            </h3>
            <span className="member-activity-day-rule" aria-hidden="true" />
          </div>
          <ol className="member-activity-list">
            {group.items.map((entry, index) => (
              <ActivityRow
                key={entry.id}
                item={entry}
                now={now}
                isLast={index === group.items.length - 1}
                flat={false}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
