import { useCallback, useEffect, useState } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  approveMember,
  fetchPendingMembers,
  rejectMember,
} from "../lib/members-api";

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
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-primary">Approval queue</h2>
        <p className="mt-1 text-sm text-gray-500">
          {isLoading
            ? "Loading pending members..."
            : pendingMembers.length === 0
              ? "All caught up — no signups waiting for review."
              : `${pendingMembers.length} signup${pendingMembers.length === 1 ? "" : "s"} waiting — click Approve to grant access.`}
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="px-6 py-8 text-sm text-gray-500">Loading...</p>
      ) : pendingMembers.length === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-500">
          No pending signups right now.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {pendingMembers.map((member) => {
            const isActing = actionMemberId === member.id;
            const isApproving = approvingMemberId === member.id;

            return (
              <li
                key={member.id}
                className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-primary">{member.full_name}</p>
                  <p className="mt-1 text-sm text-gray-600">{member.email}</p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-gray-500">Student ID</dt>
                      <dd className="font-medium text-primary">
                        {member.student_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Major</dt>
                      <dd className="font-medium text-primary">{member.major}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Graduation</dt>
                      <dd className="font-medium text-primary">
                        {member.graduation_year}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex shrink-0 gap-3">
                  {showReject && (
                    <button
                      type="button"
                      onClick={() => void handleReject(member.id)}
                      disabled={isActing}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleApprove(member.id)}
                    disabled={isActing}
                    aria-label={`Approve ${member.full_name}`}
                    className="min-w-[7.5rem] rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApproving ? "Approving..." : "Approve"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
