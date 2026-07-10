import { useEffect, useState } from "react";
import {
  Archive,
  ClipboardList,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { CoverBanner } from "../components/CoverBanner";
import { HomeAnnouncementsSection } from "../components/HomeAnnouncementsSection";
import { HomeFinanceQuickActions } from "../components/HomeFinanceQuickActions";
import { HomeHeroBrand } from "../components/AppLogo";
import { HomeProfileCard } from "../components/HomeProfileCard";
import { LogFinanceEntryForm } from "../components/LogFinanceEntryForm";
import { RecentMemoriesStrip } from "../components/RecentMemoriesStrip";
import {
  HomeActivitySection,
  HomeBoardMeetingSection,
  HomeUpNextSection,
  HomeWelcomeHeader,
  HomeYourWorkSection,
  QuickLinkCard,
  type QuickLink,
} from "../components/home/HomeMemberSections";
import { HomeCard } from "../components/ui/HomeCard";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/useAuth";
import { useIsLgUp } from "../hooks/useMediaQuery";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMyEventTasks } from "../lib/event-tasks-api";
import { applyRsvpStatus, formatCompactAttendeeSummary } from "../lib/event-rsvp";
import {
  fetchEventAttendees,
  fetchEvents,
  fetchUpcomingEvents,
  updateEventRsvp,
  type EventResponse,
  type RsvpStatus,
} from "../lib/events-api";
import { isEventFinanceEditable } from "../lib/event-finance";
import {
  fetchPendingFinanceChangeRequests,
  fetchMyFinanceChangeRequestSummary,
} from "../lib/finance-api";
import { getMobileActivityPreview } from "../lib/home-activity-preview";
import {
  buildHomeActivities,
  type HomeActivity,
} from "../lib/home-activities";
import { getMyTasksPath, summarizeMyTasks } from "../lib/home-tasks";
import { fetchPendingMembers } from "../lib/members-api";
import { fetchMeetings, type MeetingSummary } from "../lib/meetings-api";
import { fetchRecentMemories, type RecentMemoriesPreview } from "../lib/recent-memories";
import {
  canAccessFinance,
  canManageTreasury,
  canViewMemberDirectory,
  canViewTaskOversight,
  isRoleAtLeast,
} from "../lib/roles";

function findNextNonMeetingEvent(events: EventResponse[]): EventResponse | null {
  return events.find((event) => event.event_type !== "meeting") ?? null;
}

function findNextBoardMeeting(meetings: MeetingSummary[]): MeetingSummary | null {
  return (
    meetings
      .filter((meeting) => !meeting.is_past)
      .sort(
        (left, right) =>
          new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
      )[0] ?? null
  );
}

function buildQuickLinks(member: MemberResponse): QuickLink[] {
  const links: QuickLink[] = [];

  if (isRoleAtLeast(member.role, "board")) {
    links.push({
      title: "Past events",
      description: "Close-out status",
      to: "/events/past",
      icon: Archive,
    });
  }

  if (canViewMemberDirectory(member.role)) {
    links.push({
      title: "Member directory",
      description: "Browse NSA members",
      to: "/members",
      icon: Users,
    });
  }

  if (canViewTaskOversight(member.role, member.position)) {
    links.push({
      title: "Task oversight",
      description: "Team completion progress",
      to: "/events/oversight",
      icon: ClipboardList,
    });
  }

  if (canAccessFinance(member.role)) {
    links.push({
      title: "Finance",
      description: "Budgets and treasury",
      to: "/finance",
      icon: Wallet,
    });
  }

  if (member.role === "general") {
    links.push({
      title: "AI assistant",
      description: "Ask about NSA events",
      to: "/assistant",
      icon: Sparkles,
    });
  }

  return links;
}

function PublicHomeView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-0">
      <CoverBanner />
      <HomeHeroBrand
        eyebrow="Namaste — welcome to NSA Connect"
        title="NSA Connect"
        description="Log in or create an account with your @semo.edu email to access events, tasks, and member tools."
        align="center"
        actions={
          <>
            <Link
              to="/login"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-foreground transition hover:border-accent hover:bg-accent/5"
            >
              Create account
            </Link>
          </>
        }
      />
    </div>
  );
}

type MemberHomeLayoutProps = {
  member: MemberResponse;
  activities: HomeActivity[];
  mobileActivityPreview: HomeActivity[];
  nextEvent: EventResponse | null;
  tasksSummary: ReturnType<typeof summarizeMyTasks>;
  nextBoardMeeting: MeetingSummary | null;
  meetingAttendeeSummary: string | null;
  isLoading: boolean;
  loadError: string | null;
  rsvpLoading: boolean;
  recentMemories: RecentMemoriesPreview | null;
  financePendingCount: number;
  showFinanceQuickActions: boolean;
  quickLinks: QuickLink[];
  tasksPath: string;
  isBoardMember: boolean;
  onRsvpStatusChange: (status: RsvpStatus) => void;
  onLogTransaction: () => void;
};

function DesktopMemberHomeLayout({
  member,
  activities,
  nextEvent,
  tasksSummary,
  nextBoardMeeting,
  meetingAttendeeSummary,
  isLoading,
  loadError,
  rsvpLoading,
  recentMemories,
  financePendingCount,
  showFinanceQuickActions,
  quickLinks,
  tasksPath,
  isBoardMember,
  onRsvpStatusChange,
  onLogTransaction,
}: MemberHomeLayoutProps) {
  return (
    <div className="space-y-5">
      <CoverBanner />

      <HomeWelcomeHeader member={member} />

      {showFinanceQuickActions ? (
        <HomeFinanceQuickActions
          pendingApprovalCount={financePendingCount}
          onLogTransaction={onLogTransaction}
        />
      ) : null}

      <HomeAnnouncementsSection previewLimit={3} />

      {loadError ? (
        <div role="alert" className="ds-alert-banner">
          {loadError}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <HomeActivitySection
          activities={activities}
          isLoading={isLoading}
          tasksPath={tasksPath}
          scrollable
        />
        <HomeYourWorkSection
          member={member}
          tasksSummary={tasksSummary}
          tasksPath={tasksPath}
          isLoading={isLoading}
        />
      </div>

      <div
        className={
          isBoardMember && nextBoardMeeting
            ? "grid items-start gap-5 lg:grid-cols-2"
            : "grid items-start gap-5"
        }
      >
        <HomeUpNextSection
          nextEvent={nextEvent}
          isLoading={isLoading}
          rsvpLoading={rsvpLoading}
          onRsvpStatusChange={onRsvpStatusChange}
        />
        {isBoardMember && nextBoardMeeting ? (
          <HomeBoardMeetingSection
            meeting={nextBoardMeeting}
            attendeeSummary={meetingAttendeeSummary}
          />
        ) : null}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <HomeProfileCard member={member} />
        {quickLinks.length > 0 ? (
          <HomeCard padding="sm" className="self-start">
            <h2 className="text-base font-medium text-foreground">
              More for your role
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <li key={link.to + link.title}>
                  <QuickLinkCard {...link} />
                </li>
              ))}
            </ul>
          </HomeCard>
        ) : null}
      </div>

      {recentMemories ? <RecentMemoriesStrip memories={recentMemories} /> : null}
    </div>
  );
}

function MobileMemberHomeLayout({
  member,
  activities,
  mobileActivityPreview,
  nextEvent,
  tasksSummary,
  nextBoardMeeting,
  meetingAttendeeSummary,
  isLoading,
  loadError,
  rsvpLoading,
  recentMemories,
  financePendingCount,
  showFinanceQuickActions,
  quickLinks,
  tasksPath,
  isBoardMember,
  onRsvpStatusChange,
  onLogTransaction,
}: MemberHomeLayoutProps) {
  return (
    <div className="ds-mobile-edge-stack">
        <div className="ds-mobile-edge-section">
          <HomeWelcomeHeader member={member} compact />
        </div>

        {loadError ? (
          <div className="ds-mobile-edge-section">
            <div role="alert" className="ds-alert-banner">
              {loadError}
            </div>
          </div>
        ) : null}

        <div className="ds-mobile-edge-section">
          <HomeUpNextSection
            nextEvent={nextEvent}
            isLoading={isLoading}
            rsvpLoading={rsvpLoading}
            onRsvpStatusChange={onRsvpStatusChange}
          />
        </div>

        <div className="ds-mobile-edge-section">
          <HomeYourWorkSection
            member={member}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            isLoading={isLoading}
          />
        </div>

        <div className="ds-mobile-edge-section">
          <HomeActivitySection
            activities={mobileActivityPreview}
            isLoading={isLoading}
            tasksPath={tasksPath}
            truncatedFromTotal={activities.length}
            scrollable={false}
          />
        </div>

        {showFinanceQuickActions ? (
          <div className="ds-mobile-edge-section">
            <HomeFinanceQuickActions
              pendingApprovalCount={financePendingCount}
              onLogTransaction={onLogTransaction}
            />
          </div>
        ) : null}

        {isBoardMember && nextBoardMeeting ? (
          <div className="ds-mobile-edge-section">
            <HomeBoardMeetingSection
              meeting={nextBoardMeeting}
              attendeeSummary={meetingAttendeeSummary}
            />
          </div>
        ) : null}

        <div className="ds-mobile-edge-section">
          <HomeAnnouncementsSection previewLimit={2} />
        </div>

        <div className="ds-mobile-edge-section">
          <HomeProfileCard member={member} />
        </div>

        {quickLinks.length > 0 ? (
          <div className="ds-mobile-edge-section">
            <HomeCard padding="sm" className="self-start">
              <h2 className="text-base font-medium text-foreground">
                More for your role
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {quickLinks.map((link) => (
                  <li key={link.to + link.title}>
                    <QuickLinkCard {...link} />
                  </li>
                ))}
              </ul>
            </HomeCard>
          </div>
        ) : null}

        <div className="ds-mobile-edge-section !p-0">
          <CoverBanner className="[&_img]:h-28" />
        </div>

        {recentMemories ? (
          <div className="ds-mobile-edge-section">
            <RecentMemoriesStrip memories={recentMemories} />
          </div>
        ) : null}
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const [nextEvent, setNextEvent] = useState<EventResponse | null>(null);
  const [tasksSummary, setTasksSummary] = useState(summarizeMyTasks([]));
  const [activities, setActivities] = useState<HomeActivity[]>([]);
  const [nextBoardMeeting, setNextBoardMeeting] = useState<MeetingSummary | null>(
    null,
  );
  const [meetingAttendeeSummary, setMeetingAttendeeSummary] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [recentMemories, setRecentMemories] = useState<RecentMemoriesPreview | null>(
    null,
  );
  const [financePendingCount, setFinancePendingCount] = useState(0);
  const [financeEventOptions, setFinanceEventOptions] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [isLogTransactionOpen, setIsLogTransactionOpen] = useState(false);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);

  const isBoardMember = isRoleAtLeast(member.role, "board");
  const showFinanceQuickActions = canManageTreasury(member.role);
  const quickLinks = buildQuickLinks(member);
  const tasksPath = getMyTasksPath(member.role);
  const isLgUp = useIsLgUp();
  const mobileActivityPreview = getMobileActivityPreview(activities, 2);

  const layoutProps: MemberHomeLayoutProps = {
    member,
    activities,
    mobileActivityPreview,
    nextEvent,
    tasksSummary,
    nextBoardMeeting,
    meetingAttendeeSummary,
    isLoading,
    loadError,
    rsvpLoading,
    recentMemories,
    financePendingCount,
    showFinanceQuickActions,
    quickLinks,
    tasksPath,
    isBoardMember,
    onRsvpStatusChange: (status) => void handleRsvpStatusChange(status),
    onLogTransaction: () => setIsLogTransactionOpen(true),
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const upcomingPromise = fetchUpcomingEvents({ limit: 10 });
        const tasksPromise = fetchMyEventTasks().catch(() => ({
          tasks: [],
          total: 0,
        }));

        const pendingMembersPromise = isBoardMember
          ? fetchPendingMembers().catch(() => ({ members: [], total: 0 }))
          : Promise.resolve(null);

        const financePendingPromise = showFinanceQuickActions
          ? fetchPendingFinanceChangeRequests().catch(() => ({
              requests: [],
              total: 0,
            }))
          : Promise.resolve(null);

        const myFinanceRequestsPromise = showFinanceQuickActions
          ? fetchMyFinanceChangeRequestSummary().catch(() => ({
              pending_count: 0,
              recently_rejected_count: 0,
              recently_approved_count: 0,
            }))
          : Promise.resolve(null);

        const meetingsPromise = isBoardMember
          ? fetchMeetings().catch(() => ({ meetings: [], total: 0 }))
          : Promise.resolve(null);

        const [upcoming, tasksResult, pendingMembers, financePending, myFinanceRequests, meetingsResult] =
          await Promise.all([
            upcomingPromise,
            tasksPromise,
            pendingMembersPromise,
            financePendingPromise,
            myFinanceRequestsPromise,
            meetingsPromise,
          ]);

        const nextMeeting = meetingsResult
          ? findNextBoardMeeting(meetingsResult.meetings)
          : null;

        let attendeeSummary: string | null = null;
        if (nextMeeting) {
          try {
            const attendees = await fetchEventAttendees(nextMeeting.event_id);
            attendeeSummary = formatCompactAttendeeSummary(attendees);
          } catch {
            attendeeSummary = null;
          }
        }

        if (cancelled) {
          return;
        }

        const summary = summarizeMyTasks(tasksResult.tasks);
        setNextEvent(findNextNonMeetingEvent(upcoming.events));
        setTasksSummary(summary);
        setActivities(
          buildHomeActivities({
            role: member.role,
            tasksSummary: summary,
            pendingMembersTotal: pendingMembers?.total ?? 0,
            financePendingTotal: financePending?.total ?? 0,
            myFinanceRequests,
          }),
        );
        setNextBoardMeeting(nextMeeting);
        setMeetingAttendeeSummary(attendeeSummary);
        setFinancePendingCount(financePending?.total ?? 0);
      } catch (caught) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isBoardMember, member, showFinanceQuickActions, homeRefreshKey]);

  useEffect(() => {
    if (!showFinanceQuickActions) {
      return;
    }

    let cancelled = false;

    async function loadFinanceEventOptions() {
      try {
        const response = await fetchEvents();
        if (!cancelled) {
          setFinanceEventOptions(
            response.events
              .filter((event) => isEventFinanceEditable(event))
              .map((event) => ({
                id: event.id,
                name: event.name,
              })),
          );
        }
      } catch {
        if (!cancelled) {
          setFinanceEventOptions([]);
        }
      }
    }

    void loadFinanceEventOptions();

    return () => {
      cancelled = true;
    };
  }, [showFinanceQuickActions, homeRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentMemories() {
      try {
        const memories = await fetchRecentMemories();
        if (!cancelled) {
          setRecentMemories(memories);
        }
      } catch {
        if (!cancelled) {
          setRecentMemories(null);
        }
      }
    }

    void loadRecentMemories();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRsvpStatusChange(status: RsvpStatus) {
    if (!nextEvent) {
      return;
    }

    const snapshot = nextEvent;
    setRsvpLoading(true);
    setNextEvent((current) =>
      current ? { ...current, current_member_rsvp_status: status } : current,
    );

    try {
      const response = await updateEventRsvp(nextEvent.id, status);
      setNextEvent((current) =>
        current ? applyRsvpStatus(current, response) : current,
      );
    } catch {
      setNextEvent(snapshot);
    } finally {
      setRsvpLoading(false);
    }
  }

  return (
    <>
      {isLgUp ? (
        <DesktopMemberHomeLayout {...layoutProps} />
      ) : (
        <MobileMemberHomeLayout {...layoutProps} />
      )}

      <Modal
        open={isLogTransactionOpen}
        title="Log transaction"
        onClose={() => setIsLogTransactionOpen(false)}
      >
        {isLogTransactionOpen ? (
          <LogFinanceEntryForm
            presentation="standalone"
            idPrefix="home-log-transaction"
            eventOptions={financeEventOptions}
            onCreated={() => {
              setIsLogTransactionOpen(false);
              setHomeRefreshKey((current) => current + 1);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

export function HomePage() {
  const { member, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-label">Loading…</p>;
  }

  if (!isAuthenticated || !member) {
    return <PublicHomeView />;
  }

  return <MemberHomeView member={member} />;
}
