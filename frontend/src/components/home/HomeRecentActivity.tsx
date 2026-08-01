import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchMemberActivity } from "../../lib/members-api";
import {
  mapMemberActivityApiItem,
  type MemberActivityItem,
  type MemberActivityKind,
} from "../../lib/member-activity-timeline";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

const DEFAULT_ACTIVITY_LIMIT = 16;

function activityVerb(kind: MemberActivityKind): string {
  switch (kind) {
    case "task_completed":
      return "completed";
    case "dues_paid":
      return "paid";
    case "event_checkin":
      return "attended";
    default:
      return "updated";
  }
}

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
  return raw;
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000,
  );
  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

type DayGroup = {
  key: string;
  label: string;
  people: Array<{
    name: string;
    actions: Array<{ id: string; text: string; href: string | null }>;
  }>;
};

function groupActivity(
  items: MemberActivityItem[],
  actorName: string,
): DayGroup[] {
  const actorFirst = actorName.split(/\s+/).filter(Boolean)[0] ?? actorName;
  const byDay = new Map<string, MemberActivityItem[]>();
  for (const item of items) {
    const key = dayKey(item.occurredAt);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  return [...byDay.entries()].map(([key, dayItems]) => {
    const peopleMap = new Map<
      string,
      Array<{ id: string; text: string; href: string | null }>
    >();
    for (const item of dayItems) {
      const actions = peopleMap.get(actorFirst) ?? [];
      actions.push({
        id: item.id,
        text: `${activityVerb(item.kind)} ${activitySubject(item)}`,
        href: item.href,
      });
      peopleMap.set(actorFirst, actions);
    }
    return {
      key,
      label: dayLabel(dayItems[0]!.occurredAt),
      people: [...peopleMap.entries()].map(([name, actions]) => ({
        name,
        actions,
      })),
    };
  });
}

export function HomeRecentActivity({
  memberId,
  memberName,
  limit = DEFAULT_ACTIVITY_LIMIT,
}: {
  memberId: number;
  memberName: string;
  limit?: number;
}) {
  const [items, setItems] = useState<MemberActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const actorName = memberName.trim() || "Member";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMemberActivity(memberId, { limit })
      .then((response) => {
        if (!cancelled) {
          setItems(
            response.items.map(mapMemberActivityApiItem).slice(0, limit),
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

  const groups = useMemo(
    () => groupActivity(items, actorName),
    [items, actorName],
  );

  return (
    <HomeCard
      padding="sm"
      className="home-activity home-activity--grouped home-surface-quiet"
      aria-label="Your activity"
    >
      <div className="home-activity-head">
        <h2 className="home-panel-title">Your activity</h2>
        <ArrowLink to={`/members/${memberId}`}>View all</ArrowLink>
      </div>

      {loading ? (
        <p className="home-activity-empty">Loading activity…</p>
      ) : groups.length === 0 ? (
        <p className="home-activity-empty">No recent activity yet.</p>
      ) : (
        <div className="home-activity-groups">
          {groups.map((group) => (
            <section key={group.key} className="home-activity-day">
              <h3 className="home-activity-day__label">{group.label}</h3>
              {group.people.map((person) => (
                <div key={person.name} className="home-activity-person">
                  <p className="home-activity-person__name">{person.name}</p>
                  <ul className="home-activity-person__actions">
                    {person.actions.map((action) => (
                      <li key={action.id}>
                        {action.href ? (
                          <Link
                            to={action.href}
                            className="home-activity-person__action"
                          >
                            {action.text}
                          </Link>
                        ) : (
                          <span className="home-activity-person__action">
                            {action.text}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </HomeCard>
  );
}
