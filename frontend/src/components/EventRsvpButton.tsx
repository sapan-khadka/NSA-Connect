import { Check, ChevronDown, Circle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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
  /**
   * default — pill buttons
   * segmented — joined control for dense cards
   * menu — compact status trigger + dropdown (dashboard)
   */
  variant?: "default" | "segmented" | "menu";
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

function menuTriggerLabel(status: RsvpStatus | null, loading: boolean): string {
  if (loading) {
    return "Updating…";
  }
  if (status === "going") {
    return "You're Going";
  }
  if (status === "maybe") {
    return "You're a Maybe";
  }
  if (status === "not_going") {
    return "Not Going";
  }
  return "RSVP";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<RsvpStatus | null>(
    currentStatus,
  );

  useEffect(() => {
    setDisplayStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const showPrompt = canRsvp && displayStatus === null;
  const isSegmented = variant === "segmented";
  const isMenu = variant === "menu";

  function handleOptionClick(status: RsvpStatus): void {
    setDisplayStatus(status);
    setMenuOpen(false);

    const anchor = buttonRefs.current[status];
    if (anchor) {
      playReaction(status, anchor);
    }
    onStatusChange(status);
  }

  const shellClass = embedded
    ? isSegmented || isMenu
      ? ""
      : "mt-3 border-t border-gray-100 pt-3"
    : "ds-card p-3";

  if (isMenu) {
    const selectedOption = RSVP_OPTIONS.find(
      (option) => option.value === displayStatus,
    );
    const triggerLabel = menuTriggerLabel(displayStatus, loading);

    return (
      <div className={shellClass} ref={menuRef}>
        {canRsvp ? (
          <div className="relative">
            <button
              type="button"
              data-rsvp-reaction-host
              aria-label={
                displayStatus
                  ? `Change RSVP, currently ${formatRsvpStatus(displayStatus)}`
                  : "Set your RSVP"
              }
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              disabled={loading}
              onClick={() => setMenuOpen((open) => !open)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                displayStatus === "going"
                  ? "border-primary/25 bg-badge-teal-bg text-primary hover:border-primary/40"
                  : "border-gray-200 bg-white text-foreground hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {selectedOption ? (
                <AppIcon
                  icon={selectedOption.icon}
                  size="xs"
                  className="text-current"
                />
              ) : null}
              <span>{triggerLabel}</span>
              <AppIcon
                icon={ChevronDown}
                size="xs"
                className={`text-current opacity-60 transition duration-150 ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                aria-label="RSVP options"
                className="absolute bottom-full right-0 z-20 mb-2 min-w-[11rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-md transition duration-150"
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
                      role="menuitemradio"
                      aria-checked={isSelected}
                      disabled={loading}
                      onClick={() => handleOptionClick(option.value)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition duration-150 ease-out focus-visible:bg-gray-50 focus-visible:outline-none hover:bg-gray-50 ${
                        isSelected
                          ? "font-medium text-primary"
                          : "font-normal text-foreground"
                      }`}
                    >
                      <AppIcon
                        icon={option.icon}
                        size="xs"
                        className="text-current"
                      />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-label">
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
