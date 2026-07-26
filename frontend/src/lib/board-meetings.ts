import type { MeetingSummary } from "./meetings-api";

export type BoardMeetingsStats = {
  total: number;
  needMinutes: number;
  needAttendance: number;
  ready: number;
};

export type MeetingStatusFilter = "all" | "upcoming" | "completed" | "needs_attention";
export type MeetingMissingFilter =
  | "all"
  | "minutes"
  | "attendance"
  | "either"
  | "ready";

export type MeetingMonthGroup = {
  key: string;
  label: string;
  meetings: MeetingSummary[];
};

export type MeetingSemesterGroup = {
  key: string;
  label: string;
  months: MeetingMonthGroup[];
};

/** Past meetings missing attendance or minutes. */
export function meetingNeedsAttention(meeting: MeetingSummary): boolean {
  if (!meeting.is_past) {
    return false;
  }
  return !meeting.has_attendance || !meeting.has_minutes;
}

/** Fully recorded past meeting (attendance + minutes). */
export function meetingIsComplete(meeting: MeetingSummary): boolean {
  return meeting.is_past && meeting.has_attendance && meeting.has_minutes;
}

export function calcBoardMeetingsStats(
  meetings: MeetingSummary[],
): BoardMeetingsStats {
  let needMinutes = 0;
  let needAttendance = 0;
  let ready = 0;

  for (const meeting of meetings) {
    if (!meeting.is_past) {
      continue;
    }
    if (!meeting.has_minutes) {
      needMinutes += 1;
    }
    if (!meeting.has_attendance) {
      needAttendance += 1;
    }
    if (meetingIsComplete(meeting)) {
      ready += 1;
    }
  }

  return {
    total: meetings.length,
    needMinutes,
    needAttendance,
    ready,
  };
}

export type MeetingStatusMark = {
  key: "attendance" | "minutes";
  label: string;
  done: boolean;
};

/** Monochrome scan marks for past meetings. */
export function getMeetingStatusMarks(
  meeting: MeetingSummary,
): MeetingStatusMark[] | null {
  if (!meeting.is_past) {
    return null;
  }
  return [
    {
      key: "attendance",
      label: "Attendance",
      done: meeting.has_attendance,
    },
    {
      key: "minutes",
      label: "Minutes",
      done: meeting.has_minutes,
    },
  ];
}

export type MeetingArtifact = {
  key: "attendance" | "minutes" | "tasks";
  label: string;
  done: boolean;
};

/** Checklist of records board members care about (no recording field yet). */
export function getMeetingArtifacts(meeting: MeetingSummary): MeetingArtifact[] {
  return [
    {
      key: "attendance",
      label: "Attendance",
      done: meeting.has_attendance,
    },
    {
      key: "minutes",
      label: "Minutes",
      done: meeting.has_minutes,
    },
    {
      key: "tasks",
      label: "Tasks",
      done: meeting.action_item_count > 0,
    },
  ];
}

export function calcMeetingCompletion(meeting: MeetingSummary): {
  done: number;
  total: number;
} {
  const artifacts = getMeetingArtifacts(meeting);
  return {
    done: artifacts.filter((item) => item.done).length,
    total: artifacts.length,
  };
}

export function formatMeetingWhen(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} · ${time}`;
}

/** First agenda line, cleaned for dense subtitle. */
export function meetingSubtitle(meeting: MeetingSummary): string {
  const agenda = meeting.agenda.trim();
  if (!agenda) {
    return "Board meeting";
  }
  const firstLine = agenda.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) {
    return "Board meeting";
  }
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
}

export function meetingMarkedCount(meeting: MeetingSummary): number {
  return meeting.present_count + meeting.absent_count + meeting.excused_count;
}

export function meetingAttendanceLabel(meeting: MeetingSummary): string | null {
  const marked = meetingMarkedCount(meeting);
  if (!meeting.has_attendance || marked === 0) {
    return null;
  }
  const parts = [
    `${meeting.present_count} Present`,
    `${meeting.absent_count} Absent`,
  ];
  if (meeting.excused_count > 0) {
    parts.push(`${meeting.excused_count} Excused`);
  }
  return parts.join(" · ");
}

function semesterKey(date: Date): { key: string; label: string; sort: number } {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  if (month >= 0 && month <= 4) {
    return {
      key: `spring-${year}`,
      label: `Spring ${year}`,
      sort: year * 10 + 1,
    };
  }
  if (month >= 5 && month <= 7) {
    return {
      key: `summer-${year}`,
      label: `Summer ${year}`,
      sort: year * 10 + 2,
    };
  }
  return {
    key: `fall-${year}`,
    label: `Fall ${year}`,
    sort: year * 10 + 3,
  };
}

function groupByMonth(meetings: MeetingSummary[]): MeetingMonthGroup[] {
  const buckets = new Map<
    string,
    { label: string; sort: number; meetings: MeetingSummary[] }
  >();

  for (const meeting of meetings) {
    const date = new Date(meeting.starts_at);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(date);
    const sort = date.getFullYear() * 12 + date.getMonth();
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.meetings.push(meeting);
    } else {
      buckets.set(key, { label, sort, meetings: [meeting] });
    }
  }

  return [...buckets.values()]
    .sort((left, right) => right.sort - left.sort)
    .map((bucket) => ({
      key: `${bucket.sort}`,
      label: bucket.label,
      meetings: bucket.meetings,
    }));
}

/** Upcoming first, then past by semester → month (newest first). */
export function groupMeetingsBySemester(
  meetings: MeetingSummary[],
): MeetingSemesterGroup[] {
  const upcoming = meetings
    .filter((meeting) => !meeting.is_past)
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );

  const groups: MeetingSemesterGroup[] = [];
  if (upcoming.length > 0) {
    groups.push({
      key: "upcoming",
      label: "Upcoming",
      months: groupByMonth(upcoming).reverse(),
    });
  }

  const pastBuckets = new Map<
    string,
    { label: string; sort: number; meetings: MeetingSummary[] }
  >();

  for (const meeting of meetings.filter((item) => item.is_past)) {
    const date = new Date(meeting.starts_at);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const { key, label, sort } = semesterKey(date);
    const bucket = pastBuckets.get(key);
    if (bucket) {
      bucket.meetings.push(meeting);
    } else {
      pastBuckets.set(key, { label, sort, meetings: [meeting] });
    }
  }

  const pastGroups = [...pastBuckets.entries()]
    .sort((left, right) => right[1].sort - left[1].sort)
    .map(([key, bucket]) => {
      const sorted = bucket.meetings.sort(
        (left, right) =>
          new Date(right.starts_at).getTime() -
          new Date(left.starts_at).getTime(),
      );
      return {
        key,
        label: bucket.label,
        months: groupByMonth(sorted),
      };
    });

  return [...groups, ...pastGroups];
}

export function filterMeetings(
  meetings: MeetingSummary[],
  options: {
    search: string;
    status: MeetingStatusFilter;
    year: "all" | number;
    missing: MeetingMissingFilter;
  },
): MeetingSummary[] {
  const query = options.search.trim().toLowerCase();

  return meetings.filter((meeting) => {
    if (query) {
      const haystack = `${meeting.event_name} ${meeting.agenda}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (options.status === "upcoming" && meeting.is_past) {
      return false;
    }
    if (options.status === "completed" && !meeting.is_past) {
      return false;
    }
    if (options.status === "needs_attention" && !meetingNeedsAttention(meeting)) {
      return false;
    }

    if (options.year !== "all") {
      const year = new Date(meeting.starts_at).getFullYear();
      if (year !== options.year) {
        return false;
      }
    }

    if (options.missing === "minutes") {
      if (!(meeting.is_past && !meeting.has_minutes)) {
        return false;
      }
    } else if (options.missing === "attendance") {
      if (!(meeting.is_past && !meeting.has_attendance)) {
        return false;
      }
    } else if (options.missing === "either") {
      if (!meetingNeedsAttention(meeting)) {
        return false;
      }
    } else if (options.missing === "ready") {
      if (!meetingIsComplete(meeting)) {
        return false;
      }
    }

    return true;
  });
}

export function meetingYearOptions(meetings: MeetingSummary[]): number[] {
  const years = new Set<number>();
  for (const meeting of meetings) {
    const year = new Date(meeting.starts_at).getFullYear();
    if (!Number.isNaN(year)) {
      years.add(year);
    }
  }
  return [...years].sort((left, right) => right - left);
}
