/**
 * Navigation state for Event Manage modals and calendar return context.
 */

export type ManageOpenModal =
  | "tasks"
  | "volunteers"
  | "transactions";

export type ManageLocationState = {
  openManageModal?: ManageOpenModal;
};

/** Passed when opening Photo album from the calendar overview card. */
export type CalendarReturnState = {
  fromCalendar: true;
  calendarDate: string;
  calendarEventId: number;
};

export type EventShortcutLocationState =
  | ManageLocationState
  | CalendarReturnState;
