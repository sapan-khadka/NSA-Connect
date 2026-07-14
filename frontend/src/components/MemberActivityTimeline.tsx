/**
 * Beautiful member activity timeline — icons, day groups, empty + loading.
 * Presentation only; pass items or enable placeholdersWhenEmpty for demos.
 */

import { Activity } from "lucide-react";

import { AppIcon } from "./ui/AppIcon";
import {
  buildPlaceholderMemberActivity,
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
   * When there is no activity yet, show a polished sample timeline
   * covering Joined / Paid dues / Attended event / Completed task /
   * Assigned committee. Empty state remains the default.
   */
  placeholdersWhenEmpty?: boolean;
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
          <p className="member-activity-empty-title">No activity yet</p>
          <p className="member-activity-empty-desc">
            Milestones will appear here as this member joins, pays dues, attends
            events, completes tasks, and receives committee assignments.
          </p>
        </div>
      </div>

      <ul className="member-activity-empty-kinds" aria-label="Supported events">
        {MEMBER_ACTIVITY_KINDS.map((kind) => {
          const Icon = MEMBER_ACTIVITY_ICONS[kind];
          return (
            <li key={kind} className={`member-activity-empty-kind member-activity-empty-kind--${kind}`}>
              <span className="member-activity-empty-kind-icon" aria-hidden="true">
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
}: {
  item: MemberActivityItem;
  now: Date;
  isLast: boolean;
}) {
  const Icon = MEMBER_ACTIVITY_ICONS[item.kind];

  return (
    <li className="member-activity-row">
      <div className="member-activity-rail" aria-hidden="true">
        <span className={kindClass(item.kind)}>
          <AppIcon icon={Icon} size="sm" className="text-current" />
        </span>
        {!isLast ? <span className="member-activity-rail-line" /> : null}
      </div>
      <article className="member-activity-card">
        <div className="member-activity-row-top">
          <h4 className="member-activity-title">{item.title}</h4>
          <time dateTime={item.occurredAt} className="member-activity-time">
            {formatActivityTimeLabel(item.occurredAt, now)}
          </time>
        </div>
        {item.detail ? (
          <p className="member-activity-detail">{item.detail}</p>
        ) : null}
      </article>
    </li>
  );
}

export function MemberActivityTimeline({
  items = [],
  loading = false,
  now: nowProp,
  placeholdersWhenEmpty = false,
}: MemberActivityTimelineProps) {
  const now = nowProp ?? new Date();

  if (loading) {
    return <ActivitySkeleton />;
  }

  const usingPlaceholders = items.length === 0 && placeholdersWhenEmpty;
  const resolvedItems = usingPlaceholders
    ? buildPlaceholderMemberActivity(now)
    : items;

  if (resolvedItems.length === 0) {
    return <ActivityEmpty />;
  }

  const groups = groupMemberActivityByDay(resolvedItems, now);

  return (
    <div className="member-activity" aria-label="Member activity timeline">
      {usingPlaceholders ? (
        <p className="members-demo-note" role="note">
          Sample timeline — real milestones will replace this when activity is
          recorded.
        </p>
      ) : null}

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
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
