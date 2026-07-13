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

/** Muted status copy — neutral prompts, not alert/error styling. */
const RSVP_CONFIRMATIONS: Record<
  RsvpStatus,
  { message: string; className: string }
> = {
  going: {
    message: "Yayyy! Can't wait to see you there.",
    className: "text-primary/80",
  },
  maybe: {
    message: "Still deciding? We'd love to see you there.",
    className: "text-gray-500",
  },
  not_going: {
    message: "Aww, we'll miss you. See you next time.",
    className: "text-gray-500",
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

function defaultButtonClass(isSelected: boolean): string {
  const base =
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  if (isSelected) {
    return `${base} bg-primary text-white`;
  }

  return `${base} border border-gray-200 bg-white text-foreground transition duration-200 hover:border-primary/40 hover:bg-badge-teal-bg`;
}

function segmentedButtonClass(isSelected: boolean): string {
  // Flat segments — no per-button radius/border. Outer pill clips the fill.
  // text-[13px] keeps "Not going" + selected icon on one line in the home card column.
  const base =
    "relative flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-0 px-1 text-[13px] font-medium leading-none transition-[background-color] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60";

  if (isSelected) {
    return `${base} bg-primary text-white`;
  }

  return `${base} bg-transparent text-gray-700 hover:bg-gray-50`;
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
            ? "mt-1"
            : "mt-3 border-t border-gray-100 pt-3"
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
          {isSegmented ? (
            <div
              role="group"
              aria-label="RSVP options"
              className="flex h-11 w-full min-w-0 overflow-hidden rounded-full border border-gray-200 bg-white"
            >
              {RSVP_OPTIONS.map((option) => {
                const isSelected = displayStatus === option.value;
                return (
                  <button
                    key={option.value}
                    ref={(element) => {
                      buttonRefs.current[option.value] = element ?? undefined;
                    }}
                    type="button"
                    data-rsvp-reaction-host
                    aria-pressed={isSelected}
                    disabled={loading}
                    onClick={() => handleOptionClick(option.value)}
                    className={segmentedButtonClass(isSelected)}
                  >
                    {isSelected ? (
                      <AppIcon
                        icon={option.icon}
                        size="sm"
                        className="h-4 w-4 shrink-0 text-current"
                      />
                    ) : null}
                    <span className="whitespace-nowrap">
                      {loading && isSelected ? "Updating…" : option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              role="group"
              aria-label="RSVP options"
              className="mt-3 flex flex-wrap gap-2"
            >
              {RSVP_OPTIONS.map((option) => {
                const isSelected = displayStatus === option.value;
                return (
                  <div
                    key={option.value}
                    data-rsvp-reaction-host
                    className="relative overflow-visible"
                  >
                    <button
                      ref={(element) => {
                        buttonRefs.current[option.value] =
                          element ?? undefined;
                      }}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={loading}
                      onClick={() => handleOptionClick(option.value)}
                      className={defaultButtonClass(isSelected)}
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
          )}

          {displayStatus ? (
            <p
              key={displayStatus}
              role="status"
              className={`rsvp-confirmation-message mt-2 text-sm font-normal leading-relaxed tracking-[-0.01em] ${RSVP_CONFIRMATIONS[displayStatus].className}`}
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
