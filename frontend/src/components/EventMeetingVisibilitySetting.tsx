import { useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import { patchEvent, type EventDetailResponse } from "../lib/events-api";
import type { MeetingVisibility } from "../lib/event-types";
import { Card } from "./ui/Card";

type EventMeetingVisibilitySettingProps = {
  event: EventDetailResponse;
  onUpdated: (event: EventDetailResponse) => void;
  compact?: boolean;
};

const VISIBILITY_OPTIONS: {
  value: MeetingVisibility;
  label: string;
  description: string;
}[] = [
  {
    value: "board_only",
    label: "Closed (board only)",
    description:
      "Hidden from the member calendar, home feed, and reminder emails.",
  },
  {
    value: "public",
    label: "Open (all members)",
    description: "Visible to every approved member like other events.",
  },
];

export function EventMeetingVisibilitySetting({
  event,
  onUpdated,
  compact = false,
}: EventMeetingVisibilitySettingProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current =
    event.meeting_visibility === "public" ? "public" : "board_only";

  async function handleChange(next: MeetingVisibility) {
    if (next === current) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await patchEvent(event.id, {
        meeting_visibility: next,
      });
      onUpdated({ ...event, ...updated });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  const fields = (
    <>
      {!compact ? (
        <p className="mt-1 text-sm text-label">
          Control whether general members can see this meeting on the calendar.
        </p>
      ) : null}
      <fieldset
        className={compact ? "mt-1 space-y-2" : "mt-4 space-y-3"}
        disabled={isSaving}
      >
        <legend className="sr-only">Meeting visibility</legend>
        {VISIBILITY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={
              compact
                ? "flex cursor-pointer items-start gap-2"
                : "flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3"
            }
          >
            <input
              type="radio"
              name={`meeting-visibility-${event.id}`}
              value={option.value}
              checked={current === option.value}
              onChange={() => void handleChange(option.value)}
              className="mt-0.5 h-4 w-4 border-gray-300 text-accent focus:ring-accent"
            />
            <span>
              <span
                className={
                  compact
                    ? "text-xs font-medium text-foreground"
                    : "text-sm font-medium text-foreground"
                }
              >
                {option.label}
              </span>
              {!compact ? (
                <span className="mt-0.5 block text-sm text-label">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="mt-2 ds-field-error">
          {error}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div>
        <p className="text-xs font-medium text-label">Meeting visibility</p>
        {fields}
      </div>
    );
  }

  return (
    <Card padding="none" className="p-4 sm:p-6">
      <h2 className="text-sm font-medium text-foreground">Meeting visibility</h2>
      {fields}
    </Card>
  );
}
