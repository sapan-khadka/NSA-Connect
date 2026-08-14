import {
  ClipboardCheck,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { Drawer } from "../design-system/components/feedback/Drawer";
import { PageBackLink } from "./ui/PageBackLink";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { getApiErrorMessage } from "../lib/api-error";
import { eventDetailPath, publicEventPath } from "../lib/event-links";
import {
  combineDateAndTime,
  getMinEventDate,
  splitEventDateTime,
} from "../lib/event-form";
import {
  formatEventCommandWhen,
  type EventManageTab,
} from "../lib/event-manage-command";
import {
  duplicateEvent,
  type EventDetailResponse,
} from "../lib/events-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { inputFieldClassName } from "./ui/Input";
import { Modal } from "./ui/Modal";

type EventManageHeroProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  tasks: EventTaskResponse[];
  backTo: string;
  onEditEvent: () => void;
  onCheckIn: () => void;
  attendeeCount: number | null;
  volunteerCount: number | null;
};

function eventLifecycleStatus(event: EventDetailResponse): {
  label: "Completed" | "Published";
} {
  if (event.is_past) {
    return { label: "Completed" };
  }
  return { label: "Published" };
}

export function EventManageHero({
  event,
  budget,
  tasks,
  backTo,
  onEditEvent,
  onCheckIn,
  attendeeCount,
  volunteerCount,
}: EventManageHeroProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const [shareCopied, setShareCopied] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const initialSchedule = splitEventDateTime(event.starts_at);
  const [duplicateName, setDuplicateName] = useState(`${event.name} (Copy)`);
  const [duplicateDate, setDuplicateDate] = useState(initialSchedule.event_date);
  const [duplicateTime, setDuplicateTime] = useState(initialSchedule.event_time);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCopied) {
      return;
    }
    const timeoutId = window.setTimeout(() => setShareCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [shareCopied]);

  const memberPath = eventDetailPath(event.id);
  const canSharePublicly =
    event.event_type !== "meeting" || event.meeting_visibility === "public";
  const sharePath = canSharePublicly ? publicEventPath(event.id) : memberPath;
  const metaLine = formatEventCommandWhen(event.starts_at, event.location);
  const lifecycle = eventLifecycleStatus(event);
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const budgetValue = budget
    ? formatCurrency(budget.planned_budget)
    : "—";

  async function handleShare(): Promise<void> {
    const url = `${window.location.origin}${sharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
    } catch {
      setShareCopied(false);
    }
  }

  function openDuplicateModal() {
    const next = splitEventDateTime(event.starts_at);
    setDuplicateName(`${event.name} (Copy)`);
    setDuplicateDate(next.event_date);
    setDuplicateTime(next.event_time);
    setDuplicateError(null);
    setDuplicateOpen(true);
  }

  async function handleDuplicate(): Promise<void> {
    if (!duplicateDate || !duplicateTime) {
      setDuplicateError("Date and time are required.");
      return;
    }

    setDuplicating(true);
    setDuplicateError(null);
    try {
      const created = await duplicateEvent(event.id, {
        starts_at: combineDateAndTime(duplicateDate, duplicateTime),
        name: duplicateName.trim() || undefined,
      });
      setDuplicateOpen(false);
      void navigate(`/events/${created.id}/manage`);
    } catch (caught) {
      setDuplicateError(getApiErrorMessage(caught));
    } finally {
      setDuplicating(false);
    }
  }

  const viewPageLabel = canSharePublicly
    ? "View public page"
    : "View event page";
  const shareLabel = shareCopied ? "Link copied" : "Share";
  const mobileActionBtn = "event-manage-mobile-action";

  function openWorkspace(tab: EventManageTab) {
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    next.delete("modal");
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <header className="event-command-header" aria-label="Event overview">
      <PageBackLink to={backTo} label="Events" />

      <div className="event-command-title-row">
        <h1 className="event-command-title">{event.name}</h1>
        <p className="event-command-status">{lifecycle.label}</p>
      </div>
      <p className="event-command-meta">{metaLine}</p>

      <div className="event-command-actions">
        <button
          type="button"
          onClick={onEditEvent}
          className="event-command-btn event-command-btn--primary"
        >
          <AppIcon icon={Pencil} size="xs" className="text-current" />
          Edit event
        </button>
        <button
          type="button"
          onClick={() => {
            void handleShare();
          }}
          className={["event-command-btn", shareCopied ? "is-copied" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
        >
          <AppIcon icon={Share2} size="xs" className="text-current" />
          {shareLabel}
        </button>
        <button type="button" onClick={onCheckIn} className="event-command-btn">
          <AppIcon icon={ClipboardCheck} size="xs" className="text-current" />
          Check-in
        </button>
        <button
          type="button"
          onClick={() => setMoreActionsOpen(true)}
          className="event-command-btn event-command-btn--icon"
          aria-haspopup="dialog"
          aria-expanded={moreActionsOpen}
          aria-label="More actions"
        >
          <AppIcon icon={MoreHorizontal} size="xs" className="text-current" />
        </button>
      </div>

      <Drawer
        open={moreActionsOpen}
        onClose={() => setMoreActionsOpen(false)}
        side={isMobile ? "bottom" : "right"}
        title="More actions"
        className="event-manage-more-drawer"
      >
        <div className="flex flex-col gap-2">
          <Link
            to={canSharePublicly ? sharePath : memberPath}
            className={`event-command-btn ${mobileActionBtn}`}
            onClick={() => setMoreActionsOpen(false)}
          >
            <AppIcon icon={ExternalLink} size="xs" className="text-current" />
            {viewPageLabel}
          </Link>
          <button
            type="button"
            onClick={() => {
              setMoreActionsOpen(false);
              openDuplicateModal();
            }}
            className={`event-command-btn ${mobileActionBtn}`}
          >
            <AppIcon icon={Copy} size="xs" className="text-current" />
            Duplicate event
          </button>
        </div>
      </Drawer>

      <Modal
        open={duplicateOpen}
        title="Duplicate event"
        onClose={() => {
          if (!duplicating) {
            setDuplicateOpen(false);
          }
        }}
      >
        <p className="text-sm text-gray-600">
          Creates a new event with the same details, volunteer roles, and simple
          tasks. RSVPs and check-ins are not copied.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="duplicate-event-name"
              className="block text-xs font-medium text-gray-500"
            >
              Name
            </label>
            <input
              id="duplicate-event-name"
              type="text"
              value={duplicateName}
              onChange={(changeEvent) =>
                setDuplicateName(changeEvent.target.value)
              }
              className={`${inputFieldClassName} mt-1`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="duplicate-event-date"
                className="block text-xs font-medium text-gray-500"
              >
                Date
              </label>
              <input
                id="duplicate-event-date"
                type="date"
                min={getMinEventDate()}
                value={duplicateDate}
                onChange={(changeEvent) =>
                  setDuplicateDate(changeEvent.target.value)
                }
                className={`${inputFieldClassName} mt-1`}
              />
            </div>
            <div>
              <label
                htmlFor="duplicate-event-time"
                className="block text-xs font-medium text-gray-500"
              >
                Time
              </label>
              <input
                id="duplicate-event-time"
                type="time"
                value={duplicateTime}
                onChange={(changeEvent) =>
                  setDuplicateTime(changeEvent.target.value)
                }
                className={`${inputFieldClassName} mt-1`}
              />
            </div>
          </div>
          {duplicateError ? (
            <p className="text-sm text-red-700" role="alert">
              {duplicateError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDuplicateOpen(false)}
              disabled={duplicating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleDuplicate()}
              disabled={duplicating}
            >
              {duplicating ? "Duplicating…" : "Create copy"}
            </Button>
          </div>
        </div>
      </Modal>

      <div
        className="event-command-metrics"
        data-testid="event-command-metrics"
      >
        <button
          type="button"
          className="event-command-metric"
          onClick={() => openWorkspace("attendees")}
        >
          <p className="event-command-metric-value">
            {attendeeCount === null ? "—" : String(attendeeCount)}
          </p>
          <span className="event-command-metric-label">Attending</span>
        </button>
        <button
          type="button"
          className="event-command-metric"
          onClick={() => openWorkspace("operations")}
        >
          <p className="event-command-metric-value">{budgetValue}</p>
          <span className="event-command-metric-label">Budget</span>
        </button>
        <button
          type="button"
          className="event-command-metric"
          onClick={() => openWorkspace("operations")}
        >
          <p className="event-command-metric-value">
            {volunteerCount === null ? "—" : String(volunteerCount)}
          </p>
          <span className="event-command-metric-label">Volunteers</span>
        </button>
        <button
          type="button"
          className="event-command-metric"
          onClick={() => openWorkspace("operations")}
        >
          <p className="event-command-metric-value">{String(openTasks)}</p>
          <span className="event-command-metric-label">
            {openTasks === 1 ? "Open task" : "Open tasks"}
          </span>
        </button>
      </div>
    </header>
  );
}
