import { combineDateAndTime } from "./event-form";
import type { ChecklistCategory } from "./ai-api";

function toLocalDateInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Stagger category due dates between ~14 days and ~4 days before the event. */
export function buildCategoryDueDate(
  eventDate: string,
  eventTime: string,
  categoryIndex: number,
  totalCategories: number,
): string {
  const eventStart = new Date(combineDateAndTime(eventDate, eventTime));
  const spread = totalCategories > 1 ? categoryIndex / (totalCategories - 1) : 0;
  const daysBeforeEvent = Math.max(1, Math.round(14 - spread * 10));
  const due = new Date(eventStart);
  due.setDate(due.getDate() - daysBeforeEvent);

  const minimumDue = new Date();
  minimumDue.setDate(minimumDue.getDate() + 1);
  minimumDue.setHours(12, 0, 0, 0);

  if (due < minimumDue) {
    due.setTime(minimumDue.getTime());
  } else {
    due.setHours(12, 0, 0, 0);
  }

  return combineDateAndTime(toLocalDateInputValue(due), "12:00");
}

export function buildPrepTaskCreates(
  categories: ChecklistCategory[],
  eventDate: string,
  eventTime: string,
) {
  return categories.map((category, index) => ({
    group_name: category.category,
    due_date: buildCategoryDueDate(
      eventDate,
      eventTime,
      index,
      categories.length,
    ),
    checklist_items: category.tasks,
  }));
}
