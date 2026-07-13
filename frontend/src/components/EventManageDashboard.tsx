import { useEffect, useState, type ReactNode } from "react";

import { EventAttendanceSummaryPanel } from "./EventAttendanceSummaryPanel";
import { EventCheckInPanel } from "./EventCheckInPanel";
import { EventCoverPhotoSetting } from "./EventCoverPhotoSetting";
import { EventDeleteSection } from "./EventDeleteSection";
import { EventFeedbackSection } from "./EventFeedbackSection";
import { EventFinanceCloseoutBanner } from "./EventFinanceCloseoutBanner";
import { EventInvitedParticipantsSection } from "./EventInvitedParticipantsSection";
import {
  EventManageBudgetSummaryCard,
} from "./EventManageLogisticsSection";
import { EventManageScheduleFields } from "./EventManageScheduleFields";
import { EventTaskManager } from "./EventTaskManager";
import { EventVolunteersSection } from "./EventVolunteersSection";
import { FinanceEntryList } from "./FinanceEntryList";
import { MeetingRecordSection } from "./MeetingRecordSection";
import { ArrowAction } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";
import { Modal } from "./ui/Modal";
import type { MemberResponse } from "../lib/auth-api";
import { canCreateEventTasks } from "../lib/event-finance";
import {
  fetchEventCheckIns,
  type EventAttendanceSummary,
} from "../lib/event-checkin-api";
import { formatBudgetRemaining } from "../lib/event-budget";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import {
  fetchEventInvitedParticipants,
  fetchEventVolunteerSignups,
  type EventDetailResponse,
  type EventVolunteerSignupMember,
} from "../lib/events-api";
import type { EventTaskDraft } from "../lib/event-task-draft";
import type { EventTaskResponse } from "../lib/event-tasks-api";

type ManageModal =
  | "volunteers"
  | "tasks"
  | "transactions"
  | "checkin"
  | "attendance"
  | "invited"
  | "meeting"
  | "feedback"
  | null;

type EventManageDashboardProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  tasks: EventTaskResponse[];
  member: MemberResponse | null;
  canViewBoard: boolean;
  canViewTreasury: boolean;
  canManageTasks: boolean;
  assignableMembers: MemberResponse[];
  refreshKey: number;
  attendanceSummary: EventAttendanceSummary | null;
  taskDraft: EventTaskDraft | null;
  onUpdated: (event: EventDetailResponse) => void;
  onRefresh: () => void;
  onTaskDraftApplied: () => void;
  onConvertVolunteerToTask: (signup: EventVolunteerSignupMember) => void;
  openTasksModalToken?: number;
  openCheckInModalToken?: number;
};

function ManageCardShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="home-section-title">{title}</h2>
        {action}
      </div>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
    </HomeCard>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0">
      <dt className="text-xs font-normal text-gray-500">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function AttendanceStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-2.5 py-2">
      <p className="home-stat-value text-xl">{count}</p>
      <p className="mt-1 text-[11px] font-normal leading-snug text-gray-500">
        {label}
      </p>
    </div>
  );
}

export function EventManageDashboard({
  event,
  budget,
  tasks,
  member,
  canViewBoard,
  canViewTreasury,
  canManageTasks,
  assignableMembers,
  refreshKey,
  attendanceSummary,
  taskDraft,
  onUpdated,
  onRefresh,
  onTaskDraftApplied,
  onConvertVolunteerToTask,
  openTasksModalToken = 0,
  openCheckInModalToken = 0,
}: EventManageDashboardProps) {
  const [modal, setModal] = useState<ManageModal>(null);
  const [volunteers, setVolunteers] = useState<EventVolunteerSignupMember[]>(
    [],
  );
  const [volunteersLoading, setVolunteersLoading] = useState(true);
  const [checkInCount, setCheckInCount] = useState(0);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);

  const isMeetingEvent = event.event_type === "meeting";
  const incompleteTasks = tasks
    .filter((task) => task.status !== "done")
    .slice(0, 2);
  const completed = tasks.filter((task) => task.status === "done").length;
  const totalTasks = tasks.length;
  const taskPercent = totalTasks
    ? Math.round((completed / totalTasks) * 100)
    : 0;

  useEffect(() => {
    if (openTasksModalToken > 0) {
      setModal("tasks");
    }
  }, [openTasksModalToken]);

  useEffect(() => {
    if (openCheckInModalToken > 0) {
      setModal("checkin");
    }
  }, [openCheckInModalToken]);

  useEffect(() => {
    if (!canViewBoard) {
      setVolunteers([]);
      setVolunteersLoading(false);
      return;
    }

    let cancelled = false;
    setVolunteersLoading(true);

    void fetchEventVolunteerSignups(event.id)
      .then((response) => {
        if (!cancelled) {
          setVolunteers(response.signups);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVolunteers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setVolunteersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewBoard, event.id, refreshKey]);

  useEffect(() => {
    if (!canViewBoard) {
      setCheckInCount(0);
      return;
    }

    let cancelled = false;

    void fetchEventCheckIns(event.id)
      .then((response) => {
        if (!cancelled) {
          setCheckInCount(response.checkins.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckInCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewBoard, event.id, refreshKey, modal]);

  useEffect(() => {
    if (!canViewBoard) {
      setInvitedCount(null);
      return;
    }

    let cancelled = false;

    void fetchEventInvitedParticipants(event.id)
      .then((response) => {
        if (!cancelled) {
          setInvitedCount(response.invitations.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvitedCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewBoard, event.id, refreshKey]);

  function closeModal() {
    setModal(null);
    onRefresh();
  }

  if (!canViewBoard) {
    return (
      <p className="text-sm text-label">
        You do not have permission to manage this event.
      </p>
    );
  }

  const volunteerPreview = volunteers.slice(0, 2);
  const volunteerLabel =
    volunteers.length === 1
      ? "1 volunteer"
      : `${volunteers.length} volunteers`;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EventManageScheduleFields
          event={event}
          onUpdated={onUpdated}
          compact
        />

        <EventCoverPhotoSetting event={event} onUpdated={onUpdated} compact />

        <ManageCardShell
          title="Volunteers"
          action={
            volunteers.length > 0 ? (
              <ArrowAction onClick={() => setModal("volunteers")}>
                View all
              </ArrowAction>
            ) : undefined
          }
        >
          {volunteersLoading ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : volunteers.length === 0 ? (
            <p className="text-sm text-gray-600">No volunteer signups yet.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {volunteerLabel}
              </p>
              <ul className="mt-2 space-y-1">
                {volunteerPreview.map((signup) => (
                  <li
                    key={signup.id}
                    className="truncate text-sm text-gray-600"
                  >
                    {signup.full_name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ManageCardShell>

        <ManageCardShell
          title="Tasks"
          action={
            <ArrowAction onClick={() => setModal("tasks")}>
              View all tasks
            </ArrowAction>
          }
        >
          <p className="text-sm font-medium text-foreground">
            {completed}/{totalTasks} done · {taskPercent}%
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${taskPercent}%` }}
            />
          </div>
          {incompleteTasks.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {incompleteTasks.map((task) => (
                <li key={task.id} className="truncate text-sm text-gray-600">
                  {task.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              {totalTasks === 0 ? "No tasks yet." : "All tasks complete."}
            </p>
          )}
        </ManageCardShell>

        <ManageCardShell
          title="Budget"
          action={
            canViewTreasury ? (
              <ArrowAction onClick={() => setModal("transactions")}>
                View transactions
              </ArrowAction>
            ) : undefined
          }
        >
          {budget ? (
            <dl>
              <StatRow
                label="Planned"
                value={formatCurrency(budget.planned_budget)}
              />
              <StatRow
                label="Expenses"
                value={formatCurrency(budget.actual_expense)}
              />
              <StatRow
                label="Income"
                value={formatCurrency(budget.actual_income)}
              />
              <StatRow
                label="Remaining"
                value={formatBudgetRemaining(budget.budget_remaining)}
              />
            </dl>
          ) : (
            <p className="text-sm text-gray-600">Budget unavailable.</p>
          )}
        </ManageCardShell>

        <ManageCardShell
          title="Check-in"
          action={
            <ArrowAction onClick={() => setModal("checkin")}>
              View details
            </ArrowAction>
          }
        >
          <p className="home-stat-value text-2xl">{checkInCount}</p>
          <p className="mt-1 text-xs text-gray-500">checked in</p>
          <button
            type="button"
            onClick={() => setModal("checkin")}
            className="mt-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent"
          >
            Show check-in QR
          </button>
        </ManageCardShell>

        <ManageCardShell
          title="RSVP vs attendance"
          action={
            attendanceSummary ? (
              <ArrowAction onClick={() => setModal("attendance")}>
                View details
              </ArrowAction>
            ) : undefined
          }
        >
          {attendanceSummary ? (
            <div className="grid grid-cols-2 gap-2">
              <AttendanceStat
                label="Going & attended"
                count={attendanceSummary.going_attended.count}
              />
              <AttendanceStat
                label="Going, no show"
                count={attendanceSummary.going_no_show.count}
              />
              <AttendanceStat
                label="Walk-ins"
                count={attendanceSummary.walk_ins.count}
              />
              <AttendanceStat
                label="Not going"
                count={attendanceSummary.not_going.count}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Summary appears once check-in data is available.
            </p>
          )}
        </ManageCardShell>

        <ManageCardShell
          title="Invited participants"
          action={
            invitedCount && invitedCount > 0 ? (
              <ArrowAction onClick={() => setModal("invited")}>
                View all
              </ArrowAction>
            ) : undefined
          }
        >
          {invitedCount === null ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : invitedCount === 0 ? (
            <p className="text-sm text-gray-600">
              No invited participants yet.
            </p>
          ) : (
            <p className="text-sm font-medium text-foreground">
              {invitedCount} invited
            </p>
          )}
        </ManageCardShell>

        {isMeetingEvent ? (
          <ManageCardShell
            title="Meeting record"
            action={
              <ArrowAction onClick={() => setModal("meeting")}>
                View all
              </ArrowAction>
            }
          >
            <p className="text-sm text-gray-600">
              Minutes, attendance, and meeting tools.
            </p>
          </ManageCardShell>
        ) : null}

        {event.is_past ? (
          <ManageCardShell
            title="Feedback"
            action={
              <ArrowAction onClick={() => setModal("feedback")}>
                View all
              </ArrowAction>
            }
          >
            <p className="text-sm text-gray-600">
              Member feedback for this past event.
            </p>
          </ManageCardShell>
        ) : null}
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6">
        <EventDeleteSection
          eventId={event.id}
          eventName={event.name}
          dangerZone
        />
      </div>

      <Modal
        open={modal === "volunteers"}
        title="Volunteers"
        onClose={closeModal}
        size="lg"
      >
        <EventVolunteersSection
          eventId={event.id}
          eventName={event.name}
          refreshKey={refreshKey}
          canAssignTasks={canManageTasks && canCreateEventTasks(event)}
          onConvertToTask={(signup) => {
            onConvertVolunteerToTask(signup);
            setModal("tasks");
          }}
        />
      </Modal>

      <Modal
        open={modal === "tasks"}
        title="Tasks"
        onClose={closeModal}
        size="lg"
      >
        <EventTaskManager
          key={`${event.id}-${refreshKey}-modal`}
          eventId={event.id}
          eventName={event.name}
          member={member}
          canManageSimple={canManageTasks}
          canCreateTasks={canCreateEventTasks(event)}
          canAssignChecklist={canViewBoard}
          assignableMembers={assignableMembers}
          refreshKey={refreshKey}
          taskDraft={taskDraft}
          onTaskDraftApplied={onTaskDraftApplied}
        />
      </Modal>

      <Modal
        open={modal === "transactions"}
        title="Recent transactions"
        onClose={closeModal}
        size="xl"
      >
        <div className="space-y-4">
          <EventFinanceCloseoutBanner event={event} />
          {budget ? <EventManageBudgetSummaryCard budget={budget} /> : null}
          {canViewTreasury ? (
            <FinanceEntryList
              semester="all"
              refreshKey={refreshKey}
              eventId={event.id}
              canManage={!event.is_finance_locked}
              financeLocked={event.is_finance_locked}
              onChanged={onRefresh}
            />
          ) : null}
        </div>
      </Modal>

      <Modal
        open={modal === "checkin"}
        title="Check-in"
        onClose={closeModal}
        size="lg"
      >
        <EventCheckInPanel eventId={event.id} eventName={event.name} />
      </Modal>

      <Modal
        open={modal === "attendance"}
        title="RSVP vs attendance"
        onClose={closeModal}
        size="lg"
      >
        {attendanceSummary ? (
          <EventAttendanceSummaryPanel summary={attendanceSummary} />
        ) : null}
      </Modal>

      <Modal
        open={modal === "invited"}
        title="Invited participants"
        onClose={closeModal}
        size="lg"
      >
        <EventInvitedParticipantsSection
          eventId={event.id}
          refreshKey={refreshKey}
        />
      </Modal>

      <Modal
        open={modal === "meeting"}
        title="Meeting record"
        onClose={closeModal}
        size="xl"
      >
        <MeetingRecordSection eventId={event.id} eventName={event.name} />
      </Modal>

      <Modal
        open={modal === "feedback"}
        title="Event feedback"
        onClose={closeModal}
        size="lg"
      >
        <EventFeedbackSection
          eventId={event.id}
          eventName={event.name}
          refreshKey={refreshKey}
        />
      </Modal>
    </>
  );
}
