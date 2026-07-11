import type { BreadcrumbItem } from "../design-system/components/navigation/Breadcrumb";

export type AppHeaderMeta = {
  title: string;
  breadcrumbs: BreadcrumbItem[];
};

type RouteMeta = {
  pattern: RegExp;
  title: string | ((match: RegExpMatchArray) => string);
  crumbs: (match: RegExpMatchArray) => BreadcrumbItem[];
};

const DASHBOARD: BreadcrumbItem = {
  id: "dashboard",
  label: "Dashboard",
  to: "/",
};

function leaf(id: string, label: string): BreadcrumbItem {
  return { id, label };
}

const ROUTES: RouteMeta[] = [
  {
    pattern: /^\/$/,
    title: "Dashboard",
    crumbs: () => [leaf("dashboard", "Dashboard")],
  },
  {
    pattern: /^\/announcements\/?$/,
    title: "Announcements",
    crumbs: () => [DASHBOARD, leaf("announcements", "Announcements")],
  },
  {
    pattern: /^\/members\/?$/,
    title: "Members",
    crumbs: () => [DASHBOARD, leaf("members", "Members")],
  },
  {
    pattern: /^\/members\/([^/]+)\/?$/,
    title: "Member profile",
    crumbs: () => [
      DASHBOARD,
      { id: "members", label: "Members", to: "/members" },
      leaf("member", "Profile"),
    ],
  },
  {
    pattern: /^\/events\/?$/,
    title: "Events",
    crumbs: () => [DASHBOARD, leaf("events", "Events")],
  },
  {
    pattern: /^\/events\/calendar\/?$/,
    title: "Events",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("calendar", "Calendar"),
    ],
  },
  {
    pattern: /^\/events\/suggestions\/?$/,
    title: "Event suggestions",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("suggestions", "Suggestions"),
    ],
  },
  {
    pattern: /^\/events\/tasks\/?$/,
    title: "Event tasks",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("tasks", "Tasks"),
    ],
  },
  {
    pattern: /^\/events\/photos\/?$/,
    title: "Photo archive",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("photos", "Photos"),
    ],
  },
  {
    pattern: /^\/events\/photos\/([^/]+)\/?$/,
    title: "Photo album",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      { id: "photos", label: "Photos", to: "/events/photos" },
      leaf("album", "Album"),
    ],
  },
  {
    pattern: /^\/events\/past\/?$/,
    title: "Past events",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("past", "Past"),
    ],
  },
  {
    pattern: /^\/events\/meetings\/?$/,
    title: "Board meetings",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("meetings", "Meetings"),
    ],
  },
  {
    pattern: /^\/events\/meetings\/([^/]+)\/?$/,
    title: "Meeting detail",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      { id: "meetings", label: "Meetings", to: "/events/meetings" },
      leaf("meeting", "Detail"),
    ],
  },
  {
    pattern: /^\/events\/oversight\/?$/,
    title: "Task oversight",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("oversight", "Oversight"),
    ],
  },
  {
    pattern: /^\/events\/([^/]+)\/checkin\/?$/,
    title: "Event check-in",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("checkin", "Check-in"),
    ],
  },
  {
    pattern: /^\/events\/([^/]+)\/manage\/?$/,
    title: "Manage event",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("manage", "Manage"),
    ],
  },
  {
    pattern: /^\/events\/([^/]+)\/?$/,
    title: "Event detail",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("detail", "Detail"),
    ],
  },
  {
    pattern: /^\/finance\/?$/,
    title: "Finance",
    crumbs: () => [DASHBOARD, leaf("finance", "Finance")],
  },
  {
    pattern: /^\/reports\/?$/,
    title: "Reports",
    crumbs: () => [DASHBOARD, leaf("reports", "Reports")],
  },
  {
    pattern: /^\/reports\/([^/]+)\/?$/,
    title: "Report detail",
    crumbs: () => [
      DASHBOARD,
      { id: "reports", label: "Reports", to: "/reports" },
      leaf("report", "Detail"),
    ],
  },
  {
    pattern: /^\/assistant\/?$/,
    title: "AI Assistant",
    crumbs: () => [DASHBOARD, leaf("assistant", "AI Assistant")],
  },
  {
    pattern: /^\/profile\/?$/,
    title: "Settings",
    crumbs: () => [DASHBOARD, leaf("settings", "Settings")],
  },
  {
    pattern: /^\/board\/discussion\/?$/,
    title: "Board discussion",
    crumbs: () => [
      DASHBOARD,
      leaf("board", "Board tools"),
      leaf("discussion", "Discussion"),
    ],
  },
  {
    pattern: /^\/board\/meeting-minutes\/?$/,
    title: "Meeting minutes",
    crumbs: () => [
      DASHBOARD,
      leaf("board", "Board tools"),
      leaf("minutes", "Meeting minutes"),
    ],
  },
  {
    pattern: /^\/board\/announcement-email\/?$/,
    title: "Announcement email",
    crumbs: () => [
      DASHBOARD,
      leaf("board", "Board tools"),
      leaf("email", "Announcement email"),
    ],
  },
];

/**
 * Resolve sticky header title + breadcrumbs from the current pathname.
 * Header-only helper — does not change page content or routes.
 */
export function getAppHeaderMeta(pathname: string): AppHeaderMeta {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  for (const route of ROUTES) {
    const match = normalized.match(route.pattern);
    if (!match) {
      continue;
    }
    const title =
      typeof route.title === "function" ? route.title(match) : route.title;
    return { title, breadcrumbs: route.crumbs(match) };
  }

  return {
    title: "NSA Connect",
    breadcrumbs: [DASHBOARD, leaf("page", "Page")],
  };
}
