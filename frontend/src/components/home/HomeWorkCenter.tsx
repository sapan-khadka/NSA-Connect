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
      className="flex h-full min-h-0 flex-col home-surface-quiet home-task-card"
      aria-label="Work Center"
    >
      <div className="home-work-head">
        <div className="home-work-head-titles">
          <h2 className="home-panel-title">
            {tab === "mine" ? "My tasks" : "Oversight"}
          </h2>
        </div>
        <div
          role="tablist"
          aria-label="Work views"
          className="home-work-tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            id="work-tab-mine"
            onClick={() => setTab("mine")}
            className="home-work-tab"
          >
            Mine
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "oversight"}
            id="work-tab-oversight"
            onClick={() => setTab("oversight")}
            className="home-work-tab"
          >
            Oversight
          </button>
        </div>
      </div>

      <div className="home-work-panels">
        <div
          role="tabpanel"
          aria-labelledby="work-tab-mine"
          hidden={tab !== "mine"}
          className="home-work-panel"
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
          className="home-work-panel"
        >
          <HomeTaskOversightSection embedded onSummary={handleSummary} />
        </div>
      </div>
    </HomeCard>
  );
}
