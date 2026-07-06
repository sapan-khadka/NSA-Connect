/** Pre-filled values for the event task creation form (not persisted). */
export type EventTaskDraft = {
  title: string;
  description: string;
  assigneeId: number;
  assigneeName: string;
};

export function buildVolunteerTaskDraft(
  eventName: string,
  volunteer: { member_id: number; full_name: string; note: string | null },
): EventTaskDraft {
  return {
    title: `Help with ${eventName}`,
    description: volunteer.note?.trim() ?? "",
    assigneeId: volunteer.member_id,
    assigneeName: volunteer.full_name,
  };
}
