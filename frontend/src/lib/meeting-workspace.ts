export const MEETING_WORKSPACE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "agenda", label: "Agenda" },
  { id: "discussion", label: "Discussion" },
  { id: "minutes", label: "Minutes" },
  { id: "ai-summary", label: "AI Summary" },
  { id: "files", label: "Files" },
] as const;

export type MeetingWorkspaceTab =
  (typeof MEETING_WORKSPACE_TABS)[number]["id"];

const TAB_IDS = new Set<string>(MEETING_WORKSPACE_TABS.map((tab) => tab.id));

export function parseMeetingWorkspaceTab(
  value: string | null,
): MeetingWorkspaceTab {
  if (value && TAB_IDS.has(value)) {
    return value as MeetingWorkspaceTab;
  }
  return "overview";
}

/** Legacy Home deep-link hash → workspace tab. */
export function meetingTabFromHash(hash: string): MeetingWorkspaceTab | null {
  if (hash === "#meeting-minutes" || hash === "#minutes") {
    return "minutes";
  }
  if (hash === "#ai-summary" || hash === "#meeting-summary") {
    return "ai-summary";
  }
  return null;
}

export function meetingWorkspacePath(
  eventId: number,
  tab?: MeetingWorkspaceTab,
): string {
  if (!tab || tab === "overview") {
    return `/events/meetings/${eventId}`;
  }
  return `/events/meetings/${eventId}?tab=${tab}`;
}
