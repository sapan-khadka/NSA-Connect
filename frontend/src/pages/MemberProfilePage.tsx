/**
 * Member Profile — Member Workspace layout shell.
 * Identity header + primary workflows (responsibilities, activity, schedule)
 * and supporting aside (notes, documents, financial). No snapshot dashboard.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { MemberWorkspaceCurrentResponsibilities } from "../components/member-workspace/MemberWorkspaceCurrentResponsibilities";
import { MemberWorkspaceDocuments } from "../components/member-workspace/MemberWorkspaceDocuments";
import { MemberWorkspaceFinancialStatus } from "../components/member-workspace/MemberWorkspaceFinancialStatus";
import { MemberWorkspaceHeader } from "../components/member-workspace/MemberWorkspaceHeader";
import { MemberWorkspaceInsights } from "../components/member-workspace/MemberWorkspaceInsights";
import { MemberWorkspaceLayout } from "../components/member-workspace/MemberWorkspaceLayout";
import { MemberWorkspacePrivateNotes } from "../components/member-workspace/MemberWorkspacePrivateNotes";
import { MemberWorkspaceRecentActivity } from "../components/member-workspace/MemberWorkspaceRecentActivity";
import { MemberWorkspaceUpcomingSchedule } from "../components/member-workspace/MemberWorkspaceUpcomingSchedule";
import { Skeleton } from "../design-system/components/Skeleton";
import { useAuth } from "../context/useAuth";
import { type MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchMemberDuesHistory,
  fetchMyDuesHistory,
  type MemberDuesHistoryItem,
} from "../lib/dues-api";
import { buildFinancialStatusSummary } from "../lib/member-workspace-financial";
import {
  fetchMyEventTasks,
  fetchTaskOverview,
  type EventTaskResponse,
} from "../lib/event-tasks-api";
import {
  mapMemberActivityApiItem,
  takeMemberActivityPreview,
  type MemberActivityItem,
} from "../lib/member-activity-timeline";
import {
  fetchMemberActivity,
  fetchMemberById,
  fetchMemberMeetingAttendanceStreak,
} from "../lib/members-api";
import {
  buildResponsibilityItems,
  getAssignTaskPath,
  getResponsibilitiesViewAllPath,
} from "../lib/member-workspace-responsibilities";
import {
  fetchMemberWorkspaceSchedule,
  takeSchedulePreview,
  type ScheduleCommitment,
} from "../lib/member-workspace-schedule";
import { buildMemberWorkspaceInsights } from "../lib/member-workspace-insights";
import {
  canManageEventTasks,
  canAccessMemberDocuments,
  canManageTreasury,
  canViewMemberDirectory,
  canViewTaskOversight,
  isMemberRole,
} from "../lib/roles";
import { getCurrentSemesterSlug } from "../lib/semester";

function formatMilestoneDate(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86_400_000,
  );
  if (dayDiff === 0) {
    return "Today";
  }
  if (dayDiff === 1) {
    return "Yesterday";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLastPaymentLabel(input: {
  activityItems: MemberActivityItem[];
  duesHistory: MemberDuesHistoryItem[];
}): string | null {
  const lastPaymentActivity = input.activityItems.find(
    (row) => row.kind === "dues_paid",
  );
  const lastPaidAt =
    lastPaymentActivity?.occurredAt ??
    input.duesHistory
      .map((row) => row.paid_at)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ??
    null;
  return formatMilestoneDate(lastPaidAt);
}

function MemberWorkspaceSkeleton() {
  return (
    <div
      className="member-workspace"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Loading member workspace…</p>
      <div className="member-workspace-shell">
        <header className="member-workspace-header">
          <div className="member-workspace-header-inner">
            <Skeleton height={14} width={88} />
            <div className="member-workspace-header-main mt-3">
              <Skeleton height={56} width={56} variant="circular" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton height={26} width="40%" />
                <Skeleton height={14} width="28%" />
                <Skeleton height={12} width="55%" />
              </div>
            </div>
          </div>
        </header>

        <div className="member-workspace-grid" aria-hidden="true">
          <div className="member-workspace-main space-y-3">
            <Skeleton height={140} width="100%" />
            <Skeleton height={120} width="100%" />
          </div>
          <div className="member-workspace-aside space-y-3">
            <Skeleton height={100} width="100%" />
            <Skeleton height={120} width="100%" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemberProfilePage() {
  const { memberId } = useParams();
  const { member: currentMember } = useAuth();
  const [profile, setProfile] = useState<MemberResponse | null>(null);
  const [memberTasks, setMemberTasks] = useState<EventTaskResponse[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleCommitment[]>([]);
  const [activityItems, setActivityItems] = useState<MemberActivityItem[]>([]);
  const [duesHistory, setDuesHistory] = useState<MemberDuesHistoryItem[]>([]);
  const [duesHistoryUnavailable, setDuesHistoryUnavailable] = useState(false);
  const [consecutiveMissedMeetings, setConsecutiveMissedMeetings] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canFetchDues = Boolean(
    currentMember &&
      canManageTreasury(currentMember.role, currentMember.position),
  );
  const canFetchTaskOverview = Boolean(
    currentMember &&
      canViewTaskOversight(currentMember.role, currentMember.position),
  );
  const canOpenEventManage = Boolean(
    currentMember &&
      canManageEventTasks(currentMember.role, currentMember.position),
  );
  const viewerIsBoard = Boolean(
    currentMember && canViewMemberDirectory(currentMember.role),
  );

  const responsibilityItems = useMemo(
    () =>
      buildResponsibilityItems(memberTasks, {
        canOpenEventManage,
      }),
    [memberTasks, canOpenEventManage],
  );

  const schedulePreview = useMemo(
    () => takeSchedulePreview(scheduleItems),
    [scheduleItems],
  );

  const activityPreview = useMemo(
    () => takeMemberActivityPreview(activityItems),
    [activityItems],
  );

  const financialSummary = useMemo(
    () =>
      buildFinancialStatusSummary({
        records: duesHistory,
        currentSemester: getCurrentSemesterSlug(),
      }),
    [duesHistory],
  );

  const workspaceInsights = useMemo(
    () =>
      buildMemberWorkspaceInsights({
        consecutiveMissedMeetings,
        financialSummary: duesHistoryUnavailable ? null : financialSummary,
        tasks: memberTasks,
      }),
    [
      consecutiveMissedMeetings,
      duesHistoryUnavailable,
      financialSummary,
      memberTasks,
    ],
  );

  const lastPaymentLabel = useMemo(
    () =>
      formatLastPaymentLabel({
        activityItems,
        duesHistory,
      }),
    [activityItems, duesHistory],
  );

  const viewAllPath = getResponsibilitiesViewAllPath({
    canViewOversight: canFetchTaskOverview,
  });
  const assignTaskPath = getAssignTaskPath({
    canManageEventTasks: canOpenEventManage,
  });

  useEffect(() => {
    const id = Number(memberId);
    if (!Number.isFinite(id)) {
      setError("Member not found.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const member = await fetchMemberById(id);
        if (cancelled) {
          return;
        }
        setProfile(member);
        setMemberTasks([]);
        setScheduleItems([]);
        setActivityItems([]);
        setDuesHistory([]);
        setDuesHistoryUnavailable(false);
        setConsecutiveMissedMeetings(null);

        const isSelf = currentMember?.id === member.id;
        const memberRole = isMemberRole(member.role) ? member.role : "general";
        const canFetchMeetingStreak = isSelf || viewerIsBoard;

        const duesHistoryPromise = isSelf
          ? fetchMyDuesHistory().catch(() => null)
          : canFetchDues
            ? fetchMemberDuesHistory(member.id).catch(() => null)
            : Promise.resolve(null);

        const [
          overviewResult,
          myTasksResult,
          scheduleResult,
          activityResult,
          duesHistoryResult,
          meetingStreakResult,
        ] = await Promise.all([
          canFetchTaskOverview
            ? fetchTaskOverview().catch(() => null)
            : Promise.resolve(null),
          isSelf && !canFetchTaskOverview
            ? fetchMyEventTasks().catch(() => null)
            : Promise.resolve(null),
          fetchMemberWorkspaceSchedule({
            memberId: member.id,
            memberRole,
            isSelf,
            viewerIsBoard,
          }).catch(() => [] as ScheduleCommitment[]),
          fetchMemberActivity(member.id, { limit: 50 }).catch(() => ({
            items: [],
            total: 0,
          })),
          duesHistoryPromise,
          canFetchMeetingStreak
            ? fetchMemberMeetingAttendanceStreak(member.id).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        let tasks: EventTaskResponse[] = [];

        if (overviewResult) {
          const row = overviewResult.members.find(
            (entry) => entry.member_id === member.id,
          );
          tasks = row?.tasks ?? [];
        } else if (myTasksResult) {
          tasks = myTasksResult.tasks;
        }

        setMemberTasks(tasks);
        setScheduleItems(scheduleResult);
        setActivityItems(activityResult.items.map(mapMemberActivityApiItem));
        if (duesHistoryResult) {
          setDuesHistory(duesHistoryResult.records);
          setDuesHistoryUnavailable(false);
        } else {
          setDuesHistory([]);
          setDuesHistoryUnavailable(!isSelf && !canFetchDues);
        }
        setConsecutiveMissedMeetings(
          meetingStreakResult?.consecutive_missed_meetings ?? null,
        );
      } catch (fetchError) {
        if (!cancelled) {
          setProfile(null);
          setMemberTasks([]);
          setScheduleItems([]);
          setActivityItems([]);
          setDuesHistory([]);
          setDuesHistoryUnavailable(false);
          setConsecutiveMissedMeetings(null);
          setError(getApiErrorMessage(fetchError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    memberId,
    canFetchDues,
    canFetchTaskOverview,
    currentMember?.id,
    viewerIsBoard,
  ]);
  if (isLoading) {
    return <MemberWorkspaceSkeleton />;
  }

  if (!profile) {
    return (
      <div className="member-workspace">
        <div className="member-workspace-shell">
          <p className="ds-field-error" role="alert">
            {error ?? "Member not found."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <MemberWorkspaceLayout
      header={
        <MemberWorkspaceHeader
          member={profile}
          onMemberUpdated={setProfile}
        />
      }
      responsibilities={
        <MemberWorkspaceCurrentResponsibilities
          items={responsibilityItems}
          viewAllPath={viewAllPath}
          assignTaskPath={assignTaskPath}
        />
      }
      recentActivity={
        <MemberWorkspaceRecentActivity
          items={activityPreview.preview}
          hasMore={activityPreview.hasMore}
        />
      }
      schedule={
        <MemberWorkspaceUpcomingSchedule
          items={schedulePreview.preview}
          hasMore={schedulePreview.hasMore}
        />
      }
      financialStatus={
        <MemberWorkspaceFinancialStatus
          summary={financialSummary}
          unavailable={duesHistoryUnavailable}
          lastPaymentLabel={lastPaymentLabel}
        />
      }
      privateNotes={
        viewerIsBoard ? (
          <MemberWorkspacePrivateNotes memberId={profile.id} />
        ) : undefined
      }
      documents={
        <MemberWorkspaceDocuments
          memberId={profile.id}
          canManage={Boolean(
            currentMember &&
              canAccessMemberDocuments(
                currentMember.role,
                currentMember.id,
                profile.id,
              ),
          )}
        />
      }
      insights={
        workspaceInsights.length > 0 ? (
          <MemberWorkspaceInsights insights={workspaceInsights} />
        ) : undefined
      }
    />
  );
}
