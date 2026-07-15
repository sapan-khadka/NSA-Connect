/**
 * Member Workspace — Upcoming Schedule helpers.
 * Assembles commitments from existing RSVP, volunteer, and meeting APIs only.
 */

import {
  fetchEventAttendees,
  fetchEventVolunteerSignups,
  fetchUpcomingEvents,
  type EventResponse,
  type RsvpStatus,
} from "./events-api";
import { fetchMeetings, type MeetingSummary } from "./meetings-api";
import { isRoleAtLeast, type MemberRole } from "./roles";
import {
  fetchMyVolunteerSignups,
  type MemberVolunteerSignup,
} from "./volunteer-api";

export type ScheduleCommitmentKind = "event" | "volunteer" | "meeting";

export type ScheduleCommitment = {
  id: string;
  kind: ScheduleCommitmentKind;
  kindLabel: string;
  title: string;
  detail: string | null;
  startsAt: string;
  whenLabel: string;
  href: string;
};

export const SCHEDULE_PREVIEW_LIMIT = 5;

export const SCHEDULE_VIEW_ALL_PATH = "/events/calendar";

const KIND_LABELS: Record<ScheduleCommitmentKind, string> = {
  event: "Event",
  volunteer: "Volunteer",
  meeting: "Meeting",
};

const RSVP_DETAIL: Partial<Record<RsvpStatus, string>> = {
  going: "Going",
  maybe: "Maybe",
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Relative-friendly when label: "Tomorrow • 6:00 PM". */
export function formatScheduleWhen(
  isoStartsAt: string,
  now = new Date(),
): string {
  const starts = new Date(isoStartsAt);
  if (!Number.isFinite(starts.getTime())) {
    return "—";
  }

  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(starts);

  const dayStart = startOfLocalDay(now).getTime();
  const eventDay = startOfLocalDay(starts).getTime();
  const dayDiff = Math.round((eventDay - dayStart) / 86_400_000);

  let dayLabel: string;
  if (dayDiff === 0) {
    dayLabel = "Today";
  } else if (dayDiff === 1) {
    dayLabel = "Tomorrow";
  } else if (dayDiff > 1 && dayDiff < 7) {
    dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
      starts,
    );
  } else {
    dayLabel = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(starts);
  }

  return `${dayLabel} • ${timeLabel}`;
}

export function sortScheduleCommitments(
  items: ScheduleCommitment[],
): ScheduleCommitment[] {
  return [...items].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
}

export function takeSchedulePreview(
  items: ScheduleCommitment[],
  limit = SCHEDULE_PREVIEW_LIMIT,
): { preview: ScheduleCommitment[]; hasMore: boolean; total: number } {
  const sorted = sortScheduleCommitments(items);
  return {
    preview: sorted.slice(0, limit),
    hasMore: sorted.length > limit,
    total: sorted.length,
  };
}

export function commitmentFromUpcomingRsvp(
  event: EventResponse,
  rsvpStatus: RsvpStatus,
  now = new Date(),
): ScheduleCommitment | null {
  if (rsvpStatus !== "going" && rsvpStatus !== "maybe") {
    return null;
  }
  if (event.is_past || new Date(event.starts_at).getTime() < now.getTime()) {
    return null;
  }

  const kind: ScheduleCommitmentKind =
    event.event_type === "meeting" ? "meeting" : "event";

  return {
    id: `${kind}-rsvp-${event.id}`,
    kind,
    kindLabel: KIND_LABELS[kind],
    title: event.name,
    detail: RSVP_DETAIL[rsvpStatus] ?? null,
    startsAt: event.starts_at,
    whenLabel: formatScheduleWhen(event.starts_at, now),
    href: `/events/${event.id}`,
  };
}

export function commitmentFromMyVolunteerSignup(
  signup: MemberVolunteerSignup,
  now = new Date(),
): ScheduleCommitment | null {
  if (signup.is_done) {
    return null;
  }
  if (new Date(signup.event_starts_at).getTime() < now.getTime()) {
    return null;
  }

  return {
    id: `volunteer-${signup.id}`,
    kind: "volunteer",
    kindLabel: KIND_LABELS.volunteer,
    title: signup.task_name,
    detail: signup.event_name,
    startsAt: signup.event_starts_at,
    whenLabel: formatScheduleWhen(signup.event_starts_at, now),
    href: `/events/${signup.event_id}`,
  };
}

export function commitmentFromMeeting(
  meeting: MeetingSummary,
  now = new Date(),
): ScheduleCommitment | null {
  if (meeting.is_past || new Date(meeting.starts_at).getTime() < now.getTime()) {
    return null;
  }

  return {
    id: `meeting-${meeting.event_id}`,
    kind: "meeting",
    kindLabel: KIND_LABELS.meeting,
    title: meeting.event_name,
    detail: "Board meeting",
    startsAt: meeting.starts_at,
    whenLabel: formatScheduleWhen(meeting.starts_at, now),
    href: `/events/meetings/${meeting.event_id}`,
  };
}

function memberExpectedAtBoardMeetings(role: MemberRole): boolean {
  return isRoleAtLeast(role, "board");
}

/**
 * Load upcoming commitments for a member using existing list/detail APIs.
 * Never invents rows — missing permission/data → omitted.
 */
export async function fetchMemberWorkspaceSchedule(input: {
  memberId: number;
  memberRole: MemberRole;
  isSelf: boolean;
  viewerIsBoard: boolean;
  now?: Date;
}): Promise<ScheduleCommitment[]> {
  const now = input.now ?? new Date();
  const byId = new Map<string, ScheduleCommitment>();

  function add(item: ScheduleCommitment | null) {
    if (!item) {
      return;
    }
    byId.set(item.id, item);
  }

  const upcomingResult = await fetchUpcomingEvents({ limit: 20 }).catch(
    () => null,
  );
  const upcoming = upcomingResult?.events ?? [];

  if (input.isSelf) {
    for (const event of upcoming) {
      const status = event.current_member_rsvp_status;
      if (!status) {
        continue;
      }
      // Board meetings for board members are added from the meetings API.
      if (
        event.event_type === "meeting" &&
        memberExpectedAtBoardMeetings(input.memberRole) &&
        input.viewerIsBoard
      ) {
        continue;
      }
      add(commitmentFromUpcomingRsvp(event, status, now));
    }

    const volunteerResult = await fetchMyVolunteerSignups().catch(() => null);
    for (const signup of volunteerResult?.signups ?? []) {
      add(commitmentFromMyVolunteerSignup(signup, now));
    }
  } else if (input.viewerIsBoard) {
    const eventsForLookup = upcoming.slice(0, 15);

    await Promise.all(
      eventsForLookup.map(async (event) => {
        if (event.event_type === "meeting") {
          return;
        }

        const attendees = await fetchEventAttendees(event.id).catch(() => null);
        const row = attendees?.attendees.find(
          (entry) => entry.member_id === input.memberId,
        );
        if (row?.rsvp_status) {
          add(commitmentFromUpcomingRsvp(event, row.rsvp_status, now));
        }

        const volunteers = await fetchEventVolunteerSignups(event.id).catch(
          () => null,
        );
        const signup = volunteers?.signups.find(
          (entry) => entry.member_id === input.memberId,
        );
        if (signup) {
          add({
            id: `volunteer-event-${event.id}-${signup.id}`,
            kind: "volunteer",
            kindLabel: KIND_LABELS.volunteer,
            title: event.name,
            detail: signup.note?.trim() || "Volunteer shift",
            startsAt: event.starts_at,
            whenLabel: formatScheduleWhen(event.starts_at, now),
            href: `/events/${event.id}`,
          });
        }
      }),
    );
  }

  if (
    input.viewerIsBoard &&
    memberExpectedAtBoardMeetings(input.memberRole)
  ) {
    const meetingsResult = await fetchMeetings().catch(() => null);
    for (const meeting of meetingsResult?.meetings ?? []) {
      add(commitmentFromMeeting(meeting, now));
    }
  }

  return sortScheduleCommitments([...byId.values()]);
}
