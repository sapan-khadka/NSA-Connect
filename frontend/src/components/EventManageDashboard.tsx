import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { EventAttendanceSummaryPanel } from "./EventAttendanceSummaryPanel";
import { EventCheckInPanel } from "./EventCheckInPanel";
import { EventFeedbackSection } from "./EventFeedbackSection";
import { EventFinanceCloseoutBanner } from "./EventFinanceCloseoutBanner";
import { EventInvitedParticipantsSection } from "./EventInvitedParticipantsSection";
import { EventManageAttendeesWorkspace } from "./EventManageAttendeesWorkspace";
import { EventManageBudgetCard } from "./EventManageBudgetCard";
import { EventManageDetailsCard } from "./EventManageDetailsCard";
import {
  EventManageOverview,
  type EventManageTab,
} from "./EventManageOverview";
import { EventManageRecordWorkspace } from "./EventManageRecordWorkspace";
import { EventManageVolunteersCard } from "./EventManageVolunteersCard";
import { EventManageBudgetSummaryCard } from "./EventManageLogisticsSection";
import { EventTaskManager } from "./EventTaskManager";
import { EventVolunteersSection } from "./EventVolunteersSection";
import { FinanceEntryList } from "./FinanceEntryList";
import { InviteMembersToEventModal } from "./InviteMembersToEventModal";
import { LogFinanceEntryForm } from "./LogFinanceEntryForm";
import { MeetingRecordSection } from "./MeetingRecordSection";
import { ArrowAction } from "./ui/ArrowLink";
import { Modal } from "./ui/Modal";
import { Drawer } from "../design-system/components/feedback/Drawer";
import type { MemberResponse } from "../lib/auth-api";
import { canCreateEventTasks } from "../lib/event-finance";
import {
  fetchEventCheckIns,
  type EventAttendanceSummary,
  type EventCheckInRecord,
} from "../lib/event-checkin-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import {
  fetchEventAttendees,
  fetchEventInvitedParticipants,
  fetchEventVolunteerSignups,
  fetchEventVolunteerSlots,
  type EventAttendeesResponse,
  type EventDetailResponse,
  type EventParticipantInvitation,
  type EventVolunteerSignupMember,
} from "../lib/events-api";
import { summarizeVolunteerSlots } from "../lib/event-volunteer-summary";
import type { EventTaskDraft } from "../lib/event-task-draft";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import {
  parseManageTab,
  shouldOpenEventEditor,
  type AttentionAction,
} from "../lib/event-manage-command";
import {
  EVENT_MANAGE_ACTION_LINK,
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

export type { EventManageTab };

export type EventManageMetrics = {
  attendeeCount: number | null;
  volunteerCount: number | null;
};

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
  onMetricsChange?: (metrics: EventManageMetrics) => void;
  openTasksModalToken?: number;
  openCheckInModalToken?: number;
  editDetailsToken?: number;
  /** One-shot open from calendar overview shortcuts (location state). */
  initialOpenModal?: ManageModal;
  /** Clears hero/external “open modal” tokens so Close cannot reopen them after refresh. */
  onDismissOpenTokens?: () => void;
};

const TABS: { id: EventManageTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "attendees", label: "Attendees" },
  { id: "operations", label: "Operations" },
  { id: "record", label: "Record" },
];

const MANAGE_MODAL_IDS = new Set<Exclude<ManageModal, null>>([
  "volunteers",
  "tasks",
  "transactions",
  "checkin",
  "attendance",
  "invited",
  "meeting",
  "feedback",
]);

function parseManageModal(value: string | null): ManageModal {
  if (value && MANAGE_MODAL_IDS.has(value as Exclude<ManageModal, null>)) {
    return value as Exclude<ManageModal, null>;
  }
  return null;
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
  onMetricsChange,
  openTasksModalToken = 0,
  openCheckInModalToken = 0,
  editDetailsToken = 0,
  initialOpenModal = null,
  onDismissOpenTokens,
}: EventManageDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = parseManageTab(searchParams.get("tab"));
  const modalFromUrl = parseManageModal(searchParams.get("modal"));
  const [activeTab, setActiveTab] = useState<EventManageTab>(initialTab);
  const [editorOpen, setEditorOpen] = useState(
    shouldOpenEventEditor(searchParams.get("tab"), searchParams.get("edit")),
  );
  const [modal, setModal] = useState<ManageModal>(
    initialOpenModal ?? modalFromUrl,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addRoleToken, setAddRoleToken] = useState(0);
  const consumedInitialModalRef = useRef(false);
  const [volunteers, setVolunteers] = useState<EventVolunteerSignupMember[]>(
    [],
  );
  const [volunteersLoading, setVolunteersLoading] = useState(true);
  const [volunteerFilled, setVolunteerFilled] = useState<number | null>(null);
  const [volunteerNeeded, setVolunteerNeeded] = useState<number | null>(null);
  const [checkIns, setCheckIns] = useState<EventCheckInRecord[]>([]);
  const [invitations, setInvitations] = useState<EventParticipantInvitation[]>(
    [],
  );
  const [invitedMemberIds, setInvitedMemberIds] = useState<number[]>([]);
  const [attendees, setAttendees] = useState<EventAttendeesResponse | null>(
    null,
  );
  const [attendeesLoading, setAttendeesLoading] = useState(true);

  const incompleteTasks = tasks
    .filter((task) => task.status !== "done")
    .slice(0, 2);
  const completed = tasks.filter((task) => task.status === "done").length;
  const totalTasks = tasks.length;

  function selectTab(tab: EventManageTab) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    setSearchParams(next, { replace: true });
  }

  function closeEditor() {
    setEditorOpen(false);
    onDismissOpenTokens?.();
    if (searchParams.has("edit") || searchParams.get("tab") === "details") {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      if (next.get("tab") === "details") {
        next.delete("tab");
      }
      setSearchParams(next, { replace: true });
    }
  }

  useEffect(() => {
    const fromUrl = parseManageTab(searchParams.get("tab"));
    if (fromUrl !== activeTab) {
      setActiveTab(fromUrl);
    }
    // Sync when the URL changes externally (back/forward / deep link).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional URL-driven sync
  }, [searchParams]);

  useEffect(() => {
    if (openTasksModalToken > 0) {
      selectTab("operations");
      setModal("tasks");
    }
  }, [openTasksModalToken]);

  useEffect(() => {
    if (openCheckInModalToken > 0) {
      setModal("checkin");
    }
  }, [openCheckInModalToken]);

  useEffect(() => {
    if (editDetailsToken > 0) {
      setEditorOpen(true);
    }
  }, [editDetailsToken]);

  useEffect(() => {
    if (!initialOpenModal || consumedInitialModalRef.current) {
      return;
    }
    consumedInitialModalRef.current = true;
    if (
      initialOpenModal === "volunteers" ||
      initialOpenModal === "checkin" ||
      initialOpenModal === "attendance" ||
      initialOpenModal === "invited"
    ) {
      selectTab("attendees");
    } else if (
      initialOpenModal === "tasks" ||
      initialOpenModal === "transactions"
    ) {
      selectTab("operations");
    } else if (
      initialOpenModal === "meeting" ||
      initialOpenModal === "feedback"
    ) {
      selectTab("record");
    }
    setModal(initialOpenModal);
  }, [initialOpenModal]);

  useEffect(() => {
    if (!modalFromUrl || consumedInitialModalRef.current) {
      return;
    }
    consumedInitialModalRef.current = true;
    if (
      modalFromUrl === "volunteers" ||
      modalFromUrl === "checkin" ||
      modalFromUrl === "attendance" ||
      modalFromUrl === "invited"
    ) {
      selectTab("attendees");
    } else if (
      modalFromUrl === "tasks" ||
      modalFromUrl === "transactions"
    ) {
      selectTab("operations");
    } else if (
      modalFromUrl === "meeting" ||
      modalFromUrl === "feedback"
    ) {
      selectTab("record");
    }
    setModal(modalFromUrl);
  }, [modalFromUrl]);

  useEffect(() => {
    if (!canViewBoard) {
      setVolunteers([]);
      setVolunteersLoading(false);
      setVolunteerFilled(null);
      setVolunteerNeeded(null);
      return;
    }

    let cancelled = false;
    setVolunteersLoading(true);

    void Promise.all([
      fetchEventVolunteerSignups(event.id),
      fetchEventVolunteerSlots(event.id),
    ])
      .then(([signupsResponse, slotsResponse]) => {
        if (cancelled) {
          return;
        }
        setVolunteers(signupsResponse.signups);
        const totals = summarizeVolunteerSlots(slotsResponse.slots);
        setVolunteerFilled(totals.filled);
        setVolunteerNeeded(totals.hasTarget ? totals.needed : 0);
      })
      .catch(() => {
        if (!cancelled) {
          setVolunteers([]);
          setVolunteerFilled(0);
          setVolunteerNeeded(0);
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
      setCheckIns([]);
      return;
    }

    let cancelled = false;

    void fetchEventCheckIns(event.id)
      .then((response) => {
        if (!cancelled) {
          setCheckIns(response.checkins);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckIns([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewBoard, event.id, refreshKey, modal]);

  useEffect(() => {
    if (!canViewBoard) {
      setInvitations([]);
      setInvitedMemberIds([]);
      return;
    }

    let cancelled = false;

    void fetchEventInvitedParticipants(event.id)
      .then((response) => {
        if (!cancelled) {
          setInvitations(response.invitations);
          setInvitedMemberIds(
            response.invitations.map((invitation) => invitation.member_id),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvitations([]);
          setInvitedMemberIds([]);
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

  useEffect(() => {
    onMetricsChange?.({
      attendeeCount: attendeesLoading ? null : (attendees?.going_count ?? null),
      volunteerCount: volunteersLoading ? null : (volunteerFilled ?? 0),
    });
  }, [
    attendees?.going_count,
    attendeesLoading,
    onMetricsChange,
    volunteerFilled,
    volunteersLoading,
  ]);

  function closeModal() {
    setModal(null);
    onDismissOpenTokens?.();
    if (searchParams.has("modal")) {
      const next = new URLSearchParams(searchParams);
      next.delete("modal");
      setSearchParams(next, { replace: true });
    }
  }

  function handleAttentionAction(action: AttentionAction) {
    if (action === "volunteers") {
      selectTab("operations");
      setAddRoleToken((current) => current + 1);
      return;
    }
    if (action === "budget") {
      selectTab("operations");
      return;
    }
    if (action === "tasks") {
      selectTab("operations");
      setModal("tasks");
      return;
    }
    setEditorOpen(true);
  }

  const checkInCount = checkIns.length;
  const openTasks = tasks.filter((task) => task.status !== "done");

  if (!canViewBoard) {
    return (
      <p className={EVENT_MANAGE_LOADING}>
        You do not have permission to manage this event.
      </p>
    );
  }

  const tasksCard = (
    <section aria-label="Tasks">
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Tasks</h2>
        <p className="event-command-count">
          {totalTasks === 0 ? "None" : `${completed}/${totalTasks} done`}
        </p>
      </div>
      {totalTasks === 0 ? (
        <p className="event-command-stat">No tasks yet.</p>
      ) : incompleteTasks.length > 0 ? (
        <ul className="event-attention-list">
          {incompleteTasks.map((task) => (
            <li key={task.id} className="event-attention-item is-open">
              <span className="event-attention-mark" aria-hidden="true" />
              <span className="event-attention-label">{task.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="event-command-stat">All tasks complete.</p>
      )}
      <div className="mt-2.5">
        <ArrowAction onClick={() => setModal("tasks")}>
          {totalTasks === 0 ? "Add first task" : "Manage tasks"}
        </ArrowAction>
      </div>
    </section>
  );

  return (
    <>
      <div
        role="tablist"
        aria-label="Manage event sections"
        className="event-command-tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "is-active" : undefined}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="event-command-body">
          <EventManageOverview
            event={event}
            budget={budget}
            volunteerCount={volunteersLoading ? null : (volunteerFilled ?? 0)}
            volunteerNeeded={volunteersLoading ? null : (volunteerNeeded ?? 0)}
            volunteersLoading={volunteersLoading}
            openTasks={openTasks}
            onAttentionAction={handleAttentionAction}
          />
        </div>
      ) : null}

      {activeTab === "attendees" ? (
        <div className="event-command-body">
          <EventManageAttendeesWorkspace
            eventName={event.name}
            eventCapacity={event.capacity}
            attendees={attendees}
            attendeesLoading={attendeesLoading}
            invitations={invitations}
            checkIns={checkIns}
            attendanceSummary={attendanceSummary}
            onInvite={() => setInviteOpen(true)}
            onCheckIn={() => setModal("checkin")}
            onViewAttendance={() => setModal("attendance")}
          />
        </div>
      ) : null}

      {activeTab === "operations" ? (
        <div className="event-command-body event-command-ops">
          <EventManageVolunteersCard
            eventId={event.id}
            eventName={event.name}
            volunteers={volunteers}
            isLoading={volunteersLoading}
            alreadyInvitedMemberIds={invitedMemberIds}
            focusAddRoleToken={addRoleToken}
            onViewSignups={() => setModal("volunteers")}
            onSlotsChanged={onRefresh}
          />
          {tasksCard}
          <EventManageBudgetCard
            budget={budget}
            canViewTreasury={canViewTreasury}
            onViewTransactions={() => setModal("transactions")}
          />
        </div>
      ) : null}

      {activeTab === "record" ? (
        <div className="event-command-body">
          <EventManageRecordWorkspace
            event={event}
            budget={budget}
            attendanceSummary={attendanceSummary}
            checkInCount={checkInCount}
            goingCount={attendees?.going_count ?? null}
            onOpenFeedback={() => setModal("feedback")}
            onOpenTransactions={() => setModal("transactions")}
            onOpenAttendance={() => setModal("attendance")}
            onOpenMeeting={() => setModal("meeting")}
          />
        </div>
      ) : null}

      <Drawer
        open={editorOpen}
        onClose={closeEditor}
        title="Edit event"
        side="right"
        size="lg"
      >
        <EventManageDetailsCard
          event={event}
          onUpdated={onUpdated}
          onSaved={closeEditor}
          variant="drawer"
        />
      </Drawer>

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
          canReviewVolunteers={canViewBoard}
          canAssignTasks={canManageTasks && canCreateEventTasks(event)}
          onConvertToTask={(signup) => {
            onConvertVolunteerToTask(signup);
            selectTab("operations");
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={EVENT_MANAGE_SECONDARY_BTN}
            >
              Invite members
            </button>
          </div>
          <EventInvitedParticipantsSection
            eventId={event.id}
            refreshKey={refreshKey}
          />
        </div>
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

      <InviteMembersToEventModal
        open={inviteOpen}
        eventId={event.id}
        eventName={event.name}
        alreadyInvitedMemberIds={invitedMemberIds}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          onRefresh();
        }}
      />
    </>
  );
}
