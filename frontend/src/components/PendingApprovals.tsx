/**
 * Premium membership review queue — Linear/Rippling-style approval rows.
 * Used on Members (Needs attention) and Board Dashboard.
 */

import { Check, UserRoundX, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { Skeleton } from "../design-system/components/Skeleton";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  approveMember,
  fetchPendingMembers,
  rejectMember,
} from "../lib/members-api";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

type PendingApprovalsProps = {
  onCountChange?: (count: number) => void;
  /** Called after a successful approve/reject so parents can refresh directories. */
  onQueueChanged?: () => void;
  showReject?: boolean;
};

function PendingRowSkeleton() {
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3">
        <Skeleton height={44} width={44} variant="circular" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton height={14} width="40%" />
          <Skeleton height={12} width="55%" />
        </div>
        <Skeleton height={36} width={96} />
      </div>
    </li>
  );
}

export function PendingApprovals({
  onCountChange,
  onQueueChanged,
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
      onQueueChanged?.();
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
      onQueueChanged?.();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setActionMemberId(null);
    }
  }

  return (
    <section
      aria-label="Membership reviews"
      className="overflow-hidden rounded-2xl border border-gray-200 bg-surface-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Membership reviews
          </h2>
          <p className="mt-0.5 text-xs text-label sm:text-sm">
            {isLoading
              ? "Loading pending members…"
              : pendingMembers.length === 0
                ? "All caught up — no signups waiting for review."
                : `${pendingMembers.length} signup${pendingMembers.length === 1 ? "" : "s"} waiting for approval.`}
          </p>
        </div>
        {!isLoading && pendingMembers.length > 0 ? (
          <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-overdue-surface px-2.5 text-xs font-semibold tabular-nums text-overdue">
            {pendingMembers.length}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mx-4 mt-4 ds-alert-banner sm:mx-5">{error}</div>
      ) : null}

      {isLoading ? (
        <ul className="divide-y divide-gray-100" aria-busy="true">
          <PendingRowSkeleton />
          <PendingRowSkeleton />
        </ul>
      ) : pendingMembers.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-badge-teal-bg text-primary">
            <AppIcon icon={Users} size="sm" className="text-current" />
          </span>
          <p className="mt-3 text-sm font-medium text-foreground">
            Inbox zero for memberships
          </p>
          <p className="mt-1 max-w-xs text-xs text-label">
            New signups will show up here with Approve and Reject actions.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {pendingMembers.map((member) => {
            const isActing = actionMemberId === member.id;
            const isApproving = approvingMemberId === member.id;

            return (
              <li
                key={member.id}
                className="px-4 py-4 transition-colors hover:bg-surface-muted/50 sm:px-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar
                      name={member.full_name}
                      size="md"
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/members/${member.id}`}
                          className="truncate text-sm font-semibold text-foreground hover:text-primary"
                        >
                          {member.full_name}
                        </Link>
                        <span className="members-table-status-pill members-table-status-pill--pending">
                          <span
                            className="members-table-status-dot"
                            aria-hidden="true"
                          />
                          Pending
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-label">
                        {member.email}
                      </p>
                      <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-label">
                        <span>{member.major || "Major —"}</span>
                        <span aria-hidden="true" className="text-label/40">
                          ·
                        </span>
                        <span className="tabular-nums">
                          Class of {member.graduation_year || "—"}
                        </span>
                        {member.student_id ? (
                          <>
                            <span aria-hidden="true" className="text-label/40">
                              ·
                            </span>
                            <span className="tabular-nums">
                              {member.student_id}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:pl-3">
                    {showReject ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleReject(member.id)}
                        disabled={isActing}
                        aria-label={`Reject ${member.full_name}`}
                      >
                        <AppIcon
                          icon={UserRoundX}
                          size="xs"
                          className="text-current"
                        />
                        Reject
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => void handleApprove(member.id)}
                      disabled={isActing}
                      loading={isApproving}
                      aria-label={`Approve ${member.full_name}`}
                      className="min-w-[7rem]"
                    >
                      {!isApproving ? (
                        <AppIcon
                          icon={Check}
                          size="xs"
                          className="text-current"
                        />
                      ) : null}
                      Approve
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
