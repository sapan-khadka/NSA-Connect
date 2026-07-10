import { useCallback, useEffect, useState } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  approveMember,
  fetchPendingMembers,
  rejectMember,
} from "../lib/members-api";

import { MemberCard } from "./MemberCard";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

type PendingApprovalsProps = {
  onCountChange?: (count: number) => void;
  showReject?: boolean;
};

export function PendingApprovals({
  onCountChange,
  showReject = true,
}: PendingApprovalsProps) {
  const [pendingMembers, setPendingMembers] = useState<MemberResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMemberId, setActionMemberId] = useState<number | null>(null);
  const [approvingMemberId, setApprovingMemberId] = useState<number | null>(
    null,
  );

  const loadPendingMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchPendingMembers();
      setPendingMembers(data.members);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPendingMembers();
  }, [loadPendingMembers]);

  useEffect(() => {
    if (!isLoading) {
      onCountChange?.(pendingMembers.length);
    }
  }, [onCountChange, pendingMembers.length, isLoading]);

  async function handleApprove(memberId: number) {
    setActionMemberId(memberId);
    setApprovingMemberId(memberId);
    setError(null);

    try {
      await approveMember(memberId);
      setPendingMembers((current) =>
        current.filter((member) => member.id !== memberId),
      );
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setActionMemberId(null);
      setApprovingMemberId(null);
    }
  }

  async function handleReject(memberId: number) {
    setActionMemberId(memberId);
    setError(null);

    try {
      await rejectMember(memberId);
      setPendingMembers((current) =>
        current.filter((member) => member.id !== memberId),
      );
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setActionMemberId(null);
    }
  }

  return (
    <Card padding="none">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">Approval queue</h2>
        <p className="mt-1 text-sm text-label">
          {isLoading
            ? "Loading pending members..."
            : pendingMembers.length === 0
              ? "All caught up — no signups waiting for review."
              : `${pendingMembers.length} signup${pendingMembers.length === 1 ? "" : "s"} waiting — click Approve to grant access.`}
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 ds-alert-banner">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="px-6 py-8 text-sm text-label">Loading...</p>
      ) : pendingMembers.length === 0 ? (
        <p className="px-6 py-8 text-sm text-label">
          No pending signups right now.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {pendingMembers.map((member) => {
            const isActing = actionMemberId === member.id;
            const isApproving = approvingMemberId === member.id;

            return (
              <li key={member.id} className="px-6 py-5">
                <MemberCard
                  member={member}
                  actions={
                    <>
                      {showReject && (
                        <button
                          type="button"
                          onClick={() => void handleReject(member.id)}
                          disabled={isActing}
                          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject
                        </button>
                      )}
                      <Button
                        type="button"
                        onClick={() => void handleApprove(member.id)}
                        disabled={isActing}
                        loading={isApproving}
                        aria-label={`Approve ${member.full_name}`}
                        className="min-w-[7.5rem]"
                      >
                        Approve
                      </Button>
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
