import { CalendarDays, CheckSquare, CircleDollarSign, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { AppIcon } from "../components/ui/AppIcon";
import type { EventResponse } from "./events-api";
import { fetchEvent, fetchUpcomingEvents } from "./events-api";
import { fetchEventBudgetForEvent } from "./finance-api";
import type { EventTaskResponse } from "./event-tasks-api";
import { fetchMyEventTasks } from "./event-tasks-api";
import { fetchMembers } from "./members-api";
import {
  extractRichPreviewTokens,
  type RichPreviewToken,
} from "./discussion-mentions";

type MemberCard = { id: number; full_name: string };
type BudgetCard = {
  eventId: number;
  eventName: string;
  planned: string;
  remaining: string;
  overBudget: boolean;
};

function matchesLabel(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) {
    return false;
  }
  return h.includes(n) || n.includes(h);
}

function formatDueLabel(dueDate: string | null | undefined): string | null {
  if (!dueDate) {
    return null;
  }
  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) {
    return `Due ${dueDate}`;
  }
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round(
    (startDue.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diff === 0) {
    return "Due Today";
  }
  if (diff === 1) {
    return "Due Tomorrow";
  }
  if (diff === -1) {
    return "Due Yesterday";
  }
  return `Due ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(due)}`;
}

export function DiscussionRichPreviews({ content }: { content: string }) {
  const tokens = extractRichPreviewTokens(content);
  const [members, setMembers] = useState<MemberCard[]>([]);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [budgets, setBudgets] = useState<BudgetCard[]>([]);

  useEffect(() => {
    if (tokens.length === 0) {
      return;
    }
    let cancelled = false;

    async function resolve() {
      const needMembers = tokens.some((token) => token.kind === "member");
      const needEvents = tokens.some(
        (token) => token.kind === "event" || token.kind === "budget",
      );
      const needTasks = tokens.some((token) => token.kind === "event");

      const [memberPage, upcoming, myTasks] = await Promise.all([
        needMembers
          ? fetchMembers({ status: "approved", page_size: 100 }).catch(() => null)
          : Promise.resolve(null),
        needEvents
          ? fetchUpcomingEvents({ limit: 40 })
              .then((response) => response.events)
              .catch(() => [] as EventResponse[])
          : Promise.resolve([] as EventResponse[]),
        needTasks
          ? fetchMyEventTasks()
              .then((response) => response.tasks)
              .catch(() => [] as EventTaskResponse[])
          : Promise.resolve([] as EventTaskResponse[]),
      ]);

      if (cancelled) {
        return;
      }

      const memberHits: MemberCard[] = [];
      if (memberPage) {
        for (const token of tokens.filter((row) => row.kind === "member")) {
          const hit = memberPage.members.find((member) =>
            matchesLabel(member.full_name, token.label),
          );
          if (hit && !memberHits.some((row) => row.id === hit.id)) {
            memberHits.push({ id: hit.id, full_name: hit.full_name });
          }
        }
      }

      const eventHits: EventResponse[] = [];
      for (const token of tokens.filter((row) => row.kind === "event")) {
        const hit = upcoming.find((event) => matchesLabel(event.name, token.label));
        if (hit && !eventHits.some((row) => row.id === hit.id)) {
          eventHits.push(hit);
        }
      }

      const taskHits: EventTaskResponse[] = [];
      for (const token of tokens.filter((row) => row.kind === "event")) {
        const hit = myTasks.find(
          (task) =>
            matchesLabel(task.title, token.label) ||
            matchesLabel(task.event_name, token.label),
        );
        if (hit && !taskHits.some((row) => row.id === hit.id)) {
          taskHits.push(hit);
        }
      }

      const budgetHits: BudgetCard[] = [];
      const budgetTokens = tokens.filter((token) => token.kind === "budget");
      if (budgetTokens.length > 0) {
        let candidates = upcoming;
        if (candidates.length === 0) {
          candidates = await fetchUpcomingEvents({ limit: 20 })
            .then((response) => response.events)
            .catch(() => []);
        }
        for (const token of budgetTokens) {
          const event =
            candidates.find((row) => matchesLabel(row.name, token.label)) ??
            candidates[0];
          if (!event) {
            continue;
          }
          try {
            const detail = await fetchEvent(event.id).catch(() => null);
            const budget = await fetchEventBudgetForEvent(event.id);
            if (cancelled) {
              return;
            }
            budgetHits.push({
              eventId: event.id,
              eventName: detail?.name ?? event.name,
              planned: budget.planned_budget,
              remaining: budget.budget_remaining,
              overBudget: budget.over_budget,
            });
          } catch {
            // ignore unresolved budget cards
          }
        }
      }

      if (!cancelled) {
        setMembers(memberHits);
        setEvents(eventHits);
        setTasks(taskHits);
        setBudgets(budgetHits);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (
    tokens.length === 0 ||
    (members.length === 0 &&
      events.length === 0 &&
      tasks.length === 0 &&
      budgets.length === 0)
  ) {
    return null;
  }

  return (
    <div className="mt-1.5 flex w-full max-w-sm flex-col gap-1.5">
      {tasks.map((task) => {
        const due = formatDueLabel(task.due_date);
        return (
          <Link
            key={`t-${task.id}`}
            to={`/events/${task.event_id}/tasks`}
            className="block rounded-xl border border-[#E5E5E3] bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-[#FAFAF9]"
          >
            <div className="flex items-start gap-2">
              <AppIcon
                icon={CheckSquare}
                size="xs"
                className="mt-0.5 text-primary"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#202020]">
                  {task.title}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {task.assignee_name
                    ? `Assigned to: ${task.assignee_name}`
                    : task.event_name}
                  {due ? ` · ${due}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-primary">
                Open →
              </span>
            </div>
          </Link>
        );
      })}
      {events.map((event) => (
        <Link
          key={`e-${event.id}`}
          to={`/events/${event.id}`}
          className="block rounded-xl border border-[#E5E5E3] bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-[#FAFAF9]"
        >
          <div className="flex items-start gap-2">
            <AppIcon
              icon={CalendarDays}
              size="xs"
              className="mt-0.5 text-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#202020]">
                {event.name}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                }).format(new Date(event.starts_at))}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-primary">
              Open →
            </span>
          </div>
        </Link>
      ))}
      {budgets.map((budget) => (
        <Link
          key={`b-${budget.eventId}`}
          to={`/events/${budget.eventId}/manage`}
          className="block rounded-xl border border-[#E5E5E3] bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-[#FAFAF9]"
        >
          <div className="flex items-start gap-2">
            <AppIcon
              icon={CircleDollarSign}
              size="xs"
              className="mt-0.5 text-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#202020]">
                {budget.eventName} budget
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Planned {budget.planned} · Remaining {budget.remaining}
                {budget.overBudget ? " · Over budget" : ""}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-primary">
              View →
            </span>
          </div>
        </Link>
      ))}
      {members.map((member) => (
        <div
          key={`m-${member.id}`}
          className="flex items-center gap-2.5 rounded-xl border border-[#E5E5E3] bg-white px-3 py-2.5 shadow-sm"
        >
          <AppIcon icon={User} size="xs" className="text-primary" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#202020]">
              {member.full_name}
            </p>
            <p className="text-[11px] text-gray-500">Member</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { RichPreviewToken };
