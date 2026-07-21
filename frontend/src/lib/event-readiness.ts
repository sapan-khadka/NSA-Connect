import type { EventDetailResponse } from "./events-api";
import type { FinanceEventBudgetSummary } from "./finance-api";

export type ReadinessStatus = "pass" | "warn" | "fail" | "unknown";

export type ReadinessCheckId =
  | "cover"
  | "schedule"
  | "location"
  | "budget"
  | "rsvp"
  | "volunteers"
  | "capacity";

export type ReadinessCheck = {
  id: ReadinessCheckId;
  label: string;
  status: ReadinessStatus;
  /** Shown when this check is the top unresolved issue. */
  nextStep: string;
  /** Where Resolve Issues should navigate. */
  resolveTarget:
    | "cover"
    | "schedule"
    | "budget"
    | "volunteers"
    | "details";
};

export type EventReadinessResult = {
  scorePercent: number;
  checks: ReadinessCheck[];
  suggestedNextStep: string | null;
  resolveTarget: ReadinessCheck["resolveTarget"] | null;
  unresolvedCount: number;
};

export type EventReadinessInput = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  volunteerCount: number | null;
  volunteersLoading?: boolean;
};

function hasPositiveBudget(
  event: EventDetailResponse,
  budget: FinanceEventBudgetSummary | null,
): boolean {
  const planned = Number.parseFloat(budget?.planned_budget ?? event.budget);
  return Number.isFinite(planned) && planned > 0;
}

/**
 * Client-side readiness score from data already loaded on Event Manage.
 */
export function computeEventReadiness(
  input: EventReadinessInput,
): EventReadinessResult {
  const { event, budget, volunteerCount, volunteersLoading = false } = input;

  const coverPass = Boolean(event.event_photo_url?.trim());
  const schedulePass = Boolean(event.starts_at);
  const locationPass = Boolean(event.location?.trim());
  const budgetPass = hasPositiveBudget(event, budget);
  const rsvpPass = !event.is_past;
  const volunteersPass =
    volunteerCount !== null && !volunteersLoading ? volunteerCount > 0 : null;
  const capacityPass = event.capacity != null && event.capacity > 0;

  const checks: ReadinessCheck[] = [
    {
      id: "cover",
      label: coverPass ? "Cover Image" : "Cover Image Missing",
      status: coverPass ? "pass" : "fail",
      nextStep: "Upload a cover photo so the event feels complete.",
      resolveTarget: "cover",
    },
    {
      id: "schedule",
      label: "Date & Time",
      status: schedulePass ? "pass" : "fail",
      nextStep: "Confirm the event date and start time.",
      resolveTarget: "schedule",
    },
    {
      id: "location",
      label: locationPass ? "Location Set" : "Location Missing",
      status: locationPass ? "pass" : "warn",
      nextStep: "Add a venue so members know where to go.",
      resolveTarget: "details",
    },
    {
      id: "budget",
      label: budgetPass ? "Budget Assigned" : "Budget Not Assigned",
      status: budgetPass ? "pass" : "warn",
      nextStep: "Assign a planned budget for this event.",
      resolveTarget: "budget",
    },
    {
      id: "rsvp",
      label: rsvpPass ? "RSVP Enabled" : "RSVP Closed",
      status: rsvpPass ? "pass" : "warn",
      nextStep: "Review RSVP settings on the event page.",
      resolveTarget: "details",
    },
    {
      id: "volunteers",
      label:
        volunteersPass === null
          ? "Volunteers"
          : volunteersPass
            ? "Volunteers Ready"
            : "Volunteers Missing",
      status:
        volunteersPass === null ? "unknown" : volunteersPass ? "pass" : "warn",
      nextStep: "Add volunteer roles or invite helpers.",
      resolveTarget: "volunteers",
    },
    {
      id: "capacity",
      label: capacityPass ? "Capacity Set" : "Capacity Optional",
      status: capacityPass ? "pass" : "warn",
      nextStep: "Set a max attendance if the venue has a limit.",
      resolveTarget: "details",
    },
  ];

  const scored = checks.filter((check) => check.status !== "unknown");
  const earned = scored.reduce((sum, check) => {
    if (check.status === "pass") {
      return sum + 1;
    }
    if (check.status === "warn") {
      return sum + 0.35;
    }
    return sum;
  }, 0);
  const scorePercent =
    scored.length === 0 ? 0 : Math.round((earned / scored.length) * 100);

  const unresolved = checks.filter((check) => check.status !== "pass");
  const priority = unresolved.find(
    (check) => check.status === "fail" || check.status === "warn",
  );
  const top = priority ?? unresolved[0] ?? null;

  return {
    scorePercent,
    checks,
    suggestedNextStep: top?.nextStep ?? null,
    resolveTarget: top?.resolveTarget ?? null,
    unresolvedCount: unresolved.length,
  };
}
