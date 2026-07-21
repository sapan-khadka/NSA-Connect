import type { EventType, MeetingVisibility } from "./event-types";
import { EVENT_TYPES } from "./event-types";
import { toLocalIsoDate } from "./calendar";

export const EVENT_DATE_PAST_ERROR = "Event date can't be in the past";

export function getMinEventDate(today: Date = new Date()): string {
  return toLocalIsoDate(today);
}

export function isEventDateBeforeToday(
  eventDate: string,
  today: Date = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return false;
  }

  return eventDate < getMinEventDate(today);
}

export function splitEventDateTime(startsAt: string): {
  event_date: string;
  event_time: string;
} {
  const date = new Date(startsAt);
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    event_date: toLocalIsoDate(date),
    event_time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export type CreateEventFormValues = {
  name: string;
  description: string;
  location: string;
  capacity: string;
  event_type: EventType;
  event_date: string;
  event_time: string;
  budget: string;
  meeting_visibility: MeetingVisibility;
};

export type CreateEventFormErrors = Partial<
  Record<keyof CreateEventFormValues, string>
>;

export const MAX_EVENT_BUDGET = 999_999.99;

export const initialCreateEventValues: CreateEventFormValues = {
  name: "",
  description: "",
  location: "",
  capacity: "",
  event_type: "cultural",
  event_date: "",
  event_time: "18:00",
  budget: "",
  meeting_visibility: "board_only",
};

/** Build a timezone-aware ISO string from local date and time inputs. */
export function combineDateAndTime(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const local = new Date(year, month - 1, day, hours, minutes, 0);
  const offsetMinutes = -local.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetMins = String(absoluteOffset % 60).padStart(2, "0");
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${sign}${offsetHours}:${offsetMins}`;
}

export function validateCreateEventField(
  field: keyof CreateEventFormValues,
  value: string,
  values: CreateEventFormValues = initialCreateEventValues,
): string | null {
  switch (field) {
    case "name":
      if (!value.trim()) {
        return "Event name is required";
      }
      if (value.trim().length > 255) {
        return "Event name must be 255 characters or fewer";
      }
      return null;
    case "description":
      if (!value.trim()) {
        return "Description is required";
      }
      if (value.trim().length > 5000) {
        return "Description must be 5000 characters or fewer";
      }
      return null;
    case "event_type":
      return EVENT_TYPES.includes(value as EventType)
        ? null
        : "Select a valid event type";
    case "event_date":
      if (!value) {
        return "Event date is required";
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "Enter a valid date";
      }
      if (isEventDateBeforeToday(value)) {
        return EVENT_DATE_PAST_ERROR;
      }
      return null;
    case "event_time":
      if (!value) {
        return "Event time is required";
      }
      if (!/^\d{2}:\d{2}$/.test(value)) {
        return "Enter a valid time";
      }
      if (
        values.event_date &&
        /^\d{4}-\d{2}-\d{2}$/.test(values.event_date) &&
        isEventDateBeforeToday(values.event_date)
      ) {
        return EVENT_DATE_PAST_ERROR;
      }
      return null;
    case "budget": {
      if (!value.trim()) {
        return null;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) {
        return "Budget must be a number with up to 2 decimal places";
      }
      const amount = Number(value);
      if (amount < 0) {
        return "Budget cannot be negative";
      }
      if (amount > MAX_EVENT_BUDGET) {
        return `Budget cannot exceed ${MAX_EVENT_BUDGET.toFixed(2)}`;
      }
      return null;
    }
    case "location":
      if (value.trim().length > 255) {
        return "Location must be 255 characters or fewer";
      }
      return null;
    case "capacity": {
      if (!value.trim()) {
        return null;
      }
      if (!/^\d+$/.test(value.trim())) {
        return "Capacity must be a whole number";
      }
      const amount = Number(value);
      if (amount < 1) {
        return "Capacity must be at least 1";
      }
      return null;
    }
    default:
      return null;
  }
}

export function validateCreateEventForm(
  values: CreateEventFormValues,
): CreateEventFormErrors {
  const errors: CreateEventFormErrors = {};

  for (const field of Object.keys(values) as (keyof CreateEventFormValues)[]) {
    const error = validateCreateEventField(field, values[field], values);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

export function formatBudgetForSubmit(value: string): string {
  if (!value.trim()) {
    return "0.00";
  }
  return Number(value).toFixed(2);
}

export function buildCreateEventPayload(values: CreateEventFormValues) {
  const location = values.location.trim();
  const capacityRaw = values.capacity.trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    event_type: values.event_type,
    starts_at: combineDateAndTime(values.event_date, values.event_time),
    budget: formatBudgetForSubmit(values.budget),
    ...(location ? { location } : {}),
    ...(capacity !== null ? { capacity } : {}),
    ...(values.event_type === "meeting"
      ? { meeting_visibility: values.meeting_visibility }
      : {}),
  };
}
