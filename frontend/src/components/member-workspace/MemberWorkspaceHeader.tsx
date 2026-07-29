/**
 * Member Workspace Hero — GitHub / Linear / Slack-style member overview.
 * Answers “Who is this member?” using only real MemberResponse fields.
 */

import {
  ChevronLeft,
  Copy,
  KeyRound,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Shield,
  Trash2,
  UserX,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Avatar } from "../../design-system/components/Avatar";
import { useAuth } from "../../context/useAuth";
import type { MemberResponse } from "../../lib/auth-api";
import { getApiErrorMessage } from "../../lib/api-error";
import { memberMailtoHref } from "../../lib/member-mailto";
import { openDirectMessage } from "../../lib/open-direct-message";
import {
  canViewMemberDirectory,
  formatRoleLabel,
  isMemberRole,
} from "../../lib/roles";
import { EditMemberDrawer } from "../EditMemberDrawer";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

const MISSING = "—";

type MemberWorkspaceHeaderProps = {
  member: MemberResponse;
  /** Optional committee label from a real source only — omit when unknown. */
  committee?: string | null;
  /** Optional joined date label from a real source only — omit → "—". */
  joinedAtLabel?: string | null;
  backTo?: string;
  backLabel?: string;
  /** Keep parent workspace profile in sync after Edit Member saves. */
  onMemberUpdated?: (member: MemberResponse) => void;
};

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : MISSING;
}

function statusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  const map: Record<string, string> = {
    approved: "Active",
    pending: "Pending",
    alumni: "Alumni",
    inactive: "Inactive",
    rejected: "Inactive",
  };
  return (
    map[normalized] ??
    (status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : MISSING)
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to legacy copy.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function MemberWorkspaceHeader({
  member,
  committee = null,
  joinedAtLabel = null,
  backTo = "/members",
  backLabel = "Members",
  onMemberUpdated,
}: MemberWorkspaceHeaderProps) {
  const navigate = useNavigate();
  const { member: currentMember } = useAuth();
  const menuId = useId();
  const moreRootRef = useRef<HTMLDivElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const committeeLabel = committee?.trim() || null;
  const graduationLabel = member.graduation_year
    ? String(member.graduation_year)
    : null;
  const mailtoHref = memberMailtoHref(member.email);
  const canEdit = Boolean(
    currentMember && canViewMemberDirectory(currentMember.role),
  );
  const isSelf = currentMember?.id === member.id;
  const roleLabel = isMemberRole(member.role)
    ? formatRoleLabel(member.role)
    : member.role;
  const emailValue = member.email?.trim() || null;
  const hasCommunication =
    !isSelf || Boolean(mailtoHref) || Boolean(emailValue);
  const hasMenuContent = hasCommunication || canEdit;

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        moreRootRef.current &&
        event.target instanceof Node &&
        !moreRootRef.current.contains(event.target)
      ) {
        setMoreOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
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

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }
    const timer = window.setTimeout(() => setCopyFeedback(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  async function handleMessage() {
    if (isSelf || messageLoading) {
      return;
    }
    setMoreOpen(false);
    setMessageLoading(true);
    try {
      await openDirectMessage(navigate, member.id);
    } catch (error) {
      window.alert(getApiErrorMessage(error));
    } finally {
      setMessageLoading(false);
    }
  }

  async function handleCopyEmail() {
    if (!emailValue) {
      return;
    }
    const ok = await copyText(emailValue);
    setMoreOpen(false);
    setCopyFeedback(ok ? "Copied" : "Copy failed");
  }

  return (
    <div className="member-workspace-header-inner">
      <Link to={backTo} className="member-workspace-back">
        <AppIcon icon={ChevronLeft} size="sm" className="text-current" />
        {backLabel}
      </Link>

      <div className="member-workspace-header-main">
        <Avatar
          name={member.full_name}
          src={member.avatar_url}
          size="lg"
          className="member-workspace-avatar"
        />

        <div className="member-workspace-header-copy">
          <h1 className="member-workspace-name">{member.full_name}</h1>

          <p className="member-workspace-identity-line">
            <span>{roleLabel}</span>
            <span className="member-workspace-identity-sep" aria-hidden="true">
              ·
            </span>
            <span>{statusLabel(member.status)}</span>
            {committeeLabel ? (
              <>
                <span
                  className="member-workspace-identity-sep"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span>{committeeLabel}</span>
              </>
            ) : null}
          </p>

          <ul
            className="member-workspace-meta-compact"
            aria-label="Member details"
          >
            <li>{displayValue(member.email)}</li>
            {graduationLabel ? <li>Class of {graduationLabel}</li> : null}
            <li>Joined {displayValue(joinedAtLabel)}</li>
          </ul>
        </div>

        <div
          className="member-workspace-hero-actions"
          role="group"
          aria-label="Member actions"
        >
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="member-workspace-edit-btn"
              aria-label="Edit Member"
              onClick={() => setEditOpen(true)}
            >
              Edit Member
            </Button>
          ) : null}

          {hasMenuContent ? (
            <div ref={moreRootRef} className="member-workspace-more">
              <button
                type="button"
                className="member-workspace-more-btn"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-controls={moreOpen ? menuId : undefined}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <AppIcon
                  icon={MoreHorizontal}
                  size="sm"
                  className="text-current"
                />
              </button>

              {moreOpen ? (
                <div
                  id={menuId}
                  role="menu"
                  className="member-workspace-more-menu"
                >
                  {hasCommunication ? (
                    <div className="member-workspace-more-group">
                      <p className="member-workspace-more-label">
                        Communication
                      </p>
                      {!isSelf ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="member-workspace-more-item"
                          disabled={messageLoading}
                          onClick={() => {
                            void handleMessage();
                          }}
                        >
                          <AppIcon
                            icon={MessageSquare}
                            size="xs"
                            className="text-current"
                          />
                          {messageLoading ? "Opening…" : "Message"}
                        </button>
                      ) : null}
                      {mailtoHref ? (
                        <a
                          href={mailtoHref}
                          role="menuitem"
                          className="member-workspace-more-item"
                          onClick={() => setMoreOpen(false)}
                        >
                          <AppIcon
                            icon={Mail}
                            size="xs"
                            className="text-current"
                          />
                          Email
                        </a>
                      ) : null}
                      {emailValue ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="member-workspace-more-item"
                          onClick={() => {
                            void handleCopyEmail();
                          }}
                        >
                          <AppIcon
                            icon={Copy}
                            size="xs"
                            className="text-current"
                          />
                          Copy email
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {canEdit ? (
                    <div className="member-workspace-more-group">
                      <p className="member-workspace-more-label">Member</p>
                      <button
                        type="button"
                        role="menuitem"
                        className="member-workspace-more-item"
                        disabled
                        title="Coming Soon"
                      >
                        <AppIcon
                          icon={Shield}
                          size="xs"
                          className="text-current"
                        />
                        Change role
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="member-workspace-more-item"
                        disabled
                        title="Coming Soon"
                      >
                        <AppIcon
                          icon={KeyRound}
                          size="xs"
                          className="text-current"
                        />
                        Reset password
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="member-workspace-more-item"
                        disabled
                        title="Coming Soon"
                      >
                        <AppIcon
                          icon={UserX}
                          size="xs"
                          className="text-current"
                        />
                        Archive member
                      </button>
                    </div>
                  ) : null}

                  {canEdit ? (
                    <div className="member-workspace-more-group member-workspace-more-group--danger">
                      <p className="member-workspace-more-label">Danger</p>
                      <button
                        type="button"
                        role="menuitem"
                        className="member-workspace-more-item member-workspace-more-item--danger"
                        disabled
                        title="Coming Soon"
                      >
                        <AppIcon
                          icon={Trash2}
                          size="xs"
                          className="text-current"
                        />
                        Delete member
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {copyFeedback ? (
            <p className="member-workspace-copy-feedback" role="status">
              {copyFeedback}
            </p>
          ) : (
            <p className="sr-only" role="status" aria-live="polite" />
          )}
        </div>
      </div>

      {canEdit ? (
        <EditMemberDrawer
          member={member}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onMemberUpdated={(updated) => {
            onMemberUpdated?.(updated);
          }}
        />
      ) : null}
    </div>
  );
}
