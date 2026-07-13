import type { EventAttendanceSummary } from "../lib/event-checkin-api";
import {
  EVENT_MANAGE_ACTION_LINK,
  EVENT_MANAGE_CARD_CLASS,
  EVENT_MANAGE_EMPTY,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_LOADING,
} from "../lib/event-manage-ui";
import type { EventAttendeesResponse } from "../lib/events-api";
import {
  computeRsvpAnalytics,
  rsvpDonutSegments,
  type RsvpAnalyticsSnapshot,
} from "../lib/event-rsvp-analytics";
import { HomeCard } from "./ui/HomeCard";

type EventManageRsvpAnalyticsCardProps = {
  attendees: EventAttendeesResponse | null;
  attendeesLoading: boolean;
  attendanceSummary: EventAttendanceSummary | null;
  onViewDetails?: () => void;
};

function InsightStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
      <p className={EVENT_MANAGE_EYEBROW}>{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

function ProgressRow({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-gray-600">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-200 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RsvpDonut({ snapshot }: { snapshot: RsvpAnalyticsSnapshot }) {
  const segments = rsvpDonutSegments(snapshot);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const size = 112;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs =
    total === 0
      ? null
      : segments.map((segment) => {
          const length = (segment.value / total) * circumference;
          const arc = {
            ...segment,
            dash: length,
            gap: circumference - length,
            offset,
          };
          offset += length;
          return arc;
        });

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="RSVP mix donut"
        className="shrink-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={stroke}
        />
        {arcs
          ? arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={stroke}
                strokeDasharray={`${arc.dash} ${arc.gap}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            ))
          : null}
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize="18"
          fontWeight="600"
        >
          {total}
        </text>
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          fill="#9CA3AF"
          fontSize="9"
          fontWeight="500"
        >
          RSVPs
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              {segment.label}
            </span>
            <span className="tabular-nums text-gray-600">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EventManageRsvpAnalyticsCard({
  attendees,
  attendeesLoading,
  attendanceSummary,
  onViewDetails,
}: EventManageRsvpAnalyticsCardProps) {
  const snapshot = computeRsvpAnalytics(attendees, attendanceSummary);

  return (
    <HomeCard
      padding="sm"
      className={EVENT_MANAGE_CARD_CLASS}
      aria-label="RSVP Analytics"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <h2 className="home-section-title">RSVP Analytics</h2>
          <p className="mt-1 text-xs text-gray-500">
            Response mix and expected turnout
          </p>
        </div>
        {attendanceSummary && onViewDetails ? (
          <button
            type="button"
            onClick={onViewDetails}
            className={EVENT_MANAGE_ACTION_LINK}
          >
            View details
          </button>
        ) : null}
      </div>

      {attendeesLoading ? (
        <p className={`mt-4 ${EVENT_MANAGE_LOADING}`}>Loading RSVP insights…</p>
      ) : !snapshot ? (
        <div className={`mt-4 flex flex-1 flex-col ${EVENT_MANAGE_EMPTY}`}>
          <p className="text-sm font-medium text-foreground">
            No RSVP data yet
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            Insights appear once members start responding.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-5">
          <RsvpDonut snapshot={snapshot} />

          <div className="space-y-2.5">
            <ProgressRow
              label="Going"
              value={snapshot.going}
              max={Math.max(snapshot.totalResponded, 1)}
              colorClass="bg-teal-700"
            />
            <ProgressRow
              label="Maybe"
              value={snapshot.maybe}
              max={Math.max(snapshot.totalResponded, 1)}
              colorClass="bg-amber-500"
            />
            <ProgressRow
              label="Declined"
              value={snapshot.declined}
              max={Math.max(snapshot.totalResponded, 1)}
              colorClass="bg-gray-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <InsightStat
              label="Attendance Prediction"
              value={String(snapshot.attendancePrediction)}
              hint="Going + half of Maybe"
            />
            <InsightStat
              label="No-show Rate"
              value={
                snapshot.noShowRatePercent === null
                  ? "—"
                  : `${snapshot.noShowRatePercent}%`
              }
              hint={
                snapshot.noShowRatePercent === null
                  ? "After check-in opens"
                  : "Among Going RSVPs"
              }
            />
            <InsightStat
              label="Capacity Filled"
              value={
                snapshot.capacityFilledPercent === null
                  ? "—"
                  : `${snapshot.capacityFilledPercent}%`
              }
              hint="Going among responses"
            />
          </div>
        </div>
      )}
    </HomeCard>
  );
}
