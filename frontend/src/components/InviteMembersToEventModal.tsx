import { useEffect, useMemo, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import { inviteEventParticipants } from "../lib/events-api";
import { fetchMembers, type PaginatedMembersResponse } from "../lib/members-api";
import type { MemberResponse } from "../lib/auth-api";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { inputFieldClassName } from "./ui/Input";

type InviteMembersToEventModalProps = {
  open: boolean;
  eventId: number;
  eventName: string;
  alreadyInvitedMemberIds?: number[];
  onClose: () => void;
  onInvited?: () => void;
};

export function InviteMembersToEventModal({
  open,
  eventId,
  eventName,
  alreadyInvitedMemberIds = [],
  onClose,
  onInvited,
}: InviteMembersToEventModalProps) {
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const invitedSet = useMemo(
    () => new Set(alreadyInvitedMemberIds),
    [alreadyInvitedMemberIds],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSelectedIds(new Set());
    setQuery("");

    fetchMembers({ page: 1, page_size: 100, status: "approved" })
      .then((response: PaginatedMembersResponse) => {
        if (!cancelled) {
          setMembers(response.members);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return members.filter((member) => {
      if (invitedSet.has(member.id)) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        member.full_name.toLowerCase().includes(normalized) ||
        member.email.toLowerCase().includes(normalized)
      );
    });
  }, [invitedSet, members, query]);

  function toggleMember(memberId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  async function handleInvite() {
    if (selectedIds.size === 0) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const memberIds = Array.from(selectedIds);
      await inviteEventParticipants(eventId, memberIds);
      setSuccessMessage(
        `Invited ${memberIds.length} member${memberIds.length === 1 ? "" : "s"}.`,
      );
      setSelectedIds(new Set());
      onInvited?.();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Invite participants" onClose={onClose} size="md">
      <p className="text-sm text-gray-600">
        Invite approved members to participate in{" "}
        <span className="font-medium text-foreground">{eventName}</span>.
      </p>

      <label className="mt-4 block">
        <span className="sr-only">Search members</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          className={inputFieldClassName}
        />
      </label>

      {error ? (
        <p role="alert" className="mt-3 ds-field-error">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-gray-100">
        {isLoading ? (
          <p className="px-3 py-4 text-sm text-gray-500">Loading members…</p>
        ) : filteredMembers.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">
            No members available to invite.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredMembers.map((member) => {
              const checked = selectedIds.has(member.id);
              return (
                <li key={member.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(member.id)}
                      className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {member.full_name}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {member.email}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          loading={isSubmitting}
          disabled={selectedIds.size === 0 || isSubmitting}
          onClick={() => void handleInvite()}
        >
          {selectedIds.size === 0
            ? "Invite"
            : `Invite ${selectedIds.size}`}
        </Button>
      </div>
    </Modal>
  );
}
