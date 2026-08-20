import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { createMockMember } from "../../test/test-utils";
import { summarizeMyTasks } from "../../lib/home-tasks";
import { HomeWidgetContent, type HomeWidgetData } from "./HomeWidgetContent";

vi.mock("../../lib/members-api", () => ({
  fetchMemberActivity: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock("../../lib/meetings-api", () => ({
  fetchMeetings: vi.fn().mockResolvedValue({ meetings: [], total: 0 }),
}));

vi.mock("../../lib/finance-api", () => ({
  fetchFinanceSummary: vi.fn().mockResolvedValue({
    balance: "0",
    total_income: "0",
    total_expense: "0",
  }),
}));

const data: HomeWidgetData = {
  member: createMockMember("board"),
  featuredEvents: [],
  myTasks: [],
  overviewMembers: [],
  overviewLoading: false,
  tasksSummary: summarizeMyTasks([]),
  isLoading: false,
  financePendingCount: 0,
  pendingMemberApprovals: 0,
  showAssistant: true,
  showTaskOversight: true,
  tasksPath: "/events/tasks",
  completingTaskId: null,
  taskCompleteError: null,
  onCompleteTask: () => undefined,
};

describe("HomeWidgetContent", () => {
  it("does not render inbox as a Home widget", () => {
    const { container } = render(
      <HomeWidgetContent id="inbox" surface="briefing" data={data} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders briefing widgets used on Home", () => {
    render(
      <MemoryRouter>
        <HomeWidgetContent id="overview" surface="briefing" data={data} />
        <HomeWidgetContent id="activity" surface="briefing" data={data} />
        <HomeWidgetContent id="actions" surface="briefing" data={data} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Today's Focus")).toBeInTheDocument();
    expect(screen.getByLabelText("Recent Activity")).toBeInTheDocument();
  });
});
