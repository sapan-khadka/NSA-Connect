import { useCallback, useState } from "react";

import type { MemberResponse } from "../../lib/auth-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { HomeCard } from "../ui/HomeCard";
import { HomeYourWorkSection } from "./HomeMemberSections";
import {
  HomeTaskOversightSection,
  type OversightSummary,
} from "./HomeTaskOversightSection";

type WorkTab = "mine" | "oversight";

export function HomeWorkCenter({
  member,
  showOversight,
  tasksSummary,
  tasksPath,
  isLoading,
  completingTaskId,
  taskCompleteError,
  onCompleteTask,
}: {
  member: MemberResponse;
  showOversight: boolean;
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  isLoading: boolean;
  completingTaskId: number | null;
  taskCompleteError: string | null;
  onCompleteTask: (taskId: number) => void;
}) {
  const [tab, setTab] = useState<WorkTab>("mine");
  const [defaultApplied, setDefaultApplied] = useState(false);

  const handleSummary = useCallback(
    (summary: OversightSummary) => {
      if (!showOversight || defaultApplied) {
        return;
      }
      setTab(
        summary.hasRisk || summary.openTaskCount > 0 ? "oversight" : "mine",
      );
      setDefaultApplied(true);
    },
    [showOversight, defaultApplied],
  );

  if (!showOversight) {
    return (
      <HomeYourWorkSection
        member={member}
        tasksSummary={tasksSummary}
        tasksPath={tasksPath}
        isLoading={isLoading}
        completingTaskId={completingTaskId}
        taskCompleteError={taskCompleteError}
        onCompleteTask={onCompleteTask}
      />
    );
  }

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="Work Center"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="home-section-title">Work</h2>
        <div
          role="tablist"
          aria-label="Work views"
          className="inline-flex rounded-full border border-gray-200/80 bg-white/70 p-0.5 backdrop-blur-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            id="work-tab-mine"
            onClick={() => setTab("mine")}
            className={[
              "rounded-full px-3 py-1 text-[11px] font-semibold transition",
              tab === "mine"
                ? "bg-foreground text-white shadow-sm"
                : "text-gray-600 hover:text-foreground",
            ].join(" ")}
          >
            Mine
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "oversight"}
            id="work-tab-oversight"
            onClick={() => setTab("oversight")}
            className={[
              "rounded-full px-3 py-1 text-[11px] font-semibold transition",
              tab === "oversight"
                ? "bg-foreground text-white shadow-sm"
                : "text-gray-600 hover:text-foreground",
            ].join(" ")}
          >
            Oversight
          </button>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <div
          role="tabpanel"
          aria-labelledby="work-tab-mine"
          hidden={tab !== "mine"}
          className="h-full min-h-0"
        >
          <HomeYourWorkSection
            member={member}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            isLoading={isLoading}
            completingTaskId={completingTaskId}
            taskCompleteError={taskCompleteError}
            onCompleteTask={onCompleteTask}
            embedded
          />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="work-tab-oversight"
          hidden={tab !== "oversight"}
          className="h-full min-h-0"
        >
          <HomeTaskOversightSection embedded onSummary={handleSummary} />
        </div>
      </div>
    </HomeCard>
  );
}
