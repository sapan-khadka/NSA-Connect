import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  AccountMenu,
  buildNavLinkClass,
  NavDropdown,
  NavDivider,
  PrimaryNavLink,
} from "../components/AppNav";
import { AppLogo } from "../components/AppLogo";
import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
  canViewMemberDirectory,
} from "../lib/roles";

const guestLinkClass = ({ isActive }: { isActive: boolean }) =>
  buildNavLinkClass(isActive);

export function AppLayout() {
  const { isAuthenticated, member } = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const showMemberAdmin = member ? canViewMemberDirectory(member.role) : false;
  const showMembersNav = member ? canBrowseMemberDirectory(member.role) : false;
  const showFinance = member ? canAccessFinance(member.role) : false;
  const showMeetingMinutes = showMemberAdmin;
  const showAnnouncementEmail = showMemberAdmin;

  const adminItems = [
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
      <header className="ds-app-header bg-surface">
        <nav className="mx-auto flex min-h-[3.75rem] w-full max-w-7xl items-center gap-3 px-6 lg:gap-5">
          <AppLogo asLink size="nav" showTagline={false} />

          {isAuthenticated ? (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:gap-4">
              <ul className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
                <PrimaryNavLink to="/" end>
                  Home
                </PrimaryNavLink>
                <PrimaryNavLink to="/events/calendar">Events</PrimaryNavLink>
                {showMembersNav ? (
                  <PrimaryNavLink to="/members">Members</PrimaryNavLink>
                ) : null}
                <PrimaryNavLink to="/assistant">Assistant</PrimaryNavLink>
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
            <ul className="ml-auto flex items-center gap-0.5 text-sm">
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
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
