import type { LucideIcon } from "lucide-react";
import {
  CheckSquare,
  ClipboardCheck,
  ListTodo,
  Megaphone,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import type { EventDetailResponse } from "../lib/events-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import {
  EVENT_MANAGE_CARD_CLASS,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_SECTION_CARD_CLASS,
} from "../lib/event-manage-ui";
import { formatCurrency } from "../lib/format-currency";
import { EventManageReadinessCard } from "./EventManageReadinessCard";
import { AppIcon } from "./ui/AppIcon";
import { HomeCard } from "./ui/HomeCard";
import type { computeEventReadiness } from "../lib/event-readiness";

export type EventManageTab =
  | "overview"
  | "details"
  | "people"
  | "ops"
  | "record";

type ResolveTarget = NonNullable<
  ReturnType<typeof computeEventReadiness>["resolveTarget"]
>;

type EventManageOverviewProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  volunteerCount: number | null;
  volunteerNeeded?: number | null;
  volunteersLoading: boolean;
  attendeeCount: number | null;
  attendeesLoading: boolean;
  checkInCount: number;
  invitedCount: number | null;
  openTaskCount: number;
  totalTaskCount: number;
  onResolve: (target: ResolveTarget) => void;
  onGoToTab: (tab: EventManageTab) => void;
  onOpenVolunteers: () => void;
  onOpenTasks: () => void;
  onOpenBudget: () => void;
  onOpenCheckIn: () => void;
  onOpenAttendance: () => void;
  onOpenInvites: () => void;
  onOpenCommunications: () => void;
};

function MetricTile({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${EVENT_MANAGE_CARD_CLASS} flex w-full flex-col rounded-2xl border border-gray-100 bg-surface-card p-4 text-left transition duration-150 hover:border-gray-200 hover:bg-gray-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={EVENT_MANAGE_EYEBROW}>{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
          <AppIcon icon={icon} size="sm" className="text-current" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{hint}</p>
    </button>
  );
}

export function EventManageOverview({
  event,
  budget,
  volunteerCount,
  volunteerNeeded = null,
  volunteersLoading,
  attendeeCount,
  attendeesLoading,
  checkInCount,
  invitedCount,
  openTaskCount,
  totalTaskCount,
  onResolve,
  onGoToTab,
  onOpenVolunteers,
  onOpenTasks,
  onOpenBudget,
  onOpenCheckIn,
  onOpenAttendance,
  onOpenInvites,
  onOpenCommunications,
}: EventManageOverviewProps) {
  const budgetValue = budget
    ? formatCurrency(budget.budget_remaining)
    : "—";
  const taskValue =
    totalTaskCount === 0 ? "0" : `${openTaskCount}/${totalTaskCount}`;

  return (
    <div className="space-y-5">
      <EventManageReadinessCard
        event={event}
        budget={budget}
        volunteerCount={volunteerCount}
        volunteerNeeded={volunteerNeeded}
        volunteersLoading={volunteersLoading}
        onResolve={onResolve}
        compact
      />

      <HomeCard
        padding="sm"
        className={EVENT_MANAGE_SECTION_CARD_CLASS}
        aria-label="Event snapshot"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="home-section-title">Event snapshot</h2>
            <p className="mt-1 text-xs text-gray-500">
              Jump into the area that needs attention.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoToTab("details")}
            className="text-sm font-medium text-primary transition hover:text-primary/80"
          >
            Edit details
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricTile
            icon={Users}
            label="Attending"
            value={
              attendeesLoading || attendeeCount === null
                ? "—"
                : event.capacity != null
                  ? `${attendeeCount}/${event.capacity}`
                  : String(attendeeCount)
            }
            hint={
              event.capacity != null ? "Going / capacity" : "Going RSVPs"
            }
            onClick={onOpenAttendance}
          />
          <MetricTile
            icon={UserPlus}
            label="Volunteers"
            value={
              volunteersLoading || volunteerCount === null
                ? "—"
                : String(volunteerCount)
            }
            hint="Signed up to help"
            onClick={onOpenVolunteers}
          />
          <MetricTile
            icon={openTaskCount > 0 ? ListTodo : CheckSquare}
            label="Open tasks"
            value={taskValue}
            hint={totalTaskCount === 0 ? "No tasks yet" : "Remaining / total"}
            onClick={onOpenTasks}
          />
          <MetricTile
            icon={Wallet}
            label="Budget left"
            value={budgetValue}
            hint={budget?.over_budget ? "Over budget" : "Remaining vs plan"}
            onClick={onOpenBudget}
          />
          <MetricTile
            icon={ClipboardCheck}
            label="Checked in"
            value={String(checkInCount)}
            hint="Door check-ins so far"
            onClick={onOpenCheckIn}
          />
          <MetricTile
            icon={Users}
            label="Invited"
            value={invitedCount === null ? "—" : String(invitedCount)}
            hint="Special participants"
            onClick={onOpenInvites}
          />
          <MetricTile
            icon={Megaphone}
            label="Share & announce"
            value="Ready"
            hint="Public link and member updates"
            onClick={onOpenCommunications}
          />
        </div>
      </HomeCard>
    </div>
  );
}
