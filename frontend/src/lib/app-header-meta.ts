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
    pattern: /^\/notifications\/?$/,
    title: "Notifications",
    crumbs: () => [DASHBOARD, leaf("notifications", "Notifications")],
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
    pattern: /^\/events\/ideas\/?$/,
    title: "Ideas",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("ideas", "Ideas"),
    ],
  },
  {
    pattern: /^\/events\/ideas\/[^/]+\/?$/,
    title: "Idea",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      { id: "ideas", label: "Ideas", to: "/events/ideas" },
      leaf("idea", "Workspace"),
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
    pattern: /^\/events\/media\/?$/,
    title: "Media",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("media", "Media"),
    ],
  },
  {
    pattern: /^\/events\/media\/album\/([^/]+)\/?$/,
    title: "Album",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      { id: "media", label: "Media", to: "/events/media" },
      leaf("album", "Album"),
    ],
  },
  {
    pattern: /^\/events\/media\/([^/]+)\/?$/,
    title: "Album",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      { id: "media", label: "Media", to: "/events/media" },
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
    title: "Meetings",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      leaf("meetings", "Meetings"),
    ],
  },
  {
    pattern: /^\/events\/meetings\/([^/]+)\/?$/,
    title: "Meeting",
    crumbs: () => [
      DASHBOARD,
      { id: "events", label: "Events", to: "/events/calendar" },
      { id: "meetings", label: "Meetings", to: "/events/meetings" },
      leaf("meeting", "Workspace"),
    ],
  },
  {
    pattern: /^\/events\/oversight\/?$/,
    title: "Oversight",
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
    title: "AI & Documents",
    crumbs: () => [DASHBOARD, leaf("assistant", "AI & Documents")],
  },
  {
    pattern: /^\/settings(\/.*)?\/?$/,
    title: "Settings",
    crumbs: () => [DASHBOARD, leaf("settings", "Settings")],
  },
  {
    pattern: /^\/profile\/?$/,
    title: "Settings",
    crumbs: () => [DASHBOARD, leaf("settings", "Settings")],
  },
  {
    pattern: /^\/discussions(\/board|\/event\/\d+|\/room\/\d+)?\/?$/,
    title: "Discussions",
    crumbs: () => [DASHBOARD, leaf("discussions", "Discussions")],
  },
  {
    pattern: /^\/board\/discussion\/?$/,
    title: "Discussions",
    crumbs: () => [DASHBOARD, leaf("discussions", "Discussions")],
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
