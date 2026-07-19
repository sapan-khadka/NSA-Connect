import { NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchMeetings,
  type MeetingSummary,
} from "../../lib/meetings-api";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

const MINUTES_PATH = "/board/meeting-minutes";

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
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="Meeting Minutes"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="home-section-title">Meeting Minutes</h2>
        <ArrowLink to={MINUTES_PATH}>Open tool</ArrowLink>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/80" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/60" />
          </div>
        ) : null}

        {!isLoading && focus ? (
          <>
            <div className="flex items-start gap-2.5">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <AppIcon icon={NotebookPen} size="xs" className="text-current" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {focus.event_name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatMeetingWhen(focus.starts_at)}
                  {needsNotes
                    ? " · Notes needed"
                    : focus.has_summary
                      ? " · Summary ready"
                      : " · Minutes saved"}
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Link
                to={`/events/meetings/${focus.event_id}`}
                className="inline-flex rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white transition hover:bg-primary-hover"
              >
                {needsNotes ? "Add notes" : "Open meeting"}
              </Link>
              <Link
                to={MINUTES_PATH}
                className="inline-flex rounded-xl px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-surface-muted hover:text-foreground"
              >
                Summarize notes
              </Link>
            </div>
          </>
        ) : null}

        {!isLoading && !focus ? (
          <>
            <p className="text-sm text-gray-600">
              No board meetings lined up. Use the minutes tool anytime.
            </p>
            <Link
              to={MINUTES_PATH}
              className="mt-auto inline-flex w-fit rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white transition hover:bg-primary-hover"
            >
              Open minutes tool
            </Link>
          </>
        ) : null}
      </div>
    </HomeCard>
  );
}

export { pickFocusMeeting };
