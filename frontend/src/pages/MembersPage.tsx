import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { MemberDirectory } from "../components/MemberDirectory";
import { PageHeader } from "../components/PageHeader";
import { PendingApprovals } from "../components/PendingApprovals";

type MembersTab = "directory" | "pending";

const TAB_LABELS: Record<MembersTab, string> = {
  directory: "Directory",
  pending: "Pending approvals",
};

function parseTab(value: string | null): MembersTab {
  return value === "directory" ? "directory" : "pending";
}

export function MembersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = useMemo(
    () => parseTab(searchParams.get("tab")),
    [searchParams],
  );
  const [activeTab, setActiveTab] = useState<MembersTab>(initialTab);

  function switchTab(tab: MembersTab) {
    setActiveTab(tab);
    setSearchParams(tab === "pending" ? { tab: "pending" } : {});
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Board members"
        title="Members"
        description="Approve new signups, browse the directory, and manage membership."
      />

      <div className="flex gap-2 border-b border-slate-200">
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
                  : "border-transparent text-gray-500 hover:text-primary",
              ].join(" ")}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {activeTab === "directory" ? <MemberDirectory /> : <PendingApprovals />}
    </div>
  );
}
