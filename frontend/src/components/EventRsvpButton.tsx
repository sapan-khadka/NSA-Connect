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
  waitlisted: {
    message: "You're on the waitlist. We'll notify you if a spot opens.",
    className: "text-gray-500",
  },
};

type EventRsvpButtonProps = {
  currentStatus: RsvpStatus | null;
  canRsvp: boolean;
  loading: boolean;
  onStatusChange: (status: RsvpStatus) => void;
  /** When true, show Join waitlist instead of / in addition to Going. */
  atCapacity?: boolean;
  embedded?: boolean;
  /**
   * default — pill buttons
   * segmented — compact horizontal control (wraps when narrow)
   * menu — segmented control with optional heading (cards / sidebar)
   */
  variant?: "default" | "segmented" | "menu";
  /** Optional heading override for menu variant (presentation only). */
  menuHeading?: string;
  /** Optional support copy shown above the options in menu variant. */
  menuSupportText?: string;
  /** Hide the menu heading when the parent already provides one. */
  hideMenuHeading?: boolean;
};

function defaultButtonClass(isSelected: boolean): string {
  const base =
    "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:shrink-0";

  if (isSelected) {
    return `${base} bg-primary text-white`;
  }

  return `${base} border border-gray-200 bg-white text-foreground transition duration-200 hover:border-primary/40 hover:bg-badge-teal-bg`;
}

function segmentedButtonClass(isSelected: boolean): string {
  const base =
    "rsvp-segmented-btn disabled:cursor-not-allowed disabled:opacity-60";

  if (isSelected) {
    return `${base} rsvp-segmented-btn--selected`;
  }

  return `${base} rsvp-segmented-btn--idle`;
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
  atCapacity = false,
  embedded = false,
  variant = "default",
  menuHeading = "Your RSVP",
  menuSupportText,
  hideMenuHeading = false,
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
  const isMenu = variant === "menu";
  const useSegmentedControl = isSegmented || isMenu;
  const showConfirmation = Boolean(displayStatus) && !embedded && !isMenu;
  const options = atCapacity
    ? [
        ...RSVP_OPTIONS.filter((option) => option.value !== "going"),
        {
          value: "waitlisted" as const,
          label: RSVP_STATUS_LABELS.waitlisted,
          icon: Circle,
        },
      ]
    : RSVP_OPTIONS;

  function handleOptionClick(status: RsvpStatus): void {
    setDisplayStatus(status);

    const anchor = buttonRefs.current[status];
    if (anchor && status !== "waitlisted") {
      playReaction(status, anchor);
    }
    onStatusChange(status);
  }

  const shellClass = embedded
    ? useSegmentedControl
      ? ""
      : "mt-3 border-t border-gray-100 pt-3"
    : "ds-card p-3";

  function renderSegmentedControl() {
    return (
      <div role="group" aria-label="RSVP options" className="rsvp-segmented">
        {options.map((option) => {
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
                  size="xs"
                  className="shrink-0 text-current"
                />
              ) : null}
              <span className="truncate">
                {loading && isSelected ? "Updating…" : option.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (isMenu) {
    return (
      <div className={shellClass}>
        {hideMenuHeading ? null : (
          <p className="text-sm font-medium text-foreground">{menuHeading}</p>
        )}
        {canRsvp ? (
          <div className={hideMenuHeading ? "" : "mt-2"}>
            {menuSupportText ? (
              <p className="mb-2 text-xs leading-relaxed text-label">
                {menuSupportText}
              </p>
            ) : null}
            {renderSegmentedControl()}
          </div>
        ) : (
          <p className="mt-2 text-sm text-label">
            {displayStatus
              ? `Your response: ${formatRsvpStatus(displayStatus)}.`
              : "RSVP is closed for past events."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={shellClass}>
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
            renderSegmentedControl()
          ) : (
            <div
              role="group"
              aria-label="RSVP options"
              className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
            >
              {options.map((option) => {
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

          {showConfirmation ? (
            <p
              key={displayStatus!}
              role="status"
              className={`rsvp-confirmation-message mt-2 text-sm font-normal leading-relaxed tracking-[-0.01em] ${RSVP_CONFIRMATIONS[displayStatus!].className}`}
            >
              {RSVP_CONFIRMATIONS[displayStatus!].message}
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
