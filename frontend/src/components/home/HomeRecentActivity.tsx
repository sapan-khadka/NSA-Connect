import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchMemberActivity } from "../../lib/members-api";
import {
  MEMBER_ACTIVITY_ICONS,
  mapMemberActivityApiItem,
  type MemberActivityItem,
} from "../../lib/member-activity-timeline";
import { formatRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

export function HomeRecentActivity({ memberId }: { memberId: number }) {
  const [items, setItems] = useState<MemberActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMemberActivity(memberId, { limit: 8 })
      .then((response) => {
        if (!cancelled) {
          setItems(response.items.map(mapMemberActivityApiItem).slice(0, 8));
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
  }, [memberId]);

  return (
    <HomeCard
      padding="sm"
      className="home-activity home-surface-quiet"
      aria-label="Recent activity"
    >
      <div className="home-activity-head">
        <h2 className="home-panel-title">Recent activity</h2>
        <ArrowLink to={`/members/${memberId}`}>View all activity</ArrowLink>
      </div>

      {loading ? (
        <p className="home-activity-empty">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="home-activity-empty">No recent activity yet.</p>
      ) : (
        <ul className="home-activity-rail">
          {items.map((item) => {
            const Icon = MEMBER_ACTIVITY_ICONS[item.kind];
            const body = (
              <>
                <span className="home-activity-icon" aria-hidden="true">
                  <AppIcon icon={Icon} size="xs" className="text-current" />
                </span>
                <span className="home-activity-copy">
                  <span className="home-activity-title">{item.title}</span>
                  <span className="home-activity-time">
                    {formatRelativeTimestamp(item.occurredAt)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={item.id} className="home-activity-rail-item">
                {item.href ? (
                  <Link to={item.href} className="home-activity-item">
                    {body}
                  </Link>
                ) : (
                  <div className="home-activity-item">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
