/**
 * Members side panel — search, role sections, online dots, invite.
 * Matches the Telegram-style roster mockup.
 */

import { Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Avatar } from "../../design-system/components/Avatar";
import { Drawer } from "../../design-system/components/feedback/Drawer";
import { useAuth } from "../../context/useAuth";
import { getApiErrorMessage } from "../../lib/api-error";
import type { MemberResponse } from "../../lib/auth-api";
import {
  addDiscussionRoomMembers,
  fetchDiscussionPresence,
  fetchDiscussionRoom,
  type DiscussionRoom,
} from "../../lib/discussion-api";
import { fetchAssignableMembers } from "../../lib/members-api";
import { openDirectMessage } from "../../lib/open-direct-message";
import {
  formatMemberPositionLabel,
  isRoleAtLeast,
  type MemberPosition,
  type MemberRole,
} from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type DiscussionRoomMembersDrawerProps = {
  open: boolean;
  roomId: number | null;
  mode?: "group" | "board";
  onClose: () => void;
  onLoaded?: (room: DiscussionRoom) => void;
  onRoomUpdated?: (room: DiscussionRoom) => void;
};

type RosterEntry = {
  id: number;
  full_name: string;
  roleLabel: string;
  section: "ADMIN" | "OFFICER" | "MEMBER";
};

type SectionKey = RosterEntry["section"];

const SECTION_ORDER: SectionKey[] = ["ADMIN", "OFFICER", "MEMBER"];

function sectionForMember(member: {
  role: MemberRole;
  position: MemberPosition;
  custom_board_position?: { name: string } | null;
}): SectionKey {
  if (
    member.role === "president" ||
    member.position === "president" ||
    member.position === "vice_president"
  ) {
    return "ADMIN";
  }
  if (
    member.role === "treasurer" ||
    member.role === "board" ||
    member.position === "treasurer" ||
    member.position === "secretary" ||
    member.position === "event_manager" ||
    member.position === "public_relations_officer" ||
    member.position === "new_student_representative" ||
    Boolean(member.custom_board_position)
  ) {
    return "OFFICER";
  }
  return "MEMBER";
}

function roleLabelForMember(member: MemberResponse): string {
  if (member.position === "president" || member.role === "president") {
    return "President";
  }
  if (member.position === "vice_president") {
    return "Vice President";
  }
  if (
    member.position !== "member" ||
    member.custom_board_position ||
    member.role === "board" ||
    member.role === "treasurer"
  ) {
    const label = formatMemberPositionLabel(member);
    if (label === "Member" && (member.role === "board" || member.role === "treasurer")) {
      return "Officer";
    }
    return label === "Member" ? "Officer" : label;
  }
  return "Member";
}

export function DiscussionRoomMembersDrawer({
  open,
  roomId,
  mode = "group",
  onClose,
  onLoaded,
  onRoomUpdated,
}: DiscussionRoomMembersDrawerProps) {
  const navigate = useNavigate();
  const { member: currentMember } = useAuth();
  const [room, setRoom] = useState<DiscussionRoom | null>(null);
  const [directory, setDirectory] = useState<MemberResponse[]>([]);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [messagingId, setMessagingId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const isBoardMode = mode === "board";

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery("");
    setInviteOpen(false);
    setSelectedIds([]);
    setInviteError(null);

    async function load() {
      try {
        if (isBoardMode) {
          const response = await fetchAssignableMembers("all_approved");
          if (cancelled) {
            return;
          }
          setDirectory(response.members);
          setRoom(null);
          const online = await fetchDiscussionPresence(
            response.members.map((row) => row.id),
          );
          if (!cancelled) {
            setOnlineMap(online);
          }
          return;
        }

        if (roomId == null) {
          return;
        }

        const [detail, assignees] = await Promise.all([
          fetchDiscussionRoom(roomId),
          fetchAssignableMembers("all_approved").catch(() => ({
            members: [] as MemberResponse[],
            total: 0,
          })),
        ]);
        if (cancelled) {
          return;
        }
        setRoom(detail);
        onLoaded?.(detail);
        setDirectory(assignees.members);
        const online = await fetchDiscussionPresence(
          detail.members.map((row) => row.member_id),
        );
        if (!cancelled) {
          setOnlineMap(online);
        }
      } catch (caught: unknown) {
        if (!cancelled) {
          setDirectory([]);
          setRoom(null);
          setError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, roomId, isBoardMode, onLoaded]);

  const isBoard = Boolean(
    currentMember && isRoleAtLeast(currentMember.role, "board"),
  );
  const isOwner = Boolean(
    currentMember &&
      room?.members.some(
        (row) =>
          row.member_id === currentMember.id && row.role === "owner",
      ),
  );
  const canInvite =
    !isBoardMode &&
    (room?.kind ?? "group") === "group" &&
    (isOwner || isBoard);

  const roster: RosterEntry[] = useMemo(() => {
    if (isBoardMode) {
      return directory.map((member) => ({
        id: member.id,
        full_name: member.full_name,
        roleLabel: roleLabelForMember(member),
        section: sectionForMember(member),
      }));
    }

    const byId = new Map(directory.map((member) => [member.id, member]));
    return (room?.members ?? []).map((row) => {
      const profile = byId.get(row.member_id);
      if (profile) {
        return {
          id: row.member_id,
          full_name: row.full_name,
          roleLabel:
            row.role === "owner" ? "Owner" : roleLabelForMember(profile),
          section:
            row.role === "owner" ? "ADMIN" : sectionForMember(profile),
        };
      }
      return {
        id: row.member_id,
        full_name: row.full_name,
        roleLabel: row.role === "owner" ? "Owner" : "Member",
        section: row.role === "owner" ? "ADMIN" : "MEMBER",
      };
    });
  }, [directory, isBoardMode, room?.members]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return roster;
    }
    return roster.filter(
      (entry) =>
        entry.full_name.toLowerCase().includes(needle) ||
        entry.roleLabel.toLowerCase().includes(needle),
    );
  }, [roster, query]);

  const sections = useMemo(() => {
    return SECTION_ORDER.map((key) => ({
      key,
      entries: filtered
        .filter((entry) => entry.section === key)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    })).filter((section) => section.entries.length > 0);
  }, [filtered]);

  const existingIds = useMemo(
    () => new Set((room?.members ?? []).map((row) => row.member_id)),
    [room?.members],
  );

  const inviteCandidates = useMemo(
    () =>
      directory.filter(
        (candidate) =>
          !existingIds.has(candidate.id) &&
          candidate.id !== currentMember?.id,
      ),
    [directory, existingIds, currentMember?.id],
  );

  async function handleMessage(peerId: number) {
    if (
      !currentMember ||
      peerId === currentMember.id ||
      messagingId != null
    ) {
      return;
    }
    setMessagingId(peerId);
    try {
      onClose();
      await openDirectMessage(navigate, peerId);
    } catch (messageError) {
      window.alert(getApiErrorMessage(messageError));
    } finally {
      setMessagingId(null);
    }
  }

  async function handleInvite() {
    if (roomId == null || selectedIds.length === 0) {
      return;
    }
    setInviteBusy(true);
    setInviteError(null);
    try {
      const updated = await addDiscussionRoomMembers(roomId, selectedIds);
      setRoom(updated);
      onLoaded?.(updated);
      onRoomUpdated?.(updated);
      setSelectedIds([]);
      setInviteOpen(false);
    } catch (caught) {
      setInviteError(getApiErrorMessage(caught));
    } finally {
      setInviteBusy(false);
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
      title="Members"
      className="discussion-room-members-drawer !max-w-[20rem]"
      footer={
        canInvite ? (
          <div className="w-full space-y-2">
            {inviteOpen ? (
              <div className="rounded-xl border border-[#EBEBEA] bg-[#FAFAFA] p-3">
                {inviteCandidates.length === 0 ? (
                  <p className="text-[12px] text-gray-500">
                    No other approved members to invite.
                  </p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {inviteCandidates.map((candidate) => {
                      const checked = selectedIds.includes(candidate.id);
                      return (
                        <li key={candidate.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-white">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedIds((current) =>
                                  checked
                                    ? current.filter((id) => id !== candidate.id)
                                    : [...current, candidate.id],
                                );
                              }}
                            />
                            <span className="truncate text-[13px] text-foreground">
                              {candidate.full_name}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {inviteError ? (
                  <p className="mt-2 text-[11px] text-overdue" role="alert">
                    {inviteError}
                  </p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setInviteOpen(false);
                      setSelectedIds([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={selectedIds.length === 0 || inviteBusy}
                    loading={inviteBusy}
                    onClick={() => {
                      void handleInvite();
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E4E4E3] bg-white px-3 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-[#F7F7F6]"
              >
                <AppIcon icon={UserPlus} size="xs" className="text-current" />
                Invite members
              </button>
            )}
          </div>
        ) : isBoardMode ? (
          <p className="w-full text-center text-[11px] text-gray-400">
            Board access is managed by role in Members
          </p>
        ) : null
      }
    >
      {loading ? (
        <p className="py-8 text-sm text-gray-500">Loading members…</p>
      ) : error ? (
        <p className="py-8 text-sm text-overdue" role="alert">
          {error}
        </p>
      ) : (
        <div className="flex h-full flex-col gap-4">
          <label className="relative block">
            <span className="sr-only">Search members</span>
            <AppIcon
              icon={Search}
              size="xs"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members"
              data-drawer-initial-focus
              className="w-full rounded-full border-0 bg-[#F3F3F2] py-2 pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-gray-400 focus:bg-[#EBEBEA]"
            />
          </label>

          {sections.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">No members found.</p>
          ) : (
            <div className="space-y-5">
              {sections.map((section) => (
                <section key={section.key}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    {section.key} — {section.entries.length}
                  </h3>
                  <ul className="space-y-0.5" aria-label={`${section.key} members`}>
                    {section.entries.map((entry) => {
                      const isSelf = currentMember?.id === entry.id;
                      const online = Boolean(onlineMap[String(entry.id)]);
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            disabled={isSelf || messagingId != null}
                            aria-label={
                              isSelf
                                ? `${entry.full_name} (you)`
                                : `Message ${entry.full_name}`
                            }
                            onClick={() => {
                              void handleMessage(entry.id);
                            }}
                            className={[
                              "flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left transition",
                              isSelf
                                ? "cursor-default"
                                : "hover:bg-[#F5F5F4] disabled:opacity-60",
                            ].join(" ")}
                          >
                            <Avatar
                              name={entry.full_name}
                              memberId={entry.id}
                              size="md"
                              tone="colorful"
                              className="!h-10 !w-10 !text-[12px] !font-bold"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-foreground">
                                {entry.full_name}
                                {isSelf ? (
                                  <span className="ml-1.5 text-[12px] font-normal text-gray-400">
                                    You
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-gray-500">
                                <span className="truncate">{entry.roleLabel}</span>
                                {online ? (
                                  <span
                                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                                    title="Online"
                                    aria-label="Online"
                                  />
                                ) : null}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
