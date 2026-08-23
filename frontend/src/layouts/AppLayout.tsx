import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { AppInboxRail } from "../components/AppInboxRail";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopBar, MobileSidebarDrawer } from "../components/AppTopBar";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { buildNavLinkClass } from "../components/AppNav";
import { AppLogo } from "../components/AppLogo";
import { GuestChrome, isGuestMarketingPath } from "./GuestMarketingLayout";
import { ChatNotificationProvider } from "../context/ChatNotificationProvider";
import { DiscussionInboxProvider } from "../context/DiscussionInboxProvider";
import { NotificationSummaryProvider } from "../context/NotificationSummaryProvider";
import { ToastProvider } from "../context/ToastProvider";
import { useAuth } from "../context/useAuth";
import { useIsLgUp } from "../hooks/useMediaQuery";

function isDiscussionThreadPath(pathname: string): boolean {
  return (
    pathname === "/discussions/board" ||
    /^\/discussions\/event\/\d+$/.test(pathname) ||
    /^\/discussions\/room\/\d+$/.test(pathname)
  );
}

function isDiscussionsSection(pathname: string): boolean {
  return pathname === "/discussions" || pathname.startsWith("/discussions/");
}

/**
 * App shell:
 *   [ Sidebar | Main workspace (~75%) | Inbox pane (~25%) ]
 *
 * Inbox is fixed desktop chrome — never a Home canvas widget.
 * On /discussions* the full Discussions UI owns messaging, so the pane hides.
 */
export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const isLgUp = useIsLgUp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isHome = pathname === "/";
  const fluidCanvas =
    isHome ||
    pathname === "/events" ||
    pathname.startsWith("/events/") ||
    pathname === "/finance" ||
    pathname.startsWith("/finance") ||
    pathname === "/announcements" ||
    pathname.startsWith("/announcements/") ||
    pathname === "/assistant" ||
    pathname.startsWith("/assistant/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/profile";
  const eventsCalendarCanvas =
    pathname === "/events" || pathname === "/events/calendar";
  const hideMobileBottomNav = isDiscussionThreadPath(pathname);
  const showInboxPane =
    isAuthenticated && isLgUp && !isDiscussionsSection(pathname);

  if (!isAuthenticated) {
    if (isGuestMarketingPath(pathname)) {
      return (
        <GuestChrome pathname={pathname}>
          <Outlet />
        </GuestChrome>
      );
    }

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
      <ToastProvider>
        <ChatNotificationProvider>
          <DiscussionInboxProvider>
            <div
              className={[
                "ds-app-shell",
                "ds-app-shell--app",
                showInboxPane ? "ds-app-shell--with-inbox" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[var(--sidebar-width)]">
                <AppSidebar />
              </div>

              <MobileSidebarDrawer
                open={mobileSidebarOpen}
                onClose={() => setMobileSidebarOpen(false)}
              >
                <AppSidebar onNavigate={() => setMobileSidebarOpen(false)} />
              </MobileSidebarDrawer>

              <div
                className={[
                  "ds-app-column min-w-0 flex-col lg:pl-[var(--sidebar-width)]",
                  isHome ? "ds-home-shell" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <AppTopBar
                  showMenuButton
                  onOpenSidebar={() => setMobileSidebarOpen(true)}
                />

                <div
                  className={[
                    "ds-workspace-row",
                    showInboxPane ? "ds-workspace-row--with-inbox" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <main
                    className={[
                      "ds-main-canvas",
                      eventsCalendarCanvas
                        ? "pb-3 lg:pb-0"
                        : hideMobileBottomNav
                          ? "pb-4 lg:pb-8"
                          : "pb-6 lg:pb-8",
                      fluidCanvas ? "ds-main-canvas--fluid" : "",
                      isHome ? "ds-main-canvas--home" : "",
                      eventsCalendarCanvas
                        ? "ds-main-canvas--events-calendar"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Outlet />
                  </main>

                  {showInboxPane ? <AppInboxRail /> : null}
                </div>

                {hideMobileBottomNav ? null : <MobileBottomNav />}
              </div>
            </div>
          </DiscussionInboxProvider>
        </ChatNotificationProvider>
      </ToastProvider>
    </NotificationSummaryProvider>
  );
}
