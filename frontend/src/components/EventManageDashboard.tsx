import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { EventAttendanceSummaryPanel } from "./EventAttendanceSummaryPanel";
import { EventCheckInPanel } from "./EventCheckInPanel";
import { EventDeleteSection } from "./EventDeleteSection";
import { EventFeedbackSection } from "./EventFeedbackSection";
import { EventFinanceCloseoutBanner } from "./EventFinanceCloseoutBanner";
import { EventInvitedParticipantsSection } from "./EventInvitedParticipantsSection";
import { EventManageActivityTimeline } from "./EventManageActivityTimeline";
import { EventManageBudgetCard } from "./EventManageBudgetCard";
import { EventManageCheckInCard } from "./EventManageCheckInCard";
import { EventManageCommunicationsCard } from "./EventManageCommunicationsCard";
import { EventManageDetailsCard } from "./EventManageDetailsCard";
import { EventManageReadinessCard } from "./EventManageReadinessCard";
import { EventManageRsvpAnalyticsCard } from "./EventManageRsvpAnalyticsCard";
import { EventManageVolunteersCard } from "./EventManageVolunteersCard";
import {
  EventManageBudgetSummaryCard,
} from "./EventManageLogisticsSection";
import { EventTaskManager } from "./EventTaskManager";
import { EventVolunteersSection } from "./EventVolunteersSection";
import { FinanceEntryList } from "./FinanceEntryList";
import { LogFinanceEntryForm } from "./LogFinanceEntryForm";
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
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import {
  fetchEventAttendees,
  fetchEventInvitedParticipants,
  fetchEventVolunteerSignups,
  type EventAttendeesResponse,
  type EventDetailResponse,
  type EventVolunteerSignupMember,
} from "../lib/events-api";
import type { EventTaskDraft } from "../lib/event-task-draft";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import { computeEventReadiness } from "../lib/event-readiness";
import {
  EVENT_MANAGE_ACTION_LINK,
  EVENT_MANAGE_CARD_CLASS,
  EVENT_MANAGE_EMPTY,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_LOADING,
  EVENT_MANAGE_SECONDARY_BTN,
} from "../lib/event-manage-ui";
import { financeBooksPath } from "../lib/finance-routes";

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
  /** One-shot open from calendar overview shortcuts (location state). */
  initialOpenModal?: ManageModal;
  /** Clears hero/external “open modal” tokens so Close cannot reopen them after refresh. */
  onDismissOpenTokens?: () => void;
};

function ManageCardShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <HomeCard padding="sm" className={EVENT_MANAGE_CARD_CLASS}>
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="home-section-title">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>
    </HomeCard>
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
  initialOpenModal = null,
  onDismissOpenTokens,
}: EventManageDashboardProps) {
  const [modal, setModal] = useState<ManageModal>(initialOpenModal);
  const consumedInitialModalRef = useRef(false);
  const [volunteers, setVolunteers] = useState<EventVolunteerSignupMember[]>(
    [],
  );
  const [volunteersLoading, setVolunteersLoading] = useState(true);
  const [checkInCount, setCheckInCount] = useState(0);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<EventAttendeesResponse | null>(
    null,
  );
  const [attendeesLoading, setAttendeesLoading] = useState(true);

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
    if (!initialOpenModal || consumedInitialModalRef.current) {
      return;
    }
    consumedInitialModalRef.current = true;
    setModal(initialOpenModal);
  }, [initialOpenModal]);

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

  useEffect(() => {
    if (!canViewBoard) {
      setAttendees(null);
      setAttendeesLoading(false);
      return;
    }

    let cancelled = false;
    setAttendeesLoading(true);

    void fetchEventAttendees(event.id)
      .then((response) => {
        if (!cancelled) {
          setAttendees(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAttendees(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAttendeesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewBoard, event.id, refreshKey]);

  function closeModal() {
    setModal(null);
    onDismissOpenTokens?.();
    onRefresh();
  }

  function handleResolveReadiness(
    target: NonNullable<
      ReturnType<typeof computeEventReadiness>["resolveTarget"]
    >,
  ) {
    if (target === "volunteers") {
      setModal("volunteers");
      return;
    }
    if (target === "budget") {
      if (canViewTreasury) {
        setModal("transactions");
      } else {
        document
          .getElementById("event-manage-budget")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (target === "schedule") {
      document
        .getElementById("event-manage-schedule")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      const dateInput = document.getElementById("manage-event-date");
      if (dateInput instanceof HTMLElement) {
        window.setTimeout(() => dateInput.focus(), 280);
      }
      return;
    }
    // cover + details → Event Details card / cover controls
    document
      .querySelector('[aria-label="Event Details"]')
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!canViewBoard) {
    return (
      <p className={EVENT_MANAGE_LOADING}>
        You do not have permission to manage this event.
      </p>
    );
  }

  return (
    <>
      <EventManageDetailsCard event={event} onUpdated={onUpdated} />

      <div className="mt-5">
        <EventManageReadinessCard
          event={event}
          budget={budget}
          volunteerCount={volunteersLoading ? null : volunteers.length}
          volunteersLoading={volunteersLoading}
          onResolve={handleResolveReadiness}
        />
      </div>

      <div className="event-manage-grid mt-5 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EventManageVolunteersCard
          volunteers={volunteers}
          isLoading={volunteersLoading}
          onInvite={() => setModal("volunteers")}
          onAssignRoles={() => setModal("tasks")}
          onViewAll={() => setModal("volunteers")}
        />

        <ManageCardShell
          title="Tasks"
          subtitle="Open work for this event"
          action={
            totalTasks > 0 ? (
              <ArrowAction onClick={() => setModal("tasks")}>
                View all
              </ArrowAction>
            ) : undefined
          }
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={EVENT_MANAGE_EYEBROW}>Completion</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {taskPercent}%
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {completed}/{totalTasks} done
              </p>
            </div>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-accent transition-all duration-200 ease-out"
              style={{ width: `${taskPercent}%` }}
            />
          </div>

          {totalTasks === 0 ? (
            <div className={`mt-4 flex flex-1 flex-col ${EVENT_MANAGE_EMPTY}`}>
              <p className="text-sm font-medium text-foreground">No tasks yet</p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Break the event into clear owner-ready tasks so nothing slips
                before doors open.
              </p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => setModal("tasks")}
                  className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
                >
                  Add first task
                </button>
              </div>
            </div>
          ) : incompleteTasks.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {incompleteTasks.map((task) => (
                <li
                  key={task.id}
                  className="truncate rounded-lg border border-gray-100 bg-white px-2.5 py-2 text-sm text-gray-700"
                >
                  {task.title}
                </li>
              ))}
            </ul>
          ) : (
            <div className={`mt-4 ${EVENT_MANAGE_EMPTY}`}>
              <p className="text-sm font-medium text-foreground">
                All tasks complete
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Nice work — nothing left on the board.
              </p>
            </div>
          )}

          {totalTasks > 0 ? (
            <div className="mt-auto pt-4">
              <button
                type="button"
                onClick={() => setModal("tasks")}
                className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
              >
                Manage tasks
              </button>
            </div>
          ) : null}
        </ManageCardShell>

        <EventManageBudgetCard
          budget={budget}
          canViewTreasury={canViewTreasury}
          onViewTransactions={() => setModal("transactions")}
        />

        <EventManageCheckInCard
          eventId={event.id}
          checkedInCount={checkInCount}
          capacity={attendees?.going_count ?? null}
          onOpenCheckIn={() => setModal("checkin")}
        />

        <EventManageRsvpAnalyticsCard
          attendees={attendees}
          attendeesLoading={attendeesLoading}
          attendanceSummary={attendanceSummary}
          onViewDetails={
            attendanceSummary
              ? () => setModal("attendance")
              : undefined
          }
        />

        <ManageCardShell
          title="Invited participants"
          subtitle="Guest list outside RSVP"
          action={
            invitedCount && invitedCount > 0 ? (
              <button
                type="button"
                onClick={() => setModal("invited")}
                className={EVENT_MANAGE_ACTION_LINK}
              >
                View all
              </button>
            ) : undefined
          }
        >
          {invitedCount === null ? (
            <p className={EVENT_MANAGE_LOADING}>Loading invites…</p>
          ) : invitedCount === 0 ? (
            <div className={`flex flex-1 flex-col ${EVENT_MANAGE_EMPTY}`}>
              <p className="text-sm font-medium text-foreground">
                No invited participants yet
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                External guests and special invites will show here when added.
              </p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => setModal("invited")}
                  className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
                >
                  Open invites
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <p className={EVENT_MANAGE_EYEBROW}>Invited</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {invitedCount}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {invitedCount === 1 ? "1 person invited" : `${invitedCount} people invited`}
              </p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => setModal("invited")}
                  className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
                >
                  View invites
                </button>
              </div>
            </div>
          )}
        </ManageCardShell>

        {isMeetingEvent ? (
          <ManageCardShell
            title="Meeting record"
            subtitle="Minutes and attendance"
            action={
              <button
                type="button"
                onClick={() => setModal("meeting")}
                className={EVENT_MANAGE_ACTION_LINK}
              >
                Open
              </button>
            }
          >
            <div className={`flex flex-1 flex-col ${EVENT_MANAGE_EMPTY}`}>
              <p className="text-sm font-medium text-foreground">
                Meeting tools
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Capture minutes, attendance, and follow-ups for this meeting.
              </p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => setModal("meeting")}
                  className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
                >
                  Open meeting record
                </button>
              </div>
            </div>
          </ManageCardShell>
        ) : null}

        {event.is_past ? (
          <ManageCardShell
            title="Feedback"
            subtitle="Post-event responses"
            action={
              <button
                type="button"
                onClick={() => setModal("feedback")}
                className={EVENT_MANAGE_ACTION_LINK}
              >
                Open
              </button>
            }
          >
            <div className={`flex flex-1 flex-col ${EVENT_MANAGE_EMPTY}`}>
              <p className="text-sm font-medium text-foreground">
                Member feedback
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Review ratings and comments collected after this event.
              </p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => setModal("feedback")}
                  className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
                >
                  View feedback
                </button>
              </div>
            </div>
          </ManageCardShell>
        ) : null}
      </div>

      <div className="mt-5">
        <EventManageCommunicationsCard eventName={event.name} />
      </div>

      <div className="mt-5">
        <EventManageActivityTimeline
          event={event}
          volunteerCount={volunteers.length}
          hasBudget={Boolean(
            budget && Number.parseFloat(budget.planned_budget) > 0,
          )}
        />
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6">
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
            <>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Link
                  to={financeBooksPath(event.id)}
                  className={EVENT_MANAGE_ACTION_LINK}
                >
                  Open in Books
                </Link>
              </div>
              {!event.is_finance_locked ? (
                <LogFinanceEntryForm
                  eventOptions={[{ id: event.id, name: event.name }]}
                  lockedEventId={event.id}
                  lockedEventName={event.name}
                  idPrefix={`event-${event.id}-finance`}
                  onCreated={() => onRefresh()}
                />
              ) : null}
              <FinanceEntryList
                semester="all"
                refreshKey={refreshKey}
                eventId={event.id}
                canManage={!event.is_finance_locked}
                financeLocked={event.is_finance_locked}
                onChanged={onRefresh}
              />
            </>
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
