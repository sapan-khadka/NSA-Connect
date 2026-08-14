import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Banknote,
  CalendarCheck2,
  Check,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

import { startOfLocalDay } from "../../lib/calendar";
import {
  HOME_ACTIVITY_FETCH_LIMIT,
  HOME_ACTIVITY_LIMIT,
  HOME_ACTIVITY_WINDOW_DAYS,
  selectHomeRecentActivity,
} from "../../lib/home-recent-activity";
import { fetchMemberActivity } from "../../lib/members-api";
import {
  mapMemberActivityApiItem,
  type MemberActivityItem,
  type MemberActivityKind,
} from "../../lib/member-activity-timeline";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";

type TimelineEntry = {
  id: string;
  verb: string;
  subject: string;
  when: string;
  occurredAt: string;
  href: string | null;
  Icon: LucideIcon;
  tone: MemberActivityKind;
};

const KIND_META: Record<
  MemberActivityKind,
  { verb: string; Icon: LucideIcon }
> = {
  task_completed: { verb: "Completed", Icon: Check },
  dues_paid: { verb: "Paid", Icon: Banknote },
  event_checkin: { verb: "Attended", Icon: CalendarCheck2 },
  meeting_notes: { verb: "Notes", Icon: NotebookPen },
};

function activitySubject(item: MemberActivityItem): string {
  const raw = item.title.trim();
  if (item.kind === "task_completed") {
    return raw
      .replace(/^Completed\s+/i, "")
      .replace(/^['"]|['"]$/g, "")
      .trim();
  }
  if (item.kind === "dues_paid") {
    return raw.replace(/^Paid\s+/i, "").trim() || "membership dues";
  }
  if (item.kind === "event_checkin") {
    return raw.replace(/^Attended\s+/i, "").trim() || "an event";
  }
  if (item.kind === "meeting_notes") {
    return (
      raw
        .replace(/^Published meeting notes for\s+/i, "")
        .replace(/^Updated meeting notes for\s+/i, "")
        .trim() || "Meeting notes"
    );
  }
  return raw;
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Screenshot format: "Today, 11:30 AM" / "Yesterday, 4:15 PM" / "Jul 30, 9:10 PM" */
export function formatPersonalActivityWhen(
  iso: string,
  now = new Date(),
): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  const today = startOfLocalDay(now);
  const thatDay = startOfLocalDay(date);
  const diffDays = Math.round(
    (today.getTime() - thatDay.getTime()) / 86_400_000,
  );
  const time = formatClock(date);

  if (diffDays === 0) {
    return `Today, ${time}`;
  }
  if (diffDays === 1) {
    return `Yesterday, ${time}`;
  }

  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  return `${day}, ${time}`;
}

function toTimelineEntry(item: MemberActivityItem, now: Date): TimelineEntry {
  const meta = KIND_META[item.kind];
  return {
    id: item.id,
    verb: meta.verb,
    subject: activitySubject(item),
    when: formatPersonalActivityWhen(item.occurredAt, now),
    occurredAt: item.occurredAt,
    href: item.href ?? null,
    Icon: meta.Icon,
    tone: item.kind,
  };
}

function ActivityRow({ entry }: { entry: TimelineEntry }) {
  const inner = (
    <>
      <span
        className={`home-ya__badge home-ya__badge--${entry.tone}`}
        aria-hidden="true"
      >
        <AppIcon icon={entry.Icon} size="sm" />
      </span>
      <span className="home-ya__verb">{entry.verb}</span>
      <time className="home-ya__when" dateTime={entry.occurredAt}>
        {entry.when}
      </time>
      <span className="home-ya__subject">{entry.subject}</span>
    </>
  );

  if (entry.href) {
    return (
      <Link to={entry.href} className="home-ya__row">
        {inner}
      </Link>
    );
  }

  return <div className="home-ya__row">{inner}</div>;
}

export function HomeRecentActivity({
  memberId,
  limit = HOME_ACTIVITY_LIMIT,
}: {
  memberId: number;
  memberName?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<MemberActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMemberActivity(memberId, { limit: HOME_ACTIVITY_FETCH_LIMIT })
      .then((response) => {
        if (!cancelled) {
          setItems(
            selectHomeRecentActivity(
              response.items.map(mapMemberActivityApiItem),
              { limit },
            ),
          );
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
  }, [memberId, limit]);

  const entries = useMemo(() => {
    const now = new Date();
    return items.map((item) => toTimelineEntry(item, now));
  }, [items]);

  return (
    <section className="home-ya" aria-label="Recent Activity">
      <div className="home-task-header">
        <h2 className="home-section-kicker">Recent Activity</h2>
        <ArrowLink to={`/members/${memberId}`}>View all</ArrowLink>
      </div>

      {loading ? (
        <p className="home-activity-empty">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="home-activity-empty">
          Completions and updates from the last {HOME_ACTIVITY_WINDOW_DAYS}{" "}
          days will show here.
        </p>
      ) : (
        <ul className="home-ya__list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <ActivityRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
