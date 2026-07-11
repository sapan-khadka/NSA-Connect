import { useRef, useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  deleteEventCoverPhoto,
  uploadEventCoverPhoto,
  type EventDetailResponse,
  type EventResponse,
} from "../lib/events-api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";

type EventCoverPhotoSettingProps = {
  event: EventDetailResponse;
  onUpdated: (event: EventDetailResponse) => void;
};

export function EventCoverPhotoSetting({
  event,
  onUpdated,
}: EventCoverPhotoSettingProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <Card padding="none" className="p-4 sm:p-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Event photo</h2>
          <p className="mt-1 text-sm text-label">
            Upload a photo specific to this event for the home Upcoming Event
            card. JPEG, PNG, or HEIC up to 15 MB.
          </p>
        </div>

        {event.event_photo_url ? (
          <div className="relative h-36 w-full max-w-xs overflow-hidden rounded-xl bg-surface-muted">
            <img
              src={event.event_photo_url}
              alt={`Photo for ${event.name}`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center">
            <span className="sr-only">Choose event photo</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
              disabled={isSaving}
              onChange={(changeEvent) => {
                const file = changeEvent.target.files?.[0] ?? null;
                void handleFileChange(file);
              }}
              className={`${inputFieldClassName} max-w-xs cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white`}
            />
          </label>
          {event.event_photo_url ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() => {
                void handleRemove();
              }}
            >
              {isSaving ? "Saving…" : "Remove photo"}
            </Button>
          ) : null}
        </div>

        {previewName && isSaving ? (
          <p className="text-sm text-label">Uploading {previewName}…</p>
        ) : null}

        {error ? (
          <p role="alert" className="ds-field-error">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
