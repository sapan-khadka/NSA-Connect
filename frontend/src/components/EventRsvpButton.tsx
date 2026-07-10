import { Check, Circle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { RsvpStatus } from "../lib/events-api";
import { formatRsvpStatus, RSVP_STATUS_LABELS } from "../lib/event-rsvp";
import {
  playGoingBurst,
  playMaybeWobble,
  playNotGoingCries,
} from "../lib/rsvp-reactions";
import { AppIcon } from "./ui/AppIcon";

const RSVP_OPTIONS: {
  value: RsvpStatus;
  label: string;
  icon: typeof Check;
}[] = [
  { value: "going", label: RSVP_STATUS_LABELS.going, icon: Check },
  { value: "maybe", label: RSVP_STATUS_LABELS.maybe, icon: Circle },
  { value: "not_going", label: RSVP_STATUS_LABELS.not_going, icon: X },
];

const RSVP_CONFIRMATIONS: Record<
  RsvpStatus,
  { message: string; className: string }
> = {
  going: {
    message: "Yayyy! Can't wait to see you there.",
    className: "text-accent",
  },
  maybe: {
    message: "Still deciding? We'd love to see you there.",
    className: "text-marigold",
  },
  not_going: {
    message: "Aww, we'll miss you. See you next time.",
    className: "text-label",
  },
};

type EventRsvpButtonProps = {
  currentStatus: RsvpStatus | null;
  canRsvp: boolean;
  loading: boolean;
  onStatusChange: (status: RsvpStatus) => void;
  embedded?: boolean;
  /** Compact joined pill group for invitation-style cards. */
  variant?: "default" | "segmented";
};

function buttonClass(
  isSelected: boolean,
  variant: "default" | "segmented",
  index: number,
  total: number,
): string {
  if (variant === "segmented") {
    const edges =
      index === 0
        ? "rounded-l-full rounded-r-none"
        : index === total - 1
          ? "rounded-r-full rounded-l-none"
          : "rounded-none";
    const base = `ds-icon-label min-w-0 flex-1 justify-center border px-3 py-2 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${edges}`;
    if (isSelected) {
      return `${base} z-[1] border-primary bg-primary text-white`;
    }
    return `${base} -ml-px border-gray-200 bg-white text-foreground hover:bg-surface-muted first:ml-0`;
  }

  const base =
    "ds-icon-label inline-flex shrink-0 justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  if (isSelected) {
    return `${base} bg-primary text-white`;
  }

  return `${base} border border-gray-200 bg-white text-foreground transition duration-200 hover:border-primary/40 hover:bg-badge-teal-bg`;
}

function playReaction(status: RsvpStatus, anchor: HTMLElement): void {
  if (status === "going") {
    playGoingBurst(anchor);
    return;
  }
  if (status === "maybe") {
    playMaybeWobble(anchor);
    return;
  }
  playNotGoingCries(anchor);
}

export function EventRsvpButton({
  currentStatus,
  canRsvp,
  loading,
  onStatusChange,
  embedded = false,
  variant = "default",
}: EventRsvpButtonProps) {
  const buttonRefs = useRef<Partial<Record<RsvpStatus, HTMLButtonElement>>>({});
  const [displayStatus, setDisplayStatus] = useState<RsvpStatus | null>(
    currentStatus,
  );

  useEffect(() => {
    setDisplayStatus(currentStatus);
  }, [currentStatus]);

  const showPrompt = canRsvp && displayStatus === null;
  const isSegmented = variant === "segmented";

  function handleOptionClick(status: RsvpStatus): void {
    setDisplayStatus(status);

    const anchor = buttonRefs.current[status];
    if (anchor) {
      playReaction(status, anchor);
    }
    onStatusChange(status);
  }

  return (
    <div
      className={
        embedded
          ? isSegmented
            ? "mt-4"
            : "mt-4 border-t border-gray-100 pt-4"
          : "ds-card p-3"
      }
    >
      {!isSegmented ? (
        <p className="text-sm font-medium text-foreground">Your RSVP</p>
      ) : null}

      {showPrompt && !isSegmented ? (
        <p
          role="status"
          className="mt-2 rounded-md border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm text-foreground"
        >
          You haven&apos;t RSVP&apos;d yet — let us know if you plan to attend.
        </p>
      ) : null}

      {canRsvp ? (
        <>
          <div
            role="group"
            aria-label="RSVP options"
            className={
              isSegmented
                ? "inline-flex w-full max-w-md overflow-hidden rounded-full shadow-sm"
                : "mt-3 flex flex-wrap gap-2"
            }
          >
            {RSVP_OPTIONS.map((option, index) => {
              const isSelected = displayStatus === option.value;
              return (
                <div
                  key={option.value}
                  data-rsvp-reaction-host
                  className={
                    isSegmented
                      ? "relative min-w-0 flex-1 overflow-visible"
                      : "relative overflow-visible"
                  }
                >
                  <button
                    ref={(element) => {
                      buttonRefs.current[option.value] = element ?? undefined;
                    }}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={loading}
                    onClick={() => handleOptionClick(option.value)}
                    className={buttonClass(
                      isSelected,
                      variant,
                      index,
                      RSVP_OPTIONS.length,
                    )}
                  >
                    <AppIcon
                      icon={option.icon}
                      size="xs"
                      className="text-current"
                    />
                    {loading && isSelected ? "Updating…" : option.label}
                  </button>
                </div>
              );
            })}
          </div>

          {displayStatus && !isSegmented ? (
            <p
              key={displayStatus}
              role="status"
              className={`rsvp-confirmation-message mt-2 text-sm ${RSVP_CONFIRMATIONS[displayStatus].className}`}
            >
              {RSVP_CONFIRMATIONS[displayStatus].message}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-label">
          {displayStatus
            ? `Your response: ${formatRsvpStatus(displayStatus)}.`
            : "RSVP is closed for past events."}
        </p>
      )}
    </div>
  );
}
