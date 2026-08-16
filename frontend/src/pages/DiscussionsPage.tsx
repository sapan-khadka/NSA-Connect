import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { Bell, BellOff, FileText, MoreHorizontal, Users } from "lucide-react";

import { DiscussionFeed } from "../components/DiscussionFeed";
import { CreateDiscussionRoomModal } from "../components/discussions/CreateDiscussionRoomModal";
import { DiscussionRoomMembersDrawer } from "../components/discussions/DiscussionRoomMembersDrawer";
import { DiscussionRoomSidebar } from "../components/discussions/DiscussionRoomSidebar";
import { DiscussionSharedFilesDrawer } from "../components/discussions/DiscussionSharedFilesDrawer";
import { NewDirectMessageModal } from "../components/discussions/NewDirectMessageModal";
import { AppIcon } from "../components/ui/AppIcon";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  approveDiscussionRoom,
  archiveDiscussionInboxRoom,
  fetchDiscussionInbox,
  fetchDiscussionRoom,
  fetchMyDiscussionRooms,
  fetchPendingDiscussionRooms,
  markDiscussionRoomRead,
  rejectDiscussionRoom,
  toggleDiscussionRoomMute,
  toggleDiscussionRoomPin,
  toggleDiscussionRoomUserArchive,
  unarchiveDiscussionInboxRoom,
  type DiscussionArchivedRoom,
  type DiscussionInboxRoom,
  type DiscussionRoom,
} from "../lib/discussion-api";
import {
  discussionRoomIdFromPath,
  discussionRoomPath,
  discussionScopeFromPath,
} from "../lib/discussion-paths";
import { openDirectMessage } from "../lib/open-direct-message";
import { fetchAssignableMembers } from "../lib/members-api";
import { canViewTaskOversight, isRoleAtLeast } from "../lib/roles";

const INBOX_POLL_MS = 12_000;

function sortRooms(rooms: DiscussionInboxRoom[]): DiscussionInboxRoom[] {
  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);
  return [
    ...pinned.sort((a, b) => {
      if (a.room_id === "board") return -1;
      if (b.room_id === "board") return 1;
      return (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "");
    }),
    ...unpinned.sort((a, b) =>
      (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
    ),
  ];
}

function isInvalidDiscussionsDeepLink(pathname: string): boolean {
  return (
    pathname.startsWith("/discussions/") &&
    pathname !== "/discussions/board" &&
    !/^\/discussions\/event\/\d+$/.test(pathname) &&
    !/^\/discussions\/room\/\d+$/.test(pathname)
  );
}

export function DiscussionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { member } = useAuth();
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const selectedRoomId = discussionRoomIdFromPath(location.pathname);
  const selectedRoomIdRef = useRef(selectedRoomId);
  selectedRoomIdRef.current = selectedRoomId;
  const scope = discussionScopeFromPath(location.pathname);

  const canCreateGroup = member
    ? isRoleAtLeast(member.role, "board")
    : false;
  const canReviewGroups = member
    ? canViewTaskOversight(member.role, member.position)
    : false;
  const canManageArchive = canReviewGroups;

  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [, setMutingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [pendingRooms, setPendingRooms] = useState<DiscussionRoom[]>([]);
  const [awaitingRooms, setAwaitingRooms] = useState<DiscussionRoom[]>([]);
  const [pendingBusyId, setPendingBusyId] = useState<number | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeRoomDetail, setActiveRoomDetail] =
    useState<DiscussionRoom | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [archivedRooms, setArchivedRooms] = useState<DiscussionArchivedRoom[]>(
    [],
  );
  const [personalArchivedRooms, setPersonalArchivedRooms] = useState<
    DiscussionInboxRoom[]
  >([]);
  const [showArchived, setShowArchived] = useState(false);
  const [queuesVersion, setQueuesVersion] = useState(0);
  const [boardMemberCount, setBoardMemberCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAssignableMembers("board")
      .then((response) => {
        if (!cancelled) {
          setBoardMemberCount(response.total);
        }
      })
      .catch(() => {
        // Header member count is optional.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInbox(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await fetchDiscussionInbox();
        if (!cancelled) {
          // Keep the open thread cleared so polling cannot restore unread
          // while the user is actively reading it.
          const activeId = selectedRoomIdRef.current;
          setRooms(
            sortRooms(
              response.rooms.map((room) =>
                room.room_id === activeId
                  ? { ...room, unread_count: 0, unread_display: null }
                  : room,
              ),
            ),
          );
          setArchivedRooms(response.archived_rooms ?? []);
          setPersonalArchivedRooms(
            sortRooms(response.personal_archived_rooms ?? []),
          );
        }
      } catch {
        if (!cancelled && !opts?.silent) {
          setRooms([]);
          setArchivedRooms([]);
          setPersonalArchivedRooms([]);
          setError("Could not load discussions.");
        }
      } finally {
        if (!cancelled && !opts?.silent) {
          setLoading(false);
        }
      }
    }

    async function loadQueues() {
      if (!member) {
        if (!cancelled) {
          setPendingRooms([]);
          setAwaitingRooms([]);
        }
        return;
      }

      if (canReviewGroups) {
        try {
          const response = await fetchPendingDiscussionRooms();
          if (!cancelled) {
            setPendingRooms(response.rooms);
          }
        } catch {
          if (!cancelled) {
            setPendingRooms([]);
          }
        }
      } else if (!cancelled) {
        setPendingRooms([]);
      }

      if (canCreateGroup && !canReviewGroups) {
        try {
          const response = await fetchMyDiscussionRooms();
          if (!cancelled) {
            setAwaitingRooms(
              response.rooms.filter((room) => room.status === "pending"),
            );
          }
        } catch {
          if (!cancelled) {
            setAwaitingRooms([]);
          }
        }
      } else if (!cancelled) {
        setAwaitingRooms([]);
      }
    }

    void loadInbox();
    void loadQueues();

    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadInbox({ silent: true });
        void loadQueues();
      }
    }, INBOX_POLL_MS);

    function handleFocus() {
      void loadInbox({ silent: true });
      void loadQueues();
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [member, canCreateGroup, canReviewGroups, queuesVersion]);

  // Clear unread badge immediately when a room is opened (mark-read runs in feed).
  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    setRooms((current) =>
      current.map((room) =>
        room.room_id === selectedRoomId
          ? { ...room, unread_count: 0, unread_display: null }
          : room,
      ),
    );
  }, [selectedRoomId]);

  const activeCustomRoomId = scope?.type === "room" ? scope.roomId : null;

  // Prefetch custom room detail so the header can show member count / roster.
  useEffect(() => {
    if (activeCustomRoomId == null) {
      setActiveRoomDetail(null);
      setMembersOpen(false);
      return;
    }

    let cancelled = false;
    void fetchDiscussionRoom(activeCustomRoomId)
      .then((detail) => {
        if (!cancelled) {
          setActiveRoomDetail(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveRoomDetail(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCustomRoomId]);

  // Desktop: if landing on /discussions with rooms, open the first one.
  useEffect(() => {
    if (!isMdUp || loading || selectedRoomId || rooms.length === 0) {
      return;
    }
    navigate(discussionRoomPath(rooms[0].room_id), { replace: true });
  }, [isMdUp, loading, selectedRoomId, rooms, navigate]);

  async function reloadInboxSilent() {
    try {
      const response = await fetchDiscussionInbox();
      setRooms(sortRooms(response.rooms));
      setArchivedRooms(response.archived_rooms ?? []);
      setPersonalArchivedRooms(
        sortRooms(response.personal_archived_rooms ?? []),
      );
    } catch {
      // Keep existing list on silent refresh failure.
    }
  }

  async function handleUnarchiveRoom(roomId: string) {
    if (unarchivingId) {
      return;
    }
    setUnarchivingId(roomId);
    try {
      await unarchiveDiscussionInboxRoom(roomId);
      await reloadInboxSilent();
      setShowArchived(false);
      navigate(discussionRoomPath(roomId));
    } catch {
      // Keep archived list on failure.
    } finally {
      setUnarchivingId(null);
    }
  }

  async function handleToggleArchiveForMe(roomId: string) {
    const fromActive = rooms.find((room) => room.room_id === roomId) ?? null;
    const fromPersonal =
      personalArchivedRooms.find((room) => room.room_id === roomId) ?? null;
    const source = fromActive ?? fromPersonal;
    if (!source) {
      return;
    }

    const previousRooms = rooms;
    const previousPersonal = personalArchivedRooms;
    const willArchive = !source.archived_for_me;

    if (willArchive) {
      setRooms((current) =>
        current.filter((room) => room.room_id !== roomId),
      );
      setPersonalArchivedRooms((current) =>
        sortRooms([
          ...current.filter((room) => room.room_id !== roomId),
          {
            ...source,
            pinned: false,
            pinned_at: null,
            archived_for_me: true,
          },
        ]),
      );
    } else {
      setPersonalArchivedRooms((current) =>
        current.filter((room) => room.room_id !== roomId),
      );
      setRooms((current) =>
        sortRooms([
          ...current.filter((room) => room.room_id !== roomId),
          {
            ...source,
            archived_for_me: false,
          },
        ]),
      );
    }

    try {
      const result = await toggleDiscussionRoomUserArchive(roomId);
      if (result.archived_for_me) {
        await reloadInboxSilent();
      } else {
        await reloadInboxSilent();
      }
    } catch {
      setRooms(previousRooms);
      setPersonalArchivedRooms(previousPersonal);
    }
  }
  async function handleTogglePin(roomId: string) {
    const previous = rooms;
    setRooms((current) =>
      sortRooms(
        current.map((room) =>
          room.room_id === roomId
            ? {
                ...room,
                pinned: !room.pinned,
                pinned_at: room.pinned ? null : new Date().toISOString(),
              }
            : room,
        ),
      ),
    );
    setPinningId(roomId);
    try {
      const result = await toggleDiscussionRoomPin(roomId);
      setRooms((current) =>
        sortRooms(
          current.map((room) =>
            room.room_id === result.room_id
              ? {
                  ...room,
                  pinned: result.pinned,
                  pinned_at: result.pinned
                    ? (room.pinned_at ?? new Date().toISOString())
                    : null,
                }
              : room,
          ),
        ),
      );
    } catch {
      setRooms(previous);
    } finally {
      setPinningId(null);
    }
  }

  async function handleToggleMute(roomId: string) {
    const previous = rooms;
    setRooms((current) =>
      current.map((room) =>
        room.room_id === roomId ? { ...room, muted: !room.muted } : room,
      ),
    );
    setMutingId(roomId);
    try {
      const result = await toggleDiscussionRoomMute(roomId);
      setRooms((current) =>
        current.map((room) =>
          room.room_id === result.room_id
            ? { ...room, muted: result.muted }
            : room,
        ),
      );
    } catch {
      setRooms(previous);
    } finally {
      setMutingId(null);
    }
  }

  async function handleMarkRoomRead(roomId: string) {
    const previous = rooms;
    setRooms((current) =>
      current.map((room) =>
        room.room_id === roomId
          ? {
              ...room,
              unread_count: 0,
              unread_display: null,
              mentions_you: false,
              attention_preview: null,
              attention_author: null,
            }
          : room,
      ),
    );
    try {
      await markDiscussionRoomRead(roomId);
    } catch {
      setRooms(previous);
    }
  }

  async function handleApprovePending(roomId: number) {
    setPendingBusyId(roomId);
    try {
      const room = await approveDiscussionRoom(roomId);
      setPendingRooms((current) => current.filter((row) => row.id !== roomId));
      await reloadInboxSilent();
      navigate(discussionRoomPath(room.room_id));
    } catch {
      // Keep queue; user can retry.
    } finally {
      setPendingBusyId(null);
    }
  }

  async function handleRejectPending(roomId: number) {
    setPendingBusyId(roomId);
    try {
      await rejectDiscussionRoom(roomId);
      setPendingRooms((current) => current.filter((row) => row.id !== roomId));
    } catch {
      // Keep queue; user can retry.
    } finally {
      setPendingBusyId(null);
    }
  }

  async function handleArchiveRoom(roomId: string) {
    if (archiving) {
      return;
    }
    const confirmText =
      roomId === "board"
        ? "Archive Board Discussion? It will leave the Discussions list for everyone. You can unarchive it later if needed."
        : roomId.startsWith("event:")
          ? "Archive this event discussion? It will leave the Discussions list for everyone."
          : "Archive this group? Members will no longer see it in Discussions.";
    const confirmed = window.confirm(confirmText);
    if (!confirmed) {
      return;
    }
    setArchiving(true);
    try {
      await archiveDiscussionInboxRoom(roomId);
      await reloadInboxSilent();
      navigate("/discussions");
    } catch {
      // Leave thread open on failure.
    } finally {
      setArchiving(false);
    }
  }

  function handleRoomCreated(room: DiscussionRoom) {
    if (room.status === "live") {
      void reloadInboxSilent();
      navigate(discussionRoomPath(room.room_id));
      return;
    }
    setQueuesVersion((value) => value + 1);
  }

  const selectedRoom =
    rooms.find((room) => room.room_id === selectedRoomId) ??
    personalArchivedRooms.find((room) => room.room_id === selectedRoomId);
  const selectedArchived = archivedRooms.find(
    (room) => room.room_id === selectedRoomId,
  );
  const selectedPersonalArchived = Boolean(selectedRoom?.archived_for_me);
  const showList = isMdUp || !selectedRoomId;
  const showThread = isMdUp || Boolean(selectedRoomId);

  const isDmThread =
    selectedRoom?.event_type === "dm" || activeRoomDetail?.kind === "dm";
  const isGroupThread =
    scope?.type === "room" && !isDmThread && !selectedArchived;
  const memberCount = activeRoomDetail?.members.length ?? 0;

  const feedTitle =
    selectedRoom?.label ??
    selectedArchived?.label ??
    (scope?.type === "board"
      ? "Board Discussion"
      : scope?.type === "room"
        ? isDmThread
          ? (activeRoomDetail?.peer_full_name ?? "Direct message")
          : "Group"
        : "Discussion");
  const feedDescriptionLines = selectedArchived
    ? ["Archived. Messaging is closed until restored."]
    : [
        scope?.type === "board"
          ? boardMemberCount != null && boardMemberCount > 0
            ? `Board only · ${boardMemberCount} members`
            : "Board only"
          : isDmThread
            ? "Direct message"
            : isGroupThread
              ? memberCount > 0
                ? `${memberCount} member${memberCount === 1 ? "" : "s"}`
                : "Private group"
              : scope?.type === "event"
                ? "Event"
                : null,
      ].filter((line): line is string => Boolean(line));

  const introCreatedLabel = activeRoomDetail?.created_at
    ? `Created ${new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(new Date(activeRoomDetail.created_at))}`
    : undefined;

  const introVisibilityLabel =
    scope?.type === "board"
      ? "Visible to Board Members"
      : isDmThread
        ? "Private conversation"
        : isGroupThread
          ? "Visible to group members"
          : scope?.type === "event"
            ? "Visible to event members"
            : undefined;

  const canArchiveSelected = canManageArchive && Boolean(selectedRoomId);

  if (isInvalidDiscussionsDeepLink(location.pathname)) {
    return <Navigate to="/discussions" replace />;
  }

  return (
    <div className="discussions-shell -mx-4 -my-5 flex min-h-[28rem] overflow-hidden border-y border-[#F0F0EE] bg-white sm:-mx-6 sm:-my-6 lg:-mx-8 xl:-mx-10">
      {showList ? (
        <DiscussionRoomSidebar
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onTogglePin={handleTogglePin}
          onToggleMute={(roomId) => void handleToggleMute(roomId)}
          onMarkRead={(roomId) => void handleMarkRoomRead(roomId)}
          onArchiveForMe={(roomId) => void handleToggleArchiveForMe(roomId)}
          onArchiveChapter={(roomId) => void handleArchiveRoom(roomId)}
          pinDisabled={pinningId != null}
          loading={loading}
          error={error}
          canCreateGroup={canCreateGroup}
          onCreateGroup={() => setCreateOpen(true)}
          onNewMessage={() => setNewMessageOpen(true)}
          pendingRooms={pendingRooms}
          pendingBusyId={pendingBusyId}
          onApprovePending={handleApprovePending}
          onRejectPending={handleRejectPending}
          awaitingRooms={awaitingRooms}
          canManageArchive={canManageArchive}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived((value) => !value)}
          archivedRooms={archivedRooms}
          personalArchivedRooms={personalArchivedRooms}
          unarchivingId={unarchivingId}
          onUnarchiveChapter={(roomId) => void handleUnarchiveRoom(roomId)}
        />
      ) : null}

      {showThread ? (
        <div className="flex min-w-0 flex-1 flex-col">
          {scope ? (
            <DiscussionFeed
              key={selectedRoomId ?? "none"}
              title={feedTitle}
              descriptionLines={feedDescriptionLines}
              introCreatedLabel={introCreatedLabel}
              introVisibilityLabel={introVisibilityLabel}
              scope={scope}
              variant="pane"
              onBack={() => navigate("/discussions")}
              className="h-full"
              headerAction={
                <div className="relative flex items-center gap-0.5">
                  {isGroupThread || scope?.type === "board" ? (
                    <button
                      type="button"
                      aria-label={
                        scope?.type === "board"
                          ? boardMemberCount != null && boardMemberCount > 0
                            ? `View ${boardMemberCount} board members`
                            : "View board members"
                          : memberCount > 0
                            ? `View ${memberCount} members`
                            : "View members"
                      }
                      aria-pressed={membersOpen}
                      onClick={() => {
                        setFilesOpen(false);
                        setMembersOpen((open) => !open);
                      }}
                      title="Members"
                      className={[
                        "relative inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 transition",
                        membersOpen
                          ? "text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                          : "text-gray-500 hover:bg-[#F5F5F4] hover:text-foreground",
                      ].join(" ")}
                    >
                      <AppIcon icon={Users} size="sm" className="text-current" />
                      <span className="hidden text-[13px] font-medium sm:inline">
                        Members
                      </span>
                    </button>
                  ) : null}
                  {selectedRoomId && !selectedArchived ? (
                    <button
                      type="button"
                      aria-label="Shared files"
                      title="Shared files"
                      onClick={() => setFilesOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-gray-500 transition hover:bg-[#F5F5F4] hover:text-foreground"
                    >
                      <AppIcon
                        icon={FileText}
                        size="sm"
                        className="text-current"
                      />
                      <span className="hidden text-[13px] font-medium sm:inline">
                        Files
                      </span>
                    </button>
                  ) : null}
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="More actions"
                      aria-expanded={moreOpen}
                      onClick={() => setMoreOpen((open) => !open)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#F5F5F4] hover:text-foreground"
                    >
                      <AppIcon
                        icon={MoreHorizontal}
                        size="sm"
                        className="text-current"
                      />
                    </button>
                    {moreOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-md border border-[#EBEBEA] bg-white py-1 shadow-sm"
                      >
                        {selectedRoomId && !selectedArchived ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-[#F5F5F4]"
                            onClick={() => {
                              setMoreOpen(false);
                              void handleToggleMute(selectedRoomId);
                            }}
                          >
                            <AppIcon
                              icon={selectedRoom?.muted ? Bell : BellOff}
                              size="xs"
                            />
                            {selectedRoom?.muted ? "Unmute" : "Mute"}
                          </button>
                        ) : null}
                        {selectedRoomId && !selectedArchived ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-[#F5F5F4]"
                            onClick={() => {
                              setMoreOpen(false);
                              void handleToggleArchiveForMe(selectedRoomId);
                              if (!selectedPersonalArchived) {
                                navigate("/discussions");
                              } else {
                                setShowArchived(false);
                              }
                            }}
                          >
                            {selectedPersonalArchived
                              ? "Unarchive for me"
                              : "Archive for me"}
                          </button>
                        ) : null}
                        {canManageArchive &&
                        selectedRoomId &&
                        selectedArchived ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-[#F5F5F4]"
                            onClick={() => {
                              setMoreOpen(false);
                              void handleUnarchiveRoom(selectedRoomId);
                            }}
                          >
                            Unarchive for chapter
                          </button>
                        ) : canArchiveSelected &&
                          selectedRoomId &&
                          !selectedArchived &&
                          !isDmThread ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-[#F5F5F4]"
                            onClick={() => {
                              setMoreOpen(false);
                              void handleArchiveRoom(selectedRoomId);
                            }}
                          >
                            Archive for chapter
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-medium text-foreground">
                Select a conversation
              </p>
              <p className="max-w-xs text-xs text-gray-500">
                Pick a chat from the left, or start a new private message.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setNewMessageOpen(true)}
              >
                New message
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <DiscussionRoomMembersDrawer
        open={
          membersOpen &&
          (isGroupThread || scope?.type === "board")
        }
        roomId={activeCustomRoomId}
        mode={scope?.type === "board" ? "board" : "group"}
        onClose={() => setMembersOpen(false)}
        onLoaded={setActiveRoomDetail}
        onRoomUpdated={(room) => {
          setActiveRoomDetail(room);
          void reloadInboxSilent();
        }}
      />

      <DiscussionSharedFilesDrawer
        open={filesOpen && Boolean(selectedRoomId) && !selectedArchived}
        roomId={selectedRoomId}
        onClose={() => setFilesOpen(false)}
        onJumpToMessage={(messageId) => {
          const params = new URLSearchParams(location.search);
          params.set("msg", String(messageId));
          navigate(
            {
              pathname: location.pathname,
              search: params.toString(),
            },
            { replace: false },
          );
        }}
      />

      {member ? (
        <NewDirectMessageModal
          open={newMessageOpen}
          currentMemberId={member.id}
          onClose={() => setNewMessageOpen(false)}
          onSelectMember={async (memberId) => {
            await openDirectMessage(navigate, memberId);
            await reloadInboxSilent();
          }}
        />
      ) : null}

      {member && canCreateGroup ? (
        <CreateDiscussionRoomModal
          open={createOpen}
          currentMemberId={member.id}
          onClose={() => setCreateOpen(false)}
          onCreated={handleRoomCreated}
        />
      ) : null}
    </div>
  );
}
