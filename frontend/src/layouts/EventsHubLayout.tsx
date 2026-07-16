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
    label: "My tasks",
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
    <div className="events-hub-shell">
      <nav
        aria-label="Events sections"
        className="sticky top-0 z-10 border-b border-gray-200 bg-surface/95 px-4 pb-0.5 backdrop-blur-sm sm:-mx-1 sm:border-surface-card sm:px-1"
      >
        <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
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
