import { useEffect, useState, type FormEvent } from "react";

import type { MemberResponse } from "../../lib/auth-api";
import { getApiErrorMessage } from "../../lib/api-error";
import { createDiscussionRoom, type DiscussionRoom } from "../../lib/discussion-api";
import { fetchAssignableMembers } from "../../lib/members-api";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type CreateDiscussionRoomModalProps = {
  open: boolean;
  currentMemberId: number;
  onClose: () => void;
  onCreated: (room: DiscussionRoom) => void;
};

export function CreateDiscussionRoomModal({
  open,
  currentMemberId,
  onClose,
  onCreated,
}: CreateDiscussionRoomModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [candidates, setCandidates] = useState<MemberResponse[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName("");
    setDescription("");
    setMemberIds([]);
    setError(null);

    let cancelled = false;
    setLoadingMembers(true);
    void fetchAssignableMembers("all_approved")
      .then((response) => {
        if (!cancelled) {
          setCandidates(
            response.members.filter((member) => member.id !== currentMemberId),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, currentMemberId]);

  function toggleMember(memberId: number) {
    setMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const room = await createDiscussionRoom({
        name: trimmedName,
        description: description.trim() || undefined,
        member_ids: memberIds,
      });
      onCreated(room);
      onClose();
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not create group."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="New discussion group" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Board members can propose groups. President or VP approval is required
          before the room goes live (auto-approved if you are Pres/VP).
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            autoFocus
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            placeholder="e.g. Fundraising Committee"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Description <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            rows={2}
            className="resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            placeholder="What is this group for?"
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-foreground">
            Members <span className="font-normal text-gray-400">(optional)</span>
          </legend>
          {loadingMembers ? (
            <p className="text-sm text-gray-500">Loading members…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-gray-500">No other members available.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {candidates.map((member) => {
                const checked = memberIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(member.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {member.full_name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        {error ? (
          <p className="text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!name.trim()}
          >
            Propose group
          </Button>
        </div>
      </form>
    </Modal>
  );
}
