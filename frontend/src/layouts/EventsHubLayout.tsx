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

function buildEventsTabs(member: NonNullable<ReturnType<typeof useAuth>["member"]>): EventsTab[] {
  const tabs: EventsTab[] = [{ label: "Calendar", to: "/events/calendar" }];

  tabs.push({
    label: member.role === "general" ? "Assigned tasks" : "My tasks",
    to: "/events/tasks",
  });

  tabs.push({ label: "Photo archive", to: "/events/photos" });
  tabs.push({ label: "Suggestions", to: "/events/suggestions" });

  if (canViewMemberDirectory(member.role)) {
    tabs.push({ label: "Board meetings", to: "/events/meetings" });
    if (canViewTaskOversight(member.role, member.position)) {
      tabs.push({ label: "Task oversight", to: "/events/oversight" });
    }
    tabs.push({ label: "Past events", to: "/events/past" });
  }

  return tabs;
}

export function EventsHubLayout() {
  const { member } = useAuth();
  const isManageView = Boolean(useMatch("/events/:eventId/manage"));
  const isMeetingDetailView = Boolean(useMatch("/events/meetings/:eventId"));
  const isPhotoAlbumView = Boolean(useMatch("/events/photos/:eventId"));

  if (isManageView || isMeetingDetailView || isPhotoAlbumView) {
    return <Outlet />;
  }

  const tabs = member ? buildEventsTabs(member) : [{ label: "Calendar", to: "/events/calendar" }];

  return (
    <div className="space-y-6">
      <nav
        aria-label="Events sections"
        className="sticky top-0 z-10 -mx-1 border-b border-surface-card bg-surface/95 px-1 backdrop-blur-sm"
      >
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-label hover:text-accent",
                ].join(" ")
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
