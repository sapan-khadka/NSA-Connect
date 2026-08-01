import type { MemberResponse } from "../../lib/auth-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { HomeYourWorkSection } from "./HomeMemberSections";

export function HomeWorkCenter({
  member,
  tasksSummary,
  tasksPath,
  isLoading,
  completingTaskId,
  taskCompleteError,
  onCompleteTask,
  taskLimit = 6,
}: {
  member: MemberResponse;
  tasksSummary: MyTasksSummary;
  tasksPath: string;
  isLoading: boolean;
  completingTaskId: number | null;
  taskCompleteError: string | null;
  onCompleteTask: (taskId: number) => void;
  taskLimit?: number;
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
        taskLimit={taskLimit}
      />
    </div>
  );
}
