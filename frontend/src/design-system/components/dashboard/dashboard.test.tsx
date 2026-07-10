import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  ActivityCard,
  AnnouncementCard,
  EventCard,
  HeroBanner,
  ProfileCard,
  QuickActionCard,
  StatCard,
  TaskCard,
} from "../index";

describe("design-system dashboard components", () => {
  it("renders HeroBanner and StatCard", () => {
    render(
      <MemoryRouter>
        <HeroBanner
          title="Welcome back"
          description="Today’s overview"
          actions={<button type="button">Action</button>}
        />
        <StatCard label="Open Tasks" value={12} description="2 overdue" to="/tasks" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Tasks/i })).toHaveAttribute(
      "href",
      "/tasks",
    );
  });

  it("renders announcement, activity, task, event, quick action, and profile cards", () => {
    render(
      <MemoryRouter>
        <AnnouncementCard
          title="Festival update"
          category="General"
          date="Jul 10"
          to="/announcements"
        />
        <ActivityCard
          title="Task Assigned"
          message="Print flyers"
          actionLabel="View"
          to="/tasks"
        />
        <TaskCard title="Buy supplies" dueLabel="Due Fri" tone="warning" />
        <EventCard
          title="Dashain"
          date="Oct 1"
          location="Campus"
          to="/events/1"
          variant="compact"
        />
        <QuickActionCard
          title="Finance"
          description="Budgets"
          to="/finance"
        />
        <ProfileCard
          title="User Profile"
          name="Ada Lovelace"
          fields={[{ label: "Major", value: "CS" }]}
          actionLabel="Edit Profile"
          actionTo="/profile"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Festival update")).toBeInTheDocument();
    expect(screen.getByText("Task Assigned")).toBeInTheDocument();
    expect(screen.getByText("Buy supplies")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashain/i })).toHaveAttribute(
      "href",
      "/events/1",
    );
    expect(screen.getByRole("link", { name: /Finance/i })).toHaveAttribute(
      "href",
      "/finance",
    );
    expect(
      screen.getByRole("link", { name: "Edit Profile" }),
    ).toHaveAttribute("href", "/profile");
  });
});
