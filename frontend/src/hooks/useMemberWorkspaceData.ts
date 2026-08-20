import { useEffect, useLayoutEffect, useState } from "react";

import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import {
  fetchMemberDuesHistory,
  fetchMyDuesHistory,
  type MemberDuesHistoryItem,
} from "../lib/dues-api";
import {
  fetchMyEventTasks,
  fetchTaskOverview,
  type EventTaskResponse,
} from "../lib/event-tasks-api";
import {
  mapMemberActivityApiItem,
  type MemberActivityItem,
} from "../lib/member-activity-timeline";
import {
  fetchMemberActivity,
  fetchMemberMeetingAttendanceStreak,
} from "../lib/members-api";
import {
  fetchMemberWorkspaceSchedule,
  type ScheduleCommitment,
} from "../lib/member-workspace-schedule";
import {
  canManageTreasury,
  canViewTaskOversight,
  isMemberRole,
  viewerCanManageMembers,
} from "../lib/roles";

export type UseMemberWorkspaceDataOptions = {
  member: MemberResponse | null;
  enabled?: boolean;
  activityLimit?: number;
  includeDues?: boolean;
  includeMeetingStreak?: boolean;
};

export type UseMemberWorkspaceDataResult = {
  memberTasks: EventTaskResponse[];
  scheduleItems: ScheduleCommitment[];
  activityItems: MemberActivityItem[];
  duesHistory: MemberDuesHistoryItem[];
  duesHistoryUnavailable: boolean;
  consecutiveMissedMeetings: number | null;
  isLoading: boolean;
};

const EMPTY_RESULT: UseMemberWorkspaceDataResult = {
  memberTasks: [],
  scheduleItems: [],
  activityItems: [],
  duesHistory: [],
  duesHistoryUnavailable: false,
  consecutiveMissedMeetings: null,
  isLoading: false,
};

export function useMemberWorkspaceData({
  member,
  enabled = true,
  activityLimit = 50,
  includeDues = false,
  includeMeetingStreak = false,
}: UseMemberWorkspaceDataOptions): UseMemberWorkspaceDataResult {
  const { member: currentMember } = useAuth();
  const [memberTasks, setMemberTasks] = useState<EventTaskResponse[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleCommitment[]>([]);
  const [activityItems, setActivityItems] = useState<MemberActivityItem[]>([]);
  const [duesHistory, setDuesHistory] = useState<MemberDuesHistoryItem[]>([]);
  const [duesHistoryUnavailable, setDuesHistoryUnavailable] = useState(false);
  const [consecutiveMissedMeetings, setConsecutiveMissedMeetings] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  useLayoutEffect(() => {
    if (enabled && member) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [
    enabled,
    member?.id,
    activityLimit,
    includeDues,
    includeMeetingStreak,
    currentMember?.id,
    currentMember?.role,
    currentMember?.position,
  ]);

  useEffect(() => {
    if (!enabled || !member) {
      setMemberTasks([]);
      setScheduleItems([]);
      setActivityItems([]);
      setDuesHistory([]);
      setDuesHistoryUnavailable(false);
      setConsecutiveMissedMeetings(null);
      return;
    }

    let cancelled = false;

    const isSelf = currentMember?.id === member.id;
    const memberRole = isMemberRole(member.role) ? member.role : "general";
    const canFetchDues = Boolean(
      includeDues &&
        currentMember &&
        canManageTreasury(currentMember.role, currentMember.position),
    );
    const canFetchTaskOverview = Boolean(
      currentMember &&
        canViewTaskOversight(currentMember.role, currentMember.position),
    );
    const viewerIsBoard = viewerCanManageMembers(currentMember);
    const canFetchMeetingStreak = Boolean(
      includeMeetingStreak && (isSelf || viewerIsBoard),
    );

    void (async () => {
      const duesHistoryPromise = includeDues
        ? isSelf
          ? fetchMyDuesHistory().catch(() => null)
          : canFetchDues
            ? fetchMemberDuesHistory(member.id).catch(() => null)
            : Promise.resolve(null)
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
        fetchMemberActivity(member.id, { limit: activityLimit }).catch(() => ({
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

      if (includeDues) {
        if (duesHistoryResult) {
          setDuesHistory(duesHistoryResult.records);
          setDuesHistoryUnavailable(false);
        } else {
          setDuesHistory([]);
          setDuesHistoryUnavailable(!isSelf && !canFetchDues);
        }
      } else {
        setDuesHistory([]);
        setDuesHistoryUnavailable(false);
      }

      setConsecutiveMissedMeetings(
        meetingStreakResult?.consecutive_missed_meetings ?? null,
      );
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    member,
    enabled,
    activityLimit,
    includeDues,
    includeMeetingStreak,
    currentMember?.id,
    currentMember?.role,
    currentMember?.position,
  ]);

  if (!enabled || !member) {
    return EMPTY_RESULT;
  }

  return {
    memberTasks,
    scheduleItems,
    activityItems,
    duesHistory,
    duesHistoryUnavailable,
    consecutiveMissedMeetings,
    isLoading,
  };
}
