/**
 * WhatsApp-style contact picker — start a private DM from Discussions.
 */

import { MessageSquare, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "../../design-system/components/Avatar";
import type { MemberResponse } from "../../lib/auth-api";
import { getApiErrorMessage } from "../../lib/api-error";
import { fetchMembers } from "../../lib/members-api";
import { AppIcon } from "../ui/AppIcon";
import { Modal } from "../ui/Modal";

type NewDirectMessageModalProps = {
  open: boolean;
  currentMemberId: number;
  onClose: () => void;
  onSelectMember: (memberId: number) => Promise<void> | void;
};

export function NewDirectMessageModal({
  open,
  currentMemberId,
  onClose,
  onSelectMember,
}: NewDirectMessageModalProps) {
  const [contacts, setContacts] = useState<MemberResponse[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setError(null);
    setStartingId(null);

    let cancelled = false;
    setLoading(true);
    void fetchMembers({ page: 1, page_size: 100 })
      .then(async (first) => {
        if (cancelled) {
          return;
        }
        let members = first.members.filter(
          (member) => member.id !== currentMemberId,
        );
        const totalPages = first.total_pages ?? 1;
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              fetchMembers({ page: index + 2, page_size: 100 }),
            ),
          );
          if (cancelled) {
            return;
          }
          for (const page of rest) {
            members = members.concat(
              page.members.filter((member) => member.id !== currentMemberId),
            );
          }
        }
        members.sort((a, b) =>
          a.full_name.localeCompare(b.full_name, undefined, {
            sensitivity: "base",
          }),
        );
        setContacts(members);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setContacts([]);
          setError(getApiErrorMessage(caught, "Could not load members."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, currentMemberId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return contacts;
    }
    return contacts.filter((member) => {
      const haystack = `${member.full_name} ${member.email ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [contacts, query]);

  async function handleSelect(memberId: number) {
    if (startingId != null) {
      return;
    }
    setStartingId(memberId);
    setError(null);
    try {
      await onSelectMember(memberId);
      onClose();
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not start message."));
    } finally {
      setStartingId(null);
    }
  }

  return (
    <Modal open={open} title="New message" onClose={onClose} size="md">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          Choose a member to start a private conversation.
        </p>

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
            autoFocus
            placeholder="Search by name or email"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>

        {error ? (
          <p className="text-sm text-[var(--status-danger-text)]" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-y-contain rounded-lg border border-gray-100"
          role="listbox"
          aria-label="Members"
        >
          {loading ? (
            <p className="px-3 py-4 text-sm text-gray-500">Loading members…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-500">
              {query.trim() ? "No members match that search." : "No members found."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={startingId === member.id}
                    disabled={startingId != null}
                    onClick={() => {
                      void handleSelect(member.id);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    <Avatar
                      name={member.full_name}
                      memberId={member.id}
                      size="md"
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {member.full_name}
                      </span>
                      {member.email?.trim() ? (
                        <span className="block truncate text-xs text-gray-500">
                          {member.email.trim()}
                        </span>
                      ) : null}
                    </span>
                    <AppIcon
                      icon={MessageSquare}
                      size="xs"
                      className="shrink-0 text-gray-400"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
