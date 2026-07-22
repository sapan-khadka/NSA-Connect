import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { EventAttendanceSummaryPanel } from "./EventAttendanceSummaryPanel";
import { EventCheckInPanel } from "./EventCheckInPanel";
import { EventDeleteSection } from "./EventDeleteSection";
import { EventFeedbackSection } from "./EventFeedbackSection";
import { EventFinanceCloseoutBanner } from "./EventFinanceCloseoutBanner";
import { EventInvitedParticipantsSection } from "./EventInvitedParticipantsSection";
import { EventManageBudgetCard } from "./EventManageBudgetCard";
import { EventManageCheckInCard } from "./EventManageCheckInCard";
import { EventManageActivityFeed } from "./EventManageActivityFeed";
import { EventManageCommunicationsCard } from "./EventManageCommunicationsCard";
import { EventManageDetailsCard } from "./EventManageDetailsCard";
import {
  EventManageOverview,
  type EventManageTab,
} from "./EventManageOverview";
import { EventManageRsvpAnalyticsCard } from "./EventManageRsvpAnalyticsCard";
import { EventManageVolunteersCard } from "./EventManageVolunteersCard";
import { EventManageWrapUpCard } from "./EventManageWrapUpCard";
import { EventManageBudgetSummaryCard } from "./EventManageLogisticsSection";
import { EventTaskManager } from "./EventTaskManager";
import { EventVolunteersSection } from "./EventVolunteersSection";
import { FinanceEntryList } from "./FinanceEntryList";
import { InviteMembersToEventModal } from "./InviteMembersToEventModal";
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
  { id: "details", label: "Details" },
  { id: "people", label: "People" },
  { id: "ops", label: "Ops" },
  { id: "record", label: "Record" },
];

const MANAGE_TAB_IDS = new Set<EventManageTab>(
  TABS.map((tab) => tab.id),
);

function parseManageTab(value: string | null): EventManageTab {
  if (value && MANAGE_TAB_IDS.has(value as EventManageTab)) {
    return value as EventManageTab;
  }
  return "overview";
}

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

function tabButtonClassName(active: boolean): string {
  return [
    "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
    active
      ? "bg-surface-card text-foreground shadow-sm"
      : "text-label hover:text-foreground",
  ].join(" ");
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
  const [modal, setModal] = useState<ManageModal>(
    initialOpenModal ?? modalFromUrl,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const consumedInitialModalRef = useRef(false);
  const [volunteers, setVolunteers] = useState<EventVolunteerSignupMember[]>(
    [],
  );
  const [volunteersLoading, setVolunteersLoading] = useState(true);
  const [checkInCount, setCheckInCount] = useState(0);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);
  const [invitedMemberIds, setInvitedMemberIds] = useState<number[]>([]);
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

  function selectTab(tab: EventManageTab) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    setSearchParams(next, { replace: true });
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
      selectTab("ops");
      setModal("tasks");
    }
  }, [openTasksModalToken]);

  useEffect(() => {
    if (openCheckInModalToken > 0) {
      selectTab("people");
      setModal("checkin");
    }
  }, [openCheckInModalToken]);

  useEffect(() => {
    if (editDetailsToken > 0) {
      selectTab("details");
      window.setTimeout(() => {
        const schedule = document.getElementById("event-manage-schedule");
        if (schedule && typeof schedule.scrollIntoView === "function") {
          schedule.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        const dateInput = document.getElementById("manage-event-date");
        if (dateInput instanceof HTMLElement) {
          dateInput.focus();
        }
      }, 80);
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
      selectTab("people");
    } else if (
      initialOpenModal === "tasks" ||
      initialOpenModal === "transactions"
    ) {
      selectTab("ops");
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
      selectTab("people");
    } else if (
      modalFromUrl === "tasks" ||
      modalFromUrl === "transactions"
    ) {
      selectTab("ops");
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
      setInvitedMemberIds([]);
      return;
    }

    let cancelled = false;

    void fetchEventInvitedParticipants(event.id)
      .then((response) => {
        if (!cancelled) {
          setInvitedCount(response.invitations.length);
          setInvitedMemberIds(
            response.invitations.map((invitation) => invitation.member_id),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvitedCount(0);
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
      volunteerCount: volunteersLoading ? null : volunteers.length,
    });
  }, [
    attendees?.going_count,
    attendeesLoading,
    onMetricsChange,
    volunteers.length,
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

  function handleResolveReadiness(
    target: NonNullable<
      ReturnType<typeof computeEventReadiness>["resolveTarget"]
    >,
  ) {
    if (target === "volunteers") {
      selectTab("people");
      setModal("volunteers");
      return;
    }
    if (target === "budget") {
      selectTab("ops");
      if (canViewTreasury) {
        setModal("transactions");
      }
      return;
    }
    if (target === "schedule" || target === "cover" || target === "details") {
      selectTab("details");
      window.setTimeout(() => {
        if (target === "schedule") {
          document
            .getElementById("event-manage-schedule")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          const dateInput = document.getElementById("manage-event-date");
          if (dateInput instanceof HTMLElement) {
            dateInput.focus();
          }
          return;
        }
        document
          .querySelector('[aria-label="Event Details"]')
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  if (!canViewBoard) {
    return (
      <p className={EVENT_MANAGE_LOADING}>
        You do not have permission to manage this event.
      </p>
    );
  }

  const tasksCard = (
    <ManageCardShell
      title="Tasks"
      subtitle="Open work for this event"
      action={
        totalTasks > 0 ? (
          <ArrowAction onClick={() => setModal("tasks")}>View all</ArrowAction>
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
            Break the event into clear owner-ready tasks so nothing slips before
            doors open.
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
  );

  const invitesCard = (
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
            Invite members for program roles or special participation.
          </p>
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
            >
              Invite members
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
            {invitedCount === 1
              ? "1 person invited"
              : `${invitedCount} people invited`}
          </p>
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={`${EVENT_MANAGE_SECONDARY_BTN} w-full`}
            >
              Invite more
            </button>
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
  );

  return (
    <>
      <div className="sticky top-0 z-20 -mx-1 border-b border-gray-100/80 bg-surface/95 px-1 py-2 backdrop-blur-sm">
        <div
          role="tablist"
          aria-label="Manage event sections"
          className="inline-flex max-w-full flex-wrap rounded-xl border border-gray-200 bg-surface-muted/40 p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={tabButtonClassName(activeTab === tab.id)}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="mt-5">
          <EventManageOverview
            event={event}
            budget={budget}
            volunteerCount={volunteersLoading ? null : volunteers.length}
            volunteersLoading={volunteersLoading}
            attendeeCount={attendeesLoading ? null : (attendees?.going_count ?? null)}
            attendeesLoading={attendeesLoading}
            checkInCount={checkInCount}
            invitedCount={invitedCount}
            openTaskCount={totalTasks - completed}
            totalTaskCount={totalTasks}
            onResolve={handleResolveReadiness}
            onGoToTab={selectTab}
            onOpenVolunteers={() => {
              selectTab("people");
              setModal("volunteers");
            }}
            onOpenTasks={() => {
              selectTab("ops");
              setModal("tasks");
            }}
            onOpenBudget={() => {
              selectTab("ops");
              if (canViewTreasury) {
                setModal("transactions");
              }
            }}
            onOpenCheckIn={() => {
              selectTab("people");
              setModal("checkin");
            }}
            onOpenAttendance={() => {
              selectTab("people");
              if (attendanceSummary) {
                setModal("attendance");
              }
            }}
            onOpenInvites={() => {
              selectTab("people");
              if (invitedCount && invitedCount > 0) {
                setModal("invited");
              } else {
                setInviteOpen(true);
              }
            }}
            onOpenCommunications={() => selectTab("record")}
          />
        </div>
      ) : null}

      {activeTab === "details" ? (
        <div className="mt-5">
          <EventManageDetailsCard event={event} onUpdated={onUpdated} />
        </div>
      ) : null}

      {activeTab === "people" ? (
        <div className="event-manage-grid mt-5 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EventManageVolunteersCard
            eventId={event.id}
            volunteers={volunteers}
            isLoading={volunteersLoading}
            onViewSignups={() => setModal("volunteers")}
            onConvertToTasks={() => {
              selectTab("ops");
              setModal("tasks");
            }}
          />
          {invitesCard}
          <EventManageCheckInCard
            eventId={event.id}
            checkedInCount={checkInCount}
            eventCapacity={event.capacity}
            goingCount={attendees?.going_count ?? null}
            onOpenCheckIn={() => setModal("checkin")}
          />
          <EventManageRsvpAnalyticsCard
            attendees={attendees}
            attendeesLoading={attendeesLoading}
            attendanceSummary={attendanceSummary}
            eventCapacity={event.capacity}
            eventName={event.name}
            onViewDetails={
              attendanceSummary ? () => setModal("attendance") : undefined
            }
          />
        </div>
      ) : null}

      {activeTab === "ops" ? (
        <div className="event-manage-grid mt-5 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
          {tasksCard}
          <EventManageBudgetCard
            budget={budget}
            canViewTreasury={canViewTreasury}
            onViewTransactions={() => setModal("transactions")}
          />
        </div>
      ) : null}

      {activeTab === "record" ? (
        <div className="mt-5 space-y-5">
          <EventManageCommunicationsCard
            event={event}
            canSharePublicly={
              !isMeetingEvent || event.meeting_visibility === "public"
            }
          />

          <EventManageActivityFeed eventId={event.id} />

          <EventManageWrapUpCard
            event={event}
            budget={budget}
            attendanceSummary={attendanceSummary}
            feedbackCount={null}
            onOpenFeedback={() => setModal("feedback")}
            onOpenTransactions={() => setModal("transactions")}
            onOpenAttendance={() => setModal("attendance")}
          />

          {isMeetingEvent || event.is_past ? (
            <div className="event-manage-grid grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
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
                      Capture minutes, attendance, and follow-ups for this
                      meeting.
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
          ) : null}

          <div className="border-t border-gray-100 pt-6">
            <EventDeleteSection
              eventId={event.id}
              eventName={event.name}
              dangerZone
            />
          </div>
        </div>
      ) : null}

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
            selectTab("ops");
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
