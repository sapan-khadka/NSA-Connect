import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type { MemberResponse } from "../../lib/auth-api";
import type { EventResponse } from "../../lib/events-api";
import { fetchFinanceSummary } from "../../lib/finance-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import {
  buildTodaysFocusItems,
  pickMinutesMissingMeeting,
  type FocusItem,
} from "../../lib/home-todays-focus";
import { fetchMeetings } from "../../lib/meetings-api";
import {
  canManageMeetingRecords,
  canManageTreasury,
  viewerCanManageMembers,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";

export type { FocusItem };
export { buildTodaysFocusItems } from "../../lib/home-todays-focus";

export function HomeTodaysFocus({
  member,
  tasksSummary,
  tasksPath,
  pendingMemberApprovals,
  financePendingCount,
  nextEvent,
  isLoading,
}: {
  member: MemberResponse;
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  pendingMemberApprovals: number;
  financePendingCount: number;
  nextEvent: EventResponse | null;
  isLoading?: boolean;
}) {
  const canReviewMembers = viewerCanManageMembers(member);
  const canReviewFinance = canManageTreasury(member.role, member.position);
  const canManageMinutes = canManageMeetingRecords(
    member.role,
    member.position,
  );
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [minutesMissing, setMinutesMissing] = useState<{
    eventId: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!canReviewFinance) {
      setTreasuryBalance(null);
      return;
    }
    let cancelled = false;
    void fetchFinanceSummary()
      .then((summary) => {
        if (!cancelled) {
          const amount = Number(summary.balance);
          setTreasuryBalance(Number.isFinite(amount) ? amount : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTreasuryBalance(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canReviewFinance, member.id]);

  useEffect(() => {
    if (!canManageMinutes) {
      setMinutesMissing(null);
      return;
    }
    let cancelled = false;
    void fetchMeetings()
      .then((response) => {
        if (!cancelled) {
          setMinutesMissing(pickMinutesMissingMeeting(response.meetings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMinutesMissing(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManageMinutes, member.id]);

  const items = useMemo(
    () =>
      buildTodaysFocusItems({
        tasksSummary,
        tasksPath,
        pendingMemberApprovals,
        financePendingCount,
        canReviewMembers,
        canReviewFinance,
        treasuryBalance,
        nextEvent,
        minutesMissing,
      }),
    [
      tasksSummary,
      tasksPath,
      pendingMemberApprovals,
      financePendingCount,
      canReviewMembers,
      canReviewFinance,
      treasuryBalance,
      nextEvent,
      minutesMissing,
    ],
  );

  return (
    <section className="home-focus" aria-label="Today's Focus">
      <div className="home-task-header">
        <h2 className="home-section-kicker">Today&apos;s Focus</h2>
      </div>

      {isLoading ? (
        <p className="home-focus__empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="home-focus__empty">
          Nothing needs attention right now.
        </p>
      ) : (
        <ul className="home-focus__list">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className={`home-focus__row is-${item.tone}`}
              >
                <span className="home-focus__label">{item.label}</span>
                {item.detail ? (
                  <span className="home-focus__detail">{item.detail}</span>
                ) : (
                  <span className="home-focus__detail" aria-hidden />
                )}
                <AppIcon
                  icon={ChevronRight}
                  size="xs"
                  className="home-focus__chev"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
