import {
  computeEventReadiness,
  type ReadinessCheck,
  type ReadinessStatus,
} from "../lib/event-readiness";
import {
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_PRIMARY_BTN,
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECTION_SUBTITLE,
  EVENT_MANAGE_SECTION_TITLE,
} from "../lib/event-manage-ui";
import type { EventDetailResponse } from "../lib/events-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { HomeCard } from "./ui/HomeCard";

type ResolveTarget = NonNullable<
  ReturnType<typeof computeEventReadiness>["resolveTarget"]
>;

type EventManageReadinessCardProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  volunteerCount: number | null;
  volunteersLoading?: boolean;
  onResolve: (target: ResolveTarget) => void;
};

function scoreTone(scorePercent: number): {
  bar: string;
  text: string;
  label: string;
} {
  if (scorePercent >= 80) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-700",
      label: "Ready",
    };
  }
  if (scorePercent >= 50) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-800",
      label: "Needs attention",
    };
  }
  return {
    bar: "bg-red-500",
    text: "text-red-700",
    label: "Not ready",
  };
}

function statusVisual(status: ReadinessStatus): {
  rowClass: string;
  iconClass: string;
  mark: string;
} {
  if (status === "pass") {
    return {
      rowClass: "text-emerald-800",
      iconClass: "bg-emerald-50 text-emerald-600",
      mark: "✓",
    };
  }
  if (status === "warn") {
    return {
      rowClass: "text-amber-900",
      iconClass: "bg-amber-50 text-amber-600",
      mark: "⚠",
    };
  }
  if (status === "fail") {
    return {
      rowClass: "text-red-800",
      iconClass: "bg-red-50 text-red-600",
      mark: "✗",
    };
  }
  return {
    rowClass: "text-gray-600",
    iconClass: "bg-gray-100 text-gray-500",
    mark: "?",
  };
}

function ReadinessCheckRow({ check }: { check: ReadinessCheck }) {
  const visual = statusVisual(check.status);

  return (
    <li className={`flex items-center gap-2.5 text-sm ${visual.rowClass}`}>
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${visual.iconClass}`}
        aria-hidden="true"
      >
        {visual.mark}
      </span>
      <span className="min-w-0 font-medium leading-snug">{check.label}</span>
      <span className="sr-only">
        {check.status === "pass"
          ? "Complete"
          : check.status === "warn"
            ? "Needs attention"
            : check.status === "fail"
              ? "Missing"
              : "Unknown"}
      </span>
    </li>
  );
}

export function EventManageReadinessCard({
  event,
  budget,
  volunteerCount,
  volunteersLoading = false,
  onResolve,
}: EventManageReadinessCardProps) {
  const readiness = computeEventReadiness({
    event,
    budget,
    volunteerCount,
    volunteersLoading,
  });
  const tone = scoreTone(readiness.scorePercent);
  const canResolve = readiness.resolveTarget !== null;

  return (
    <HomeCard
      padding="md"
      className={EVENT_MANAGE_SECTION_CARD_CLASS}
      aria-label="Event Readiness"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={EVENT_MANAGE_SECTION_TITLE}>Event Readiness</h2>
          <p className={EVENT_MANAGE_SECTION_SUBTITLE}>
            How prepared this event is to go live.
          </p>
        </div>
        <span className={`text-xs font-medium ${tone.text}`}>{tone.label}</span>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <p className={EVENT_MANAGE_EYEBROW}>Overall readiness</p>
          <p
            className={`text-3xl font-semibold tabular-nums tracking-tight ${tone.text}`}
            aria-live="polite"
          >
            {readiness.scorePercent}%
          </p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={readiness.scorePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall readiness score"
        >
          <div
            className={`h-full rounded-full transition-all duration-200 ease-out ${tone.bar}`}
            style={{ width: `${readiness.scorePercent}%` }}
          />
        </div>
      </div>

      <ul className="mt-6 space-y-2.5" aria-label="Readiness checklist">
        {readiness.checks.map((check) => (
          <ReadinessCheckRow key={check.id} check={check} />
        ))}
      </ul>

      <div className="mt-6 border-t border-gray-100 pt-5">
        <p className={EVENT_MANAGE_EYEBROW}>Suggested next step</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {readiness.suggestedNextStep ??
            "You're clear — no open readiness issues."}
        </p>
        <button
          type="button"
          disabled={!canResolve}
          onClick={() => {
            if (readiness.resolveTarget) {
              onResolve(readiness.resolveTarget);
            }
          }}
          className={`mt-4 ${EVENT_MANAGE_PRIMARY_BTN}`}
        >
          Resolve Issues
        </button>
      </div>
    </HomeCard>
  );
}
