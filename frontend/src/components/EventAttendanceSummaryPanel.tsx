import type { EventAttendanceSummary } from "../lib/event-checkin-api";
import { formatEventDateTime } from "../lib/format-datetime";

type EventAttendanceSummaryPanelProps = {
  summary: EventAttendanceSummary;
};

function CategoryBlock({
  title,
  description,
  category,
}: {
  title: string;
  description: string;
  category: EventAttendanceSummary["going_attended"];
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-surface-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
          {category.count}
        </span>
      </div>
      <p className="mt-1 text-xs text-label">{description}</p>
      {category.members.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {category.members.map((member) => (
            <li
              key={member.member_id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-foreground">{member.full_name}</span>
              {member.checked_in_at ? (
                <span className="text-xs text-label">
                  {formatEventDateTime(member.checked_in_at)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-label">None</p>
      )}
    </section>
  );
}

export function EventAttendanceSummaryPanel({
  summary,
}: EventAttendanceSummaryPanelProps) {
  return (
    <section className="ds-card p-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">
          RSVP vs attendance
        </h2>
        <p className="mt-1 text-sm text-label">
          Compare who RSVP&apos;d with who actually checked in for {summary.event_name}.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CategoryBlock
          title="Going & attended"
          description="RSVP'd Going and checked in."
          category={summary.going_attended}
        />
        <CategoryBlock
          title="Going but did not attend"
          description="RSVP'd Going but no check-in recorded."
          category={summary.going_no_show}
        />
        <CategoryBlock
          title="Walk-ins"
          description="Checked in without an RSVP of Going."
          category={summary.walk_ins}
        />
        <CategoryBlock
          title="Not going"
          description="RSVP'd Not going (baseline)."
          category={summary.not_going}
        />
      </div>

      <p className="mt-6 rounded-lg border border-gray-200 bg-surface-card px-4 py-3 text-sm text-foreground">
        <span className="font-medium">{summary.guests_checked_in.count}</span>{" "}
        guest{summary.guests_checked_in.count === 1 ? "" : "s"} checked in
        <span className="text-label">
          {" "}
          (non-members; not included in RSVP categories above)
        </span>
      </p>
    </section>
  );
}
