import type { MemberResponse } from "../../lib/auth-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { HomeYourWorkSection } from "./HomeMemberSections";
import { HomeYourTasksSection } from "./HomeYourTasksSection";

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
  return (
    <div className="home-tasks-stack" aria-label="Work Center">
      <HomeYourWorkSection
        member={member}
        tasksSummary={tasksSummary}
        tasksPath={tasksPath}
        isLoading={isLoading}
        completingTaskId={completingTaskId}
        taskCompleteError={taskCompleteError}
        onCompleteTask={onCompleteTask}
      />
      {showOversight ? <HomeYourTasksSection /> : null}
    </div>
  );
}
