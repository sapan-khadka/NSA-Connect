import { useRef, useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  deleteEventCoverPhoto,
  patchEvent,
  uploadEventCoverPhoto,
  type EventDetailResponse,
  type EventResponse,
} from "../lib/events-api";
import { Button } from "./ui/Button";
import { HomeCard } from "./ui/HomeCard";
import { EventMeetingVisibilitySetting } from "./EventMeetingVisibilitySetting";

type EventCoverPhotoSettingProps = {
  event: EventDetailResponse;
  onUpdated: (event: EventDetailResponse) => void;
  /** Compact Home-style card with archive checkbox inline. */
  compact?: boolean;
};

export function EventCoverPhotoSetting({
  event,
  onUpdated,
  compact = false,
}: EventCoverPhotoSettingProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  async function applyUpdate(updated: EventResponse) {
    onUpdated({ ...event, ...updated });
    setPreviewName(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFileChange(file: File | null) {
    if (!file) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setPreviewName(file.name);

    try {
      const updated = await uploadEventCoverPhoto(event.id, file);
      await applyUpdate(updated);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setPreviewName(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove() {
    setIsSaving(true);
    setError(null);

    try {
      const updated = await deleteEventCoverPhoto(event.id);
      await applyUpdate(updated);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveToggle(checked: boolean) {
    setArchiveSaving(true);
    setArchiveError(null);
    try {
      const updated = await patchEvent(event.id, {
        show_in_photo_archive: checked,
      });
      onUpdated({ ...event, ...updated });
    } catch (caught) {
      setArchiveError(getApiErrorMessage(caught));
    } finally {
      setArchiveSaving(false);
    }
  }

  const body = (
    <>
      {!compact ? (
        <p className="mt-1 text-sm text-label">
          Upload a photo specific to this event for the home Upcoming Event
          card. JPEG, PNG, or HEIC up to 15 MB.
        </p>
      ) : null}

      {event.event_photo_url ? (
        <div
          className={
            compact
              ? "relative mt-2 h-20 w-full overflow-hidden rounded-lg bg-surface-muted"
              : "relative mt-3 h-36 w-full max-w-xs overflow-hidden rounded-xl bg-surface-muted"
          }
        >
          <img
            src={event.event_photo_url}
            alt={`Photo for ${event.name}`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className={
            compact
              ? "mt-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-surface-muted/40 text-xs text-label"
              : "mt-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-label"
          }
        >
          No photo yet
        </div>
      )}

      <div
        className={
          compact
            ? "mt-2 flex flex-col gap-2"
            : "mt-3 flex flex-wrap items-center gap-3"
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
          disabled={isSaving}
          onChange={(changeEvent) => {
            const file = changeEvent.target.files?.[0] ?? null;
            void handleFileChange(file);
          }}
          className="sr-only"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={() => inputRef.current?.click()}
          >
            Choose File
          </Button>
          {event.event_photo_url ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSaving}
              onClick={() => {
                void handleRemove();
              }}
            >
              {isSaving ? "Saving…" : "Remove"}
            </Button>
          ) : null}
        </div>
        <p className="truncate text-xs text-label" title={previewName ?? undefined}>
          {previewName
            ? isSaving
              ? `Uploading ${previewName}…`
              : previewName
            : event.event_photo_url
              ? "Photo uploaded"
              : "No file chosen"}
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-1 ds-field-error">
          {error}
        </p>
      ) : null}

      {compact ? (
        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={event.show_in_photo_archive}
            disabled={archiveSaving}
            onChange={(changeEvent) =>
              void handleArchiveToggle(changeEvent.target.checked)
            }
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
          />
          <span className="text-xs font-medium text-foreground">
            Show in photo archive
          </span>
        </label>
      ) : null}

      {archiveError ? (
        <p role="alert" className="mt-1 ds-field-error">
          {archiveError}
        </p>
      ) : null}

      {compact && event.event_type === "meeting" ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <EventMeetingVisibilitySetting
            event={event}
            onUpdated={onUpdated}
            compact
          />
        </div>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <HomeCard padding="sm" className="flex h-full min-h-0 flex-col home-surface-quiet">
        <h2 className="home-section-title">Event photo</h2>
        {body}
      </HomeCard>
    );
  }

  return (
    <HomeCard padding="md" className="home-surface-quiet">
      <h2 className="text-sm font-medium text-foreground">Event photo</h2>
      {body}
    </HomeCard>
  );
}
