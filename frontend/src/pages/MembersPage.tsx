import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { MemberDirectory } from "../components/MemberDirectory";
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
    <div className="space-y-8">
      <section className="nepali-hero">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Board members
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Members</h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          Approve new signups with one click, browse the member directory, and
          manage NSA Connect membership.
        </p>
      </section>

      <div className="flex gap-2 border-b border-gray-200">
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
