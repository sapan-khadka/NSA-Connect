import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  AccountMenu,
  NavDropdown,
  NavDivider,
  PrimaryNavLink,
} from "../components/AppNav";
import { AppLogo } from "../components/AppLogo";
import { PrayerFlagStripe } from "../components/NepaliDecor";
import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import {
  canAccessFinance,
  canViewMemberDirectory,
  getDashboardPath,
} from "../lib/roles";

const guestLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "inline-block rounded-md px-2.5 py-1.5 transition-colors",
    isActive
      ? "bg-accent/10 font-medium text-accent"
      : "text-gray-600 hover:bg-gray-50 hover:text-primary",
  ].join(" ");

export function AppLayout() {
  const { isAuthenticated, member } = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const showMemberDirectory = member ? canViewMemberDirectory(member.role) : false;
  const showFinance = member ? canAccessFinance(member.role) : false;
  const showMeetingMinutes = showMemberDirectory;
  const showAnnouncementEmail = showMemberDirectory;
  const dashboardPath = member ? getDashboardPath(member.role) : "/member";
  const isWidePage = location.pathname.startsWith("/events");

  const adminItems = [
    ...(showMemberDirectory ? [{ label: "Members", to: "/members" }] : []),
    ...(showFinance ? [{ label: "Finance", to: "/finance" }] : []),
    ...(showMeetingMinutes
      ? [{ label: "Meeting minutes", to: "/board/meeting-minutes" }]
      : []),
    ...(showAnnouncementEmail
      ? [{ label: "Announcement email", to: "/board/announcement-email" }]
      : []),
  ];

  const adminActive =
    location.pathname.startsWith("/members") ||
    location.pathname.startsWith("/finance") ||
    location.pathname === "/board/meeting-minutes" ||
    location.pathname === "/board/announcement-email";

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex w-full max-w-7xl items-center gap-4 px-6 py-3 lg:gap-6">
          <AppLogo asLink showTagline={false} />

          {isAuthenticated ? (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <ul className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
                <PrimaryNavLink to="/" end>
                  Home
                </PrimaryNavLink>
                <PrimaryNavLink to="/events">Events</PrimaryNavLink>
                <PrimaryNavLink to="/assistant">Assistant</PrimaryNavLink>
                <PrimaryNavLink to={dashboardPath}>Dashboard</PrimaryNavLink>
                {adminItems.length > 0 ? (
                  <>
                    <NavDivider />
                    <NavDropdown label="Admin" items={adminItems} isActive={adminActive} />
                  </>
                ) : null}
              </ul>

              {member ? (
                <AccountMenu fullName={member.full_name} onLogout={logout} />
              ) : null}
            </div>
          ) : (
            <ul className="ml-auto flex items-center gap-1 text-sm">
              <li>
                <NavLink to="/login" className={guestLinkClass}>
                  Login
                </NavLink>
              </li>
              <li>
                <NavLink to="/register" className={guestLinkClass}>
                  Register
                </NavLink>
              </li>
            </ul>
          )}
        </nav>
        <PrayerFlagStripe />
      </header>

      <main
        className={[
          "mx-auto w-full px-6 py-10",
          isWidePage ? "max-w-7xl" : "max-w-6xl",
        ].join(" ")}
      >
        <Outlet />
      </main>
    </div>
  );
}
