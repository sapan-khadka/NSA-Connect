import { useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import { patchEvent, type EventDetailResponse } from "../lib/events-api";
import { Card } from "./ui/Card";

type EventPhotoArchiveSettingProps = {
  event: EventDetailResponse;
  onUpdated: (event: EventDetailResponse) => void;
};

export function EventPhotoArchiveSetting({
  event,
  onUpdated,
}: EventPhotoArchiveSettingProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(checked: boolean) {
    setIsSaving(true);
    setError(null);

    try {
      const updated = await patchEvent(event.id, {
        show_in_photo_archive: checked,
      });
      onUpdated({ ...event, ...updated });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card padding="none" className="p-4 sm:p-6">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={event.show_in_photo_archive}
          disabled={isSaving}
          onChange={(changeEvent) => void handleToggle(changeEvent.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
        />
        <span>
          <span className="text-sm font-medium text-foreground">
            Show in photo archive
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-2 ds-field-error">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
