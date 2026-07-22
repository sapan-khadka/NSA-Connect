import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { AppSidebar } from "../components/AppSidebar";
import { AppTopBar, MobileSidebarDrawer } from "../components/AppTopBar";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { buildNavLinkClass } from "../components/AppNav";
import { AppLogo } from "../components/AppLogo";
import { NotificationSummaryProvider } from "../context/NotificationSummaryProvider";
import { useAuth } from "../context/useAuth";

/**
 * App shell: fixed left sidebar + top header + scrollable main canvas.
 * Navigation lives in the sidebar only (not the top bar).
 */
export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const fluidCanvas = pathname === "/";

  if (!isAuthenticated) {
    return (
      <div className="ds-app-shell">
        <header className="ds-topbar justify-between">
          <AppLogo asLink size="nav" showTagline={false} />
          <ul className="flex items-center gap-1 text-sm">
            <li>
              <NavLink
                to="/login"
                className={({ isActive }) => buildNavLinkClass(isActive)}
              >
                Login
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/register"
                className={({ isActive }) => buildNavLinkClass(isActive)}
              >
                Register
              </NavLink>
            </li>
          </ul>
        </header>
        <main className="ds-main-canvas pb-8">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <NotificationSummaryProvider>
      <div className="ds-app-shell">
        {/* Fixed left sidebar — desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[var(--sidebar-width)]">
          <AppSidebar />
        </div>

        {/* Mobile drawer sidebar */}
        <MobileSidebarDrawer
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        >
          <AppSidebar onNavigate={() => setMobileSidebarOpen(false)} />
        </MobileSidebarDrawer>

        {/* Scrollable column: sticky header + main content */}
        <div className="flex min-h-screen min-w-0 flex-col lg:pl-[var(--sidebar-width)]">
          <AppTopBar
            showMenuButton
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />

          <main
            className={[
              "ds-main-canvas pb-24 lg:pb-8",
              fluidCanvas ? "ds-main-canvas--fluid" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Outlet />
          </main>

          <MobileBottomNav />
        </div>
      </div>
    </NotificationSummaryProvider>
  );
}
