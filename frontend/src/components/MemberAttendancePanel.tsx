import { formatEventDateTime } from "../lib/format-datetime";
import {
  attendanceTrendLabel,
  computeMemberAttendanceSummary,
  type MemberAttendanceRecord,
  type MemberAttendanceStatus,
  type MemberAttendanceSummary,
} from "../lib/member-attendance";

type MemberAttendancePanelProps = {
  records?: MemberAttendanceRecord[];
  summary?: MemberAttendanceSummary;
};

function statusLabel(status: MemberAttendanceStatus): string {
  switch (status) {
    case "attended":
      return "Attended";
    case "missed":
      return "Missed";
    case "excused":
      return "Excused";
  }
}

function AttendanceProgressRing({
  percent,
  attended,
  missed,
}: {
  percent: number;
  attended: number;
  missed: number;
}) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const total = attended + missed;

  return (
    <div
      className="member-attendance-ring"
      role="img"
      aria-label={
        total > 0
          ? `${attended} of ${total} counted events attended`
          : "No counted events yet"
      }
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="member-attendance-ring-svg"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="member-attendance-ring-track"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="member-attendance-ring-fill"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="member-attendance-ring-center">
        <span className="member-attendance-ring-value tabular-nums">
          {attended}
        </span>
        <span className="member-attendance-ring-sub">
          of {total || "—"}
        </span>
      </div>
    </div>
  );
}

export function MemberAttendancePanel({
  records = [],
  summary: summaryProp,
}: MemberAttendancePanelProps) {
  const summary =
    summaryProp ?? computeMemberAttendanceSummary(records);
  const hasHistory =
    summary.eventsAttended +
      summary.eventsMissed +
      summary.eventsExcused >
    0;

  if (!hasHistory) {
    return (
      <div className="member-attendance">
        <div className="member-attendance-overview member-attendance-overview--empty">
          <AttendanceProgressRing percent={0} attended={0} missed={0} />
          <div className="member-attendance-stats">
            <div className="member-attendance-stat">
              <span className="member-attendance-stat-label">
                Events attended
              </span>
              <span className="member-attendance-stat-value tabular-nums">
                0
              </span>
            </div>
            <div className="member-attendance-stat">
              <span className="member-attendance-stat-label">
                Events missed
              </span>
              <span className="member-attendance-stat-value tabular-nums">
                0
              </span>
            </div>
            <div className="member-attendance-stat">
              <span className="member-attendance-stat-label">
                Attendance trend
              </span>
              <span className="member-attendance-trend member-attendance-trend--insufficient">
                Not enough history
              </span>
            </div>
          </div>
        </div>
        <p className="member-profile-empty mt-3">
          Attendance history will appear after events and meetings are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="member-attendance">
      <div className="member-attendance-overview">
        <AttendanceProgressRing
          percent={summary.progressPercent}
          attended={summary.eventsAttended}
          missed={summary.eventsMissed}
        />

        <div className="member-attendance-stats">
          <div className="member-attendance-stat">
            <span className="member-attendance-stat-label">
              Events attended
            </span>
            <span className="member-attendance-stat-value tabular-nums">
              {summary.eventsAttended}
            </span>
          </div>
          <div className="member-attendance-stat">
            <span className="member-attendance-stat-label">Events missed</span>
            <span className="member-attendance-stat-value tabular-nums">
              {summary.eventsMissed}
            </span>
          </div>
          <div className="member-attendance-stat">
            <span className="member-attendance-stat-label">
              Attendance trend
            </span>
            <span
              className={`member-attendance-trend member-attendance-trend--${summary.trend}`}
            >
              {attendanceTrendLabel(summary.trend)}
            </span>
          </div>
        </div>
      </div>

      <div
        className="member-attendance-bar"
        role="progressbar"
        aria-valuenow={summary.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Attendance progress"
      >
        <div
          className="member-attendance-bar-fill"
          style={{ width: `${summary.progressPercent}%` }}
        />
      </div>
      <div className="member-attendance-bar-legend">
        <span>
          <span className="member-attendance-swatch member-attendance-swatch--attended" />
          Attended {summary.eventsAttended}
        </span>
        <span>
          <span className="member-attendance-swatch member-attendance-swatch--missed" />
          Missed {summary.eventsMissed}
        </span>
        {summary.eventsExcused > 0 ? (
          <span>
            <span className="member-attendance-swatch member-attendance-swatch--excused" />
            Excused {summary.eventsExcused}
          </span>
        ) : null}
      </div>

      <div className="member-attendance-recent">
        <p className="member-profile-eyebrow">Recent attendance</p>
        {summary.recent.length > 0 ? (
          <ul className="member-attendance-recent-list">
            {summary.recent.map((item) => (
              <li key={item.eventId} className="member-attendance-recent-item">
                <div className="min-w-0">
                  <p className="member-attendance-recent-name">
                    {item.eventName}
                  </p>
                  <p className="member-attendance-recent-date">
                    {formatEventDateTime(item.startsAt)}
                  </p>
                </div>
                <span
                  className={`member-attendance-status member-attendance-status--${item.status}`}
                >
                  {statusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="member-profile-empty mt-2">No recent records.</p>
        )}
      </div>
    </div>
  );
}
