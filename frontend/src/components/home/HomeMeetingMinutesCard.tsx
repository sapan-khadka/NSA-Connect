import { ChevronRight, NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { meetingWorkspacePath } from "../../lib/meeting-workspace";
import {
  fetchMeetings,
  type MeetingSummary,
} from "../../lib/meetings-api";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

const MEETINGS_PATH = "/events/meetings";

function meetingPath(eventId: number): string {
  return meetingWorkspacePath(eventId);
}

function meetingNotesPath(eventId: number): string {
  return meetingWorkspacePath(eventId, "minutes");
}

function formatMeetingWhen(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

function pickFocusMeeting(meetings: MeetingSummary[]): MeetingSummary | null {
  const upcomingNeedingNotes = [...meetings]
    .filter((meeting) => !meeting.is_past && !meeting.has_minutes)
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );
  if (upcomingNeedingNotes[0]) {
    return upcomingNeedingNotes[0];
  }

  const upcoming = [...meetings]
    .filter((meeting) => !meeting.is_past)
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );
  if (upcoming[0]) {
    return upcoming[0];
  }

  const pastWithoutMinutes = [...meetings]
    .filter((meeting) => meeting.is_past && !meeting.has_minutes)
    .sort(
      (left, right) =>
        new Date(right.starts_at).getTime() - new Date(left.starts_at).getTime(),
    );
  return pastWithoutMinutes[0] ?? null;
}

/**
 * Compact board home card: jump into meeting minutes for the next relevant meeting.
 */
export function HomeMeetingMinutesCard() {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchMeetings()
      .then((response) => {
        if (!cancelled) {
          setMeetings(response.meetings);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMeetings([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const focus = useMemo(() => pickFocusMeeting(meetings), [meetings]);
  const needsNotes = focus != null && !focus.has_minutes;

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet home-meeting-minutes"
      aria-label="Meetings"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Meetings</h2>
        <ArrowLink to={MEETINGS_PATH}>View all</ArrowLink>
      </div>

      <div className="home-panel-body">
        {isLoading ? (
          <p className="home-activity-empty">Loading…</p>
        ) : null}

        {!isLoading && focus ? (
          <>
            <Link
              to={meetingPath(focus.event_id)}
              aria-label={`Open ${focus.event_name}`}
              className="home-meeting-focus-row"
            >
              <span className="home-meeting-focus-row__icon" aria-hidden>
                <AppIcon icon={NotebookPen} size="xs" className="text-current" />
              </span>
              <div className="home-meeting-focus-row__copy">
                <p className="home-meeting-focus-row__title">{focus.event_name}</p>
                <p className="home-meeting-focus-row__meta">
                  {formatMeetingWhen(focus.starts_at)}
                  {needsNotes
                    ? " · Notes needed"
                    : focus.has_summary
                      ? " · Summary ready"
                      : " · Minutes saved"}
                </p>
              </div>
              <AppIcon
                icon={ChevronRight}
                size="sm"
                className="home-meeting-focus-row__chev"
              />
            </Link>

            <Link
              to={meetingNotesPath(focus.event_id)}
              className="home-meeting-focus-cta"
            >
              {needsNotes
                ? "Write notes"
                : focus.has_summary
                  ? "View minutes"
                  : "Review & publish"}
            </Link>
          </>
        ) : null}

        {!isLoading && !focus ? (
          <p className="home-activity-empty">No board meetings to show</p>
        ) : null}
      </div>
    </HomeCard>
  );
}

export { pickFocusMeeting };
