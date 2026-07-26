import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { avatarColorFromSeed } from "../../lib/avatar-color";
import { fetchMemberActivity } from "../../lib/members-api";
import {
  MEMBER_ACTIVITY_ICONS,
  mapMemberActivityApiItem,
  type MemberActivityItem,
  type MemberActivityKind,
} from "../../lib/member-activity-timeline";
import { formatRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

const DEFAULT_ACTIVITY_LIMIT = 12;

function initialsFromName(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function activityVerb(kind: MemberActivityKind): string {
  switch (kind) {
    case "task_completed":
      return "Completed";
    case "dues_paid":
      return "Paid";
    case "event_checkin":
      return "Attended";
    default:
      return "Updated";
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
  const actorFirst =
    actorName.split(/\s+/).filter(Boolean)[0] ?? actorName;
  const actorPalette = avatarColorFromSeed(`user:${memberId}`);
  const actorInitials = initialsFromName(actorName);

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

  return (
    <HomeCard
      padding="sm"
      className="home-activity home-activity--rich home-surface-quiet"
      aria-label="Recent activity"
    >
      <div className="home-activity-head">
        <h2 className="home-panel-title">Recent activity</h2>
        <ArrowLink to={`/members/${memberId}`}>View all</ArrowLink>
      </div>

      {loading ? (
        <p className="home-activity-empty">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="home-activity-empty">No recent activity yet.</p>
      ) : (
        <ul className="home-activity-feed">
          {items.map((item) => {
            const Icon = MEMBER_ACTIVITY_ICONS[item.kind];
            const verb = activityVerb(item.kind);
            const subject = activitySubject(item);
            const body = (
              <>
                <span className="home-activity-actor" aria-hidden="true">
                  <span
                    className="home-activity-avatar"
                    style={{
                      backgroundColor: actorPalette.background,
                      color: actorPalette.color,
                    }}
                  >
                    {actorInitials}
                  </span>
                  <span
                    className={`home-activity-icon is-${item.kind}`}
                  >
                    <AppIcon icon={Icon} size="xs" className="text-current" />
                  </span>
                </span>
                <span className="home-activity-copy">
                  <span className="home-activity-title">
                    <span className="home-activity-actor-name">
                      {actorFirst}
                    </span>{" "}
                    <span className="home-activity-verb">
                      {verb.toLowerCase()}
                    </span>{" "}
                    {subject}
                  </span>
                  <time
                    className="home-activity-time"
                    dateTime={item.occurredAt}
                  >
                    {formatRelativeTimestamp(item.occurredAt)}
                  </time>
                </span>
              </>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link to={item.href} className="home-activity-row">
                    {body}
                  </Link>
                ) : (
                  <div className="home-activity-row">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
