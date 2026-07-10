import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { MemberDirectory } from "../components/MemberDirectory";
import { PageHeader } from "../components/PageHeader";
import { PendingApprovals } from "../components/PendingApprovals";
import { useAuth } from "../context/useAuth";
import { canViewMemberDirectory } from "../lib/roles";

type MembersTab = "directory" | "pending";

const TAB_LABELS: Record<MembersTab, string> = {
  directory: "Directory",
  pending: "Pending approvals",
};

function parseTab(value: string | null, canManagePending: boolean): MembersTab {
  if (canManagePending && value === "pending") {
    return "pending";
  }
  return "directory";
}

export function MembersPage() {
  const { member } = useAuth();
  const canManagePending = member ? canViewMemberDirectory(member.role) : false;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = useMemo(
    () => parseTab(searchParams.get("tab"), canManagePending),
    [searchParams, canManagePending],
  );
  const [activeTab, setActiveTab] = useState<MembersTab>(initialTab);

  function switchTab(tab: MembersTab) {
    setActiveTab(tab);
    setSearchParams(tab === "pending" ? { tab: "pending" } : {});
  }

  return (
    <div className="space-y-0 lg:space-y-6">
      <div className="ds-mobile-edge-section lg:px-0 lg:py-0">
        <PageHeader
          eyebrow="Community"
          title="Members"
          description={
            canManagePending
              ? "Browse talents for program planning, approve new signups, and manage membership."
              : "Browse member talents and interests to connect for cultural programs."
          }
        />
      </div>

      {canManagePending ? (
        <div className="ds-mobile-edge-section flex gap-2 border-b border-gray-200 lg:border-surface-card lg:px-0">
          {(Object.keys(TAB_LABELS) as MembersTab[]).map((tab) => {
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={[
                  "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-label hover:text-accent",
                ].join(" ")}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>
      ) : null}

      {activeTab === "directory" || !canManagePending ? (
        <MemberDirectory />
      ) : (
        <PendingApprovals />
      )}
    </div>
  );
}
