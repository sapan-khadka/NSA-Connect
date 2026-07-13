import { Link } from "react-router-dom";
import {
  Bell,
  Mail,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

import {
  EVENT_MANAGE_EMPTY,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_PRIMARY_BTN,
  EVENT_MANAGE_SECONDARY_BTN,
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECTION_SUBTITLE,
  EVENT_MANAGE_SECTION_TITLE,
} from "../lib/event-manage-ui";
import { AppIcon } from "./ui/AppIcon";
import { HomeCard } from "./ui/HomeCard";

type CommStatus = "not_started" | "draft" | "scheduled" | "sent";

type CommunicationChannel = {
  id: "invitation" | "reminder" | "announcement";
  label: string;
  description: string;
  icon: LucideIcon;
  lastSent: string | null;
  scheduled: string | null;
  status: CommStatus;
};

type EventManageCommunicationsCardProps = {
  eventName: string;
};

function statusBadge(status: CommStatus): { label: string; className: string } {
  if (status === "sent") {
    return {
      label: "Sent",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100/80",
    };
  }
  if (status === "scheduled") {
    return {
      label: "Scheduled",
      className: "bg-sky-50 text-sky-800 ring-sky-100/80",
    };
  }
  if (status === "draft") {
    return {
      label: "Draft",
      className: "bg-amber-50 text-amber-800 ring-amber-100/80",
    };
  }
  return {
    label: "Not started",
    className: "bg-gray-100 text-gray-600 ring-gray-200/80",
  };
}

/**
 * No event-scoped communications API yet — card always renders the empty/preview
 * structure and routes actions to existing announcement destinations.
 */
function getPlaceholderChannels(): CommunicationChannel[] {
  return [
    {
      id: "invitation",
      label: "Invitation Email",
      description: "Invite members when the event is ready to share.",
      icon: Mail,
      lastSent: null,
      scheduled: null,
      status: "not_started",
    },
    {
      id: "reminder",
      label: "Reminder Email",
      description: "Nudge Going and Maybe RSVPs before the event.",
      icon: Bell,
      lastSent: null,
      scheduled: null,
      status: "not_started",
    },
    {
      id: "announcement",
      label: "Announcement",
      description: "Post updates for the wider organization.",
      icon: Megaphone,
      lastSent: null,
      scheduled: null,
      status: "not_started",
    },
  ];
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className={EVENT_MANAGE_EYEBROW}>{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

export function EventManageCommunicationsCard({
  eventName,
}: EventManageCommunicationsCardProps) {
  const channels = getPlaceholderChannels();
  const hasAnyActivity = channels.some((channel) => channel.status !== "not_started");

  return (
    <HomeCard
      padding="md"
      className={EVENT_MANAGE_SECTION_CARD_CLASS}
      aria-label="Event Communications"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={EVENT_MANAGE_SECTION_TITLE}>Communications</h2>
          <p className={EVENT_MANAGE_SECTION_SUBTITLE}>
            Invitations, reminders, and announcements for {eventName}.
          </p>
        </div>
      </div>

      {!hasAnyActivity ? (
        <div className={`mt-5 ${EVENT_MANAGE_EMPTY}`}>
          <p className="text-sm font-medium text-foreground">
            No messages sent yet
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            When event outreach is connected, last sent, scheduled, and draft
            status will appear here. Until then, start with an announcement or
            reminder draft.
          </p>
        </div>
      ) : null}

      <ul className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
        {channels.map((channel) => {
          const badge = statusBadge(channel.status);
          return (
            <li
              key={channel.id}
              className="flex flex-col gap-3 px-4 py-4 transition duration-150 hover:bg-gray-50/70 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600 ring-1 ring-gray-100">
                  <AppIcon icon={channel.icon} size="sm" className="text-current" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {channel.label}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    {channel.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:w-[18rem] sm:shrink-0">
                <MetaCell label="Last Sent" value={channel.lastSent ?? "—"} />
                <MetaCell label="Scheduled" value={channel.scheduled ?? "—"} />
                <MetaCell
                  label="Draft"
                  value={channel.status === "draft" ? "In progress" : "—"}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/board/announcement-email" className={EVENT_MANAGE_PRIMARY_BTN}>
          Send Reminder
        </Link>
        <Link to="/announcements" className={EVENT_MANAGE_SECONDARY_BTN}>
          View Announcement
        </Link>
        <Link to="/announcements" className={EVENT_MANAGE_SECONDARY_BTN}>
          Create Announcement
        </Link>
      </div>
    </HomeCard>
  );
}
