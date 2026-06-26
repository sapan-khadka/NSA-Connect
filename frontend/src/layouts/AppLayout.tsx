import { NavLink, Outlet, useLocation } from "react-router-dom";

import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import {
  canAccessFinance,
  canViewMemberDirectory,
  getDashboardPath,
} from "../lib/roles";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-accent font-medium"
    : "text-gray-600 hover:text-primary transition-colors";

export function AppLayout() {
  const { isAuthenticated, member } = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const showMemberDirectory = member ? canViewMemberDirectory(member.role) : false;
  const showFinance = member ? canAccessFinance(member.role) : false;
  const showBoardTasks = showMemberDirectory;
  const showMyTasks = member?.role === "general";
  const dashboardPath = member ? getDashboardPath(member.role) : "/member";
  const isWidePage = location.pathname === "/board/tasks";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="text-lg font-bold text-primary">
            NSA Connect
          </NavLink>
          <ul className="flex items-center gap-6 text-sm">
            <li>
              <NavLink to="/" end className={navLinkClass}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/events" className={navLinkClass}>
                Events
              </NavLink>
            </li>
            {isAuthenticated && (
              <>
                <li>
                  <NavLink to="/profile" className={navLinkClass}>
                    Profile
                  </NavLink>
                </li>
                <li>
                  <NavLink to={dashboardPath} className={navLinkClass}>
                    Dashboard
                  </NavLink>
                </li>
              </>
            )}
            {showMemberDirectory && (
              <li>
                <NavLink to="/members" className={navLinkClass}>
                  Members
                </NavLink>
              </li>
            )}
            {showMyTasks && (
              <li>
                <NavLink to="/member/tasks" className={navLinkClass}>
                  My tasks
                </NavLink>
              </li>
            )}
            {showBoardTasks && (
              <li>
                <NavLink to="/board/tasks" className={navLinkClass}>
                  Tasks
                </NavLink>
              </li>
            )}
            {showFinance && (
              <li>
                <NavLink to="/finance" className={navLinkClass}>
                  Finance
                </NavLink>
              </li>
            )}
            {isAuthenticated ? (
              <>
                {member && (
                  <li aria-label="Your role">
                    <RoleBadge role={member.role} />
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-gray-600 transition-colors hover:text-primary"
                  >
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <li>
                <NavLink to="/login" className={navLinkClass}>
                  Login
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </header>

      <main
        className={[
          "mx-auto px-6 py-12",
          isWidePage ? "max-w-7xl" : "max-w-5xl",
        ].join(" ")}
      >
        <Outlet />
      </main>
    </div>
  );
}
