import { NavLink, Outlet, useMatch } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import {
  canViewMemberDirectory,
  canViewTaskOversight,
} from "../lib/roles";

type EventsTab = {
  label: string;
  to: string;
  end?: boolean;
};

export function EventsHubLayout() {
  const { member } = useAuth();
  const isManageView = Boolean(useMatch("/events/:eventId/manage"));

  const tabs: EventsTab[] = [{ label: "Calendar", to: "/events/calendar" }];

  if (member) {
    tabs.push({ label: "My tasks", to: "/events/tasks" });

    if (canViewMemberDirectory(member.role)) {
      tabs.push({ label: "Past events", to: "/events/past" });
    }

    if (canViewTaskOversight(member.role, member.position)) {
      tabs.push({ label: "Oversight", to: "/events/oversight" });
    }

    if (member.role === "general") {
      tabs.push({ label: "Volunteer signups", to: "/events/volunteer" });
    }
  }

  if (isManageView) {
    return <Outlet />;
  }

  return (
    <div className="space-y-8">
      <section className="nepali-hero">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Events
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Events</h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          Calendar, your tasks, and event close-out in one place.
        </p>
      </section>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-primary",
              ].join(" ")
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
