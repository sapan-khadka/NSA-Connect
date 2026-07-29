/**
 * Member Quick View — compact peek panel (not a mini profile page).
 * Opens from the directory without changing the URL.
 * Loads real activity / responsibilities / upcoming when available; never invents metrics.
 */

import { Check, Mail, MessageSquare, MoreHorizontal, Pencil } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { Drawer } from "../design-system/components/feedback/Drawer";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import type { DuesStatus, MemberDuesRecord } from "../lib/dues-api";
import {
  fetchMyEventTasks,
  fetchTaskOverview,
  type EventTaskResponse,
} from "../lib/event-tasks-api";
import { formatCurrencyCompact } from "../lib/format-currency";
import { memberMailtoHref } from "../lib/member-mailto";
import {
  formatOutstandingDuesCell,
  getMemberDirectoryRoleLabel,
} from "../lib/members-directory";
import {
  groupMemberActivityByDay,
  mapMemberActivityApiItem,
  takeMemberActivityPreview,
  type MemberActivityItem,
} from "../lib/member-activity-timeline";
import { fetchMemberActivity } from "../lib/members-api";
import {
  buildResponsibilityItems,
  type MemberResponsibilityItem,
} from "../lib/member-workspace-responsibilities";
import {
  fetchMemberWorkspaceSchedule,
  takeSchedulePreview,
  type ScheduleCommitment,
} from "../lib/member-workspace-schedule";
import { openDirectMessage } from "../lib/open-direct-message";
import {
  canManageEventTasks,
  canViewMemberDirectory,
  canViewTaskOversight,
  formatMemberPositionLabel,
  isMemberRole,
  memberHoldsBoardSeat,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";

const MISSING = "—";

export type MemberQuickViewActivityItem = {
  id: string;
  label: string;
  detail?: string;
  occurredAtLabel?: string;
};

type MemberQuickViewDrawerProps = {
  member: MemberResponse | null;
  open: boolean;
  onClose: () => void;
  /** Real dues row from finance API when available. */
  duesRecord?: MemberDuesRecord | null;
  /** Engagement for approved members (directory active/idle). */
  engagement?: "active" | "idle" | null;
  /**
   * Optional preloaded activity. When omitted, the drawer fetches
   * GET /v1/members/{id}/activity on open.
   */
  activityItems?: MemberQuickViewActivityItem[];
  /** When set (board+), shows Edit in the overflow menu. */
  onEditMember?: (member: MemberResponse) => void;
};

function formatOutstandingDues(record: MemberDuesRecord | null | undefined): {
  label: ReactNode;
  muted: boolean;
} {
  if (!record) {
    return { label: MISSING, muted: true };
  }

  const status = record.status as DuesStatus;
  if (status === "paid" || status === "exempt") {
    return {
      label: (
        <span className="members-quick-view-dues members-quick-view-dues--paid">
          <AppIcon icon={Check} size="xs" className="text-current" />
          Paid
        </span>
      ),
      muted: false,
    };
  }

  const outstanding = formatOutstandingDuesCell(record);
  const amount =
    outstanding !== null
      ? formatCurrencyCompact(outstanding)
      : formatCurrencyCompact(0);

  return {
    label: (
      <span
        className={
          status === "partial"
            ? "members-quick-view-dues members-quick-view-dues--partial"
            : "members-quick-view-dues members-quick-view-dues--overdue"
        }
      >
        {amount}
      </span>
    ),
    muted: false,
  };
}

function statusLabel(
  status: string,
  engagement?: "active" | "idle" | null,
): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") {
    if (engagement === "active") {
      return "Active";
    }
    if (engagement === "idle") {
      return "Idle";
    }
    return "Approved";
  }
  if (normalized === "pending") {
    return "Pending";
  }
  if (normalized === "alumni") {
    return "Alumni";
  }
  if (normalized === "inactive" || normalized === "rejected") {
    return "Inactive";
  }
  return status
    ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
    : MISSING;
}

function DetailRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="members-quick-view-detail-row">
      <dt>{label}</dt>
      <dd className={muted ? "is-muted" : undefined}>{value}</dd>
    </div>
  );
}

function seatResponsibilityLabels(
  member: Pick<
    MemberResponse,
    "role" | "position" | "custom_board_position"
  >,
): string[] {
  const labels: string[] = [];
  if (memberHoldsBoardSeat(member)) {
    labels.push(formatMemberPositionLabel(member));
  } else if (member.role === "board") {
    labels.push("Board member");
  }
  return labels;
}

export function MemberQuickViewDrawer({
  member,
  open,
  onClose,
  duesRecord = null,
  engagement = null,
  activityItems: activityItemsProp,
  onEditMember,
}: MemberQuickViewDrawerProps) {
  const navigate = useNavigate();
  const { member: currentMember } = useAuth();
  const menuId = useId();
  const moreRef = useRef<HTMLDivElement>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activityItems, setActivityItems] = useState<MemberActivityItem[]>([]);
  const [responsibilities, setResponsibilities] = useState<
    MemberResponsibilityItem[]
  >([]);
  const [upcoming, setUpcoming] = useState<ScheduleCommitment | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const useExternalActivity = activityItemsProp !== undefined;

  useEffect(() => {
    if (!open || !member || useExternalActivity) {
      return;
    }

    let cancelled = false;
    setSectionsLoading(true);
    setActivityItems([]);
    setResponsibilities([]);
    setUpcoming(null);

    const isSelf = currentMember?.id === member.id;
    const canFetchTaskOverview = Boolean(
      currentMember &&
        canViewTaskOversight(currentMember.role, currentMember.position),
    );
    const canOpenEventManage = Boolean(
      currentMember &&
        canManageEventTasks(currentMember.role, currentMember.position),
    );
    const viewerIsBoard = Boolean(
      currentMember && canViewMemberDirectory(currentMember.role),
    );
    const memberRole = isMemberRole(member.role) ? member.role : "general";

    void (async () => {
      const [activityResult, overviewResult, myTasksResult, scheduleResult] =
        await Promise.all([
          fetchMemberActivity(member.id, { limit: 12 }).catch(() => ({
            items: [],
            total: 0,
          })),
          canFetchTaskOverview
            ? fetchTaskOverview().catch(() => null)
            : Promise.resolve(null),
          isSelf && !canFetchTaskOverview
            ? fetchMyEventTasks().catch(() => null)
            : Promise.resolve(null),
          fetchMemberWorkspaceSchedule({
            memberId: member.id,
            memberRole,
            isSelf,
            viewerIsBoard,
          }).catch(() => [] as ScheduleCommitment[]),
        ]);

      if (cancelled) {
        return;
      }

      let tasks: EventTaskResponse[] = [];
      if (overviewResult) {
        const row = overviewResult.members.find(
          (entry) => entry.member_id === member.id,
        );
        tasks = row?.tasks ?? [];
      } else if (myTasksResult) {
        tasks = myTasksResult.tasks;
      }

      setActivityItems(activityResult.items.map(mapMemberActivityApiItem));
      setResponsibilities(
        buildResponsibilityItems(tasks, { canOpenEventManage }),
      );
      setUpcoming(takeSchedulePreview(scheduleResult).preview[0] ?? null);
      setSectionsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, member, useExternalActivity, currentMember]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (
        moreRef.current &&
        event.target instanceof Node &&
        !moreRef.current.contains(event.target)
      ) {
        setMoreOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  const activityGroups = useMemo(() => {
    if (useExternalActivity) {
      return null;
    }
    const preview = takeMemberActivityPreview(activityItems, 6).preview;
    return groupMemberActivityByDay(preview);
  }, [activityItems, useExternalActivity]);

  if (!member || !open) {
    return null;
  }

  const profilePath = `/members/${member.id}`;
  const dues = formatOutstandingDues(duesRecord);
  const mailtoHref = memberMailtoHref(member.email);
  const isSelf = currentMember?.id === member.id;
  const roleLabel = getMemberDirectoryRoleLabel(member);
  const memberStatus = statusLabel(member.status, engagement);
  const seatLabels = seatResponsibilityLabels(member);
  const responsibilityLines = [
    ...seatLabels,
    ...responsibilities.slice(0, 4).map((item) => item.title),
  ];
  const uniqueResponsibilities = [...new Set(responsibilityLines)];

  async function handleMessage() {
    if (isSelf || messageLoading) {
      return;
    }
    setMessageLoading(true);
    setMoreOpen(false);
    try {
      onClose();
      await openDirectMessage(navigate, member.id);
    } catch (error) {
      window.alert(getApiErrorMessage(error));
    } finally {
      setMessageLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="sm"
      closeOnBackdrop
      showClose
      className="members-quick-view-drawer"
      title={
        <span className="members-quick-view-title-block">
          <span className="members-quick-view-title-row">
            <Avatar
              name={member.full_name}
              src={member.avatar_url}
              size="md"
              className="members-quick-view-avatar"
              aria-hidden="true"
            />
            <span className="members-quick-view-title-copy">
              <span className="members-quick-view-title-name">
                {member.full_name}
              </span>
              <span className="members-quick-view-title-meta">
                {roleLabel} · {memberStatus}
              </span>
              {member.email?.trim() ? (
                <span className="members-quick-view-title-email">
                  {member.email.trim()}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      }
      footer={
        <div className="members-quick-view-footer">
          <Link
            to={profilePath}
            className="members-quick-view-profile-link"
            onClick={onClose}
          >
            View full profile
            <span aria-hidden="true"> →</span>
          </Link>
          <div className="members-quick-view-more" ref={moreRef}>
            <button
              type="button"
              className="members-quick-view-more-btn"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-controls={moreOpen ? menuId : undefined}
              onClick={() => setMoreOpen((current) => !current)}
            >
              <AppIcon icon={MoreHorizontal} size="sm" className="text-current" />
            </button>
            {moreOpen ? (
              <div
                id={menuId}
                role="menu"
                aria-label="Member actions"
                className="members-quick-view-more-menu"
              >
                {onEditMember ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="members-quick-view-more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      onEditMember(member);
                    }}
                  >
                    <AppIcon icon={Pencil} size="xs" className="text-current" />
                    Edit
                  </button>
                ) : null}
                {mailtoHref ? (
                  <a
                    href={mailtoHref}
                    role="menuitem"
                    className="members-quick-view-more-item"
                    onClick={() => setMoreOpen(false)}
                  >
                    <AppIcon icon={Mail} size="xs" className="text-current" />
                    Email
                  </a>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="members-quick-view-more-item"
                  disabled={isSelf || messageLoading}
                  onClick={() => {
                    void handleMessage();
                  }}
                >
                  <AppIcon
                    icon={MessageSquare}
                    size="xs"
                    className="text-current"
                  />
                  Message
                </button>
                {onEditMember ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="members-quick-view-more-item"
                      disabled
                      title="Coming Soon"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="members-quick-view-more-item is-danger"
                      disabled
                      title="Coming Soon"
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="members-quick-view">
        <section aria-labelledby="members-quick-view-details-heading">
          <h3
            id="members-quick-view-details-heading"
            className="members-quick-view-section-title"
          >
            Details
          </h3>
          <dl className="members-quick-view-details" aria-label="Member facts">
            <DetailRow
              label="Graduation"
              value={
                member.graduation_year ? String(member.graduation_year) : MISSING
              }
              muted={!member.graduation_year}
            />
            <DetailRow
              label="Major"
              value={member.major?.trim() || MISSING}
              muted={!member.major?.trim()}
            />
            <DetailRow
              label="Outstanding"
              value={dues.label}
              muted={dues.muted}
            />
          </dl>
        </section>

        <section aria-labelledby="members-quick-view-resp-heading">
          <h3
            id="members-quick-view-resp-heading"
            className="members-quick-view-section-title"
          >
            Responsibilities
          </h3>
          {sectionsLoading && !useExternalActivity ? (
            <p className="members-quick-view-empty">Loading…</p>
          ) : uniqueResponsibilities.length > 0 ? (
            <ul className="members-quick-view-list">
              {uniqueResponsibilities.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="members-quick-view-empty">
              No assigned responsibilities.
            </p>
          )}
        </section>

        <section aria-labelledby="members-quick-view-upcoming-heading">
          <h3
            id="members-quick-view-upcoming-heading"
            className="members-quick-view-section-title"
          >
            Upcoming
          </h3>
          {sectionsLoading && !useExternalActivity ? (
            <p className="members-quick-view-empty">Loading…</p>
          ) : upcoming ? (
            <div className="members-quick-view-upcoming">
              <p className="members-quick-view-upcoming-title">{upcoming.title}</p>
              <p className="members-quick-view-upcoming-meta">
                {[upcoming.whenLabel, upcoming.detail]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ) : (
            <p className="members-quick-view-empty">No upcoming events.</p>
          )}
        </section>

        <section aria-labelledby="members-quick-view-recent-heading">
          <h3
            id="members-quick-view-recent-heading"
            className="members-quick-view-section-title"
          >
            Recent Activity
          </h3>
          {useExternalActivity ? (
            activityItemsProp && activityItemsProp.length > 0 ? (
              <ul className="members-quick-view-activity-list">
                {activityItemsProp.map((item) => (
                  <li key={item.id} className="members-quick-view-activity-item">
                    <div className="min-w-0">
                      <p className="members-quick-view-activity-label">
                        {item.label}
                      </p>
                      {item.detail ? (
                        <p className="members-quick-view-activity-detail">
                          {item.detail}
                        </p>
                      ) : null}
                    </div>
                    {item.occurredAtLabel ? (
                      <time className="members-quick-view-activity-time">
                        {item.occurredAtLabel}
                      </time>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="members-quick-view-empty">No activity yet.</p>
            )
          ) : sectionsLoading ? (
            <p className="members-quick-view-empty">Loading…</p>
          ) : activityGroups && activityGroups.length > 0 ? (
            <div className="members-quick-view-timeline">
              {activityGroups.map((group) => (
                <div key={group.key} className="members-quick-view-day">
                  <p className="members-quick-view-day-label">{group.label}</p>
                  <ul className="members-quick-view-activity-list">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="members-quick-view-activity-item"
                      >
                        <p className="members-quick-view-activity-label">
                          {item.title}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="members-quick-view-empty">No activity yet.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
