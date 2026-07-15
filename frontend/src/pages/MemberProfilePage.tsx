/**
 * Member Profile — Member Workspace layout shell.
 * Header, Today's Snapshot, and Current Responsibilities use real APIs where available.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { MemberWorkspaceCurrentResponsibilities } from "../components/member-workspace/MemberWorkspaceCurrentResponsibilities";
import { MemberWorkspaceDocuments } from "../components/member-workspace/MemberWorkspaceDocuments";
import { MemberWorkspaceFinancialStatus } from "../components/member-workspace/MemberWorkspaceFinancialStatus";
import { MemberWorkspaceHeader } from "../components/member-workspace/MemberWorkspaceHeader";
import { MemberWorkspaceInsights } from "../components/member-workspace/MemberWorkspaceInsights";
import { MemberWorkspaceLayout } from "../components/member-workspace/MemberWorkspaceLayout";
import { MemberWorkspaceRecentActivity } from "../components/member-workspace/MemberWorkspaceRecentActivity";
import { MemberWorkspaceTodaysSnapshot } from "../components/member-workspace/MemberWorkspaceTodaysSnapshot";
import { MemberWorkspaceUpcomingSchedule } from "../components/member-workspace/MemberWorkspaceUpcomingSchedule";
import { Skeleton } from "../design-system/components/Skeleton";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage, type MemberResponse } from "../lib/auth-api";
import {
  fetchDuesDashboard,
  fetchMemberDuesHistory,
  fetchMyDuesHistory,
  type MemberDuesHistoryItem,
  type MemberDuesRecord,
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
  activeTaskCountFromMyTasks,
  activeTaskCountFromOverviewMember,
} from "../lib/member-workspace-metrics";
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
  buildMemberWorkspaceSnapshot,
  type MemberWorkspaceSnapshotChip,
} from "../lib/member-workspace-snapshot";
import {
  canManageEventTasks,
  canAccessMemberDocuments,
  canManageTreasury,
  canViewMemberDirectory,
  canViewTaskOversight,
  isMemberRole,
} from "../lib/roles";
import { getCurrentSemesterSlug } from "../lib/semester";

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
            <Skeleton height={14} width={120} />
            <div className="member-workspace-header-main mt-4">
              <Skeleton height={72} width={72} variant="circular" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton height={32} width="42%" />
                <div className="flex gap-2">
                  <Skeleton height={22} width={64} />
                  <Skeleton height={22} width={64} />
                </div>
                <Skeleton height={12} width="70%" />
                <Skeleton height={12} width="55%" />
              </div>
            </div>
          </div>
        </header>

        <section className="member-workspace-snapshot" aria-hidden="true">
          <Skeleton height={14} width={140} />
          <div className="member-workspace-snapshot-chips mt-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} height={44} width="100%" />
            ))}
          </div>
        </section>

        <div className="member-workspace-grid" aria-hidden="true">
          <div className="member-workspace-main space-y-4">
            <Skeleton height={180} width="100%" />
            <Skeleton height={140} width="100%" />
          </div>
          <div className="member-workspace-aside space-y-4">
            <Skeleton height={120} width="100%" />
            <Skeleton height={160} width="100%" />
          </div>
        </div>
      </div>
    </div>
  );
}

function snapshotFromMember(
  member: MemberResponse,
  openTaskCount: number | null,
  duesRecord?: MemberDuesRecord,
): MemberWorkspaceSnapshotChip[] {
  return buildMemberWorkspaceSnapshot({
    member,
    openTaskCount,
    duesRecord,
  });
}

export function MemberProfilePage() {
  const { memberId } = useParams();
  const { member: currentMember } = useAuth();
  const [profile, setProfile] = useState<MemberResponse | null>(null);
  const [chips, setChips] = useState<MemberWorkspaceSnapshotChip[]>([]);
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
        setChips(snapshotFromMember(member, null));
        setMemberTasks([]);
        setScheduleItems([]);
        setActivityItems([]);
        setDuesHistory([]);
        setDuesHistoryUnavailable(false);
        setConsecutiveMissedMeetings(null);

        const isSelf = currentMember?.id === member.id;
        const semester = getCurrentSemesterSlug();
        const memberRole = isMemberRole(member.role) ? member.role : "general";
        const canFetchMeetingStreak = isSelf || viewerIsBoard;

        const duesHistoryPromise = isSelf
          ? fetchMyDuesHistory().catch(() => null)
          : canFetchDues
            ? fetchMemberDuesHistory(member.id).catch(() => null)
            : Promise.resolve(null);

        const [
          duesResult,
          overviewResult,
          myTasksResult,
          scheduleResult,
          activityResult,
          duesHistoryResult,
          meetingStreakResult,
        ] = await Promise.all([
          canFetchDues
            ? fetchDuesDashboard({ semester }).catch(() => null)
            : Promise.resolve(null),
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

        let openTaskCount: number | null = null;
        let tasks: EventTaskResponse[] = [];

        if (overviewResult) {
          const row = overviewResult.members.find(
            (entry) => entry.member_id === member.id,
          );
          openTaskCount = activeTaskCountFromOverviewMember(row);
          if (openTaskCount === null && row === undefined) {
            openTaskCount = 0;
          }
          tasks = row?.tasks ?? [];
        } else if (myTasksResult) {
          openTaskCount = activeTaskCountFromMyTasks(myTasksResult.tasks);
          tasks = myTasksResult.tasks;
        }

        const duesRecord = duesResult?.records.find(
          (record) => record.member_id === member.id,
        );

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
        setChips(snapshotFromMember(member, openTaskCount, duesRecord));
      } catch (fetchError) {
        if (!cancelled) {
          setProfile(null);
          setChips([]);
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
      header={<MemberWorkspaceHeader member={profile} />}
      overview={<MemberWorkspaceTodaysSnapshot chips={chips} />}
      responsibilities={
        <MemberWorkspaceCurrentResponsibilities
          items={responsibilityItems}
          viewAllPath={viewAllPath}
          assignTaskPath={assignTaskPath}
        />
      }
      schedule={
        <MemberWorkspaceUpcomingSchedule
          items={schedulePreview.preview}
          hasMore={schedulePreview.hasMore}
        />
      }
      recentActivity={
        <MemberWorkspaceRecentActivity
          items={activityPreview.preview}
          hasMore={activityPreview.hasMore}
        />
      }
      financialStatus={
        <MemberWorkspaceFinancialStatus
          summary={financialSummary}
          unavailable={duesHistoryUnavailable}
        />
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
      insights={<MemberWorkspaceInsights insights={workspaceInsights} />}
    />
  );
}
