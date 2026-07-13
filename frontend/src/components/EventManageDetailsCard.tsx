import { useEffect, useRef, useState, type ReactNode } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  combineDateAndTime,
  getMinEventDate,
  splitEventDateTime,
  validateCreateEventField,
} from "../lib/event-form";
import {
  deleteEventCoverPhoto,
  patchEvent,
  uploadEventCoverPhoto,
  type EventDetailResponse,
  type EventResponse,
} from "../lib/events-api";
import {
  EVENT_MANAGE_EMPTY,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECTION_SUBTITLE,
  EVENT_MANAGE_SECTION_TITLE,
} from "../lib/event-manage-ui";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { EventMeetingVisibilitySetting } from "./EventMeetingVisibilitySetting";
import { Button } from "./ui/Button";
import { HomeCard } from "./ui/HomeCard";
import { inputFieldClassName } from "./ui/Input";

const inputClassName = `${inputFieldClassName} mt-1`;

type EventManageDetailsCardProps = {
  event: EventDetailResponse;
  onUpdated: (event: EventDetailResponse) => void;
};

function DetailsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className={EVENT_MANAGE_EYEBROW}>{title}</h3>
      {children}
    </section>
  );
}

function ReadOnlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {multiline ? (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {value}
        </p>
      ) : (
        <p className="mt-1 text-sm font-medium leading-snug text-foreground">
          {value}
        </p>
      )}
    </div>
  );
}

export function EventManageDetailsCard({
  event,
  onUpdated,
}: EventManageDetailsCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = splitEventDateTime(event.starts_at);

  const [eventDate, setEventDate] = useState(initial.event_date);
  const [eventTime, setEventTime] = useState(initial.event_time);
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [photoSaving, setPhotoSaving] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  useEffect(() => {
    const next = splitEventDateTime(event.starts_at);
    setEventDate(next.event_date);
    setEventTime(next.event_time);
    setDateError(null);
    setTimeError(null);
    setScheduleError(null);
  }, [event.id, event.starts_at]);

  const savedSchedule = splitEventDateTime(event.starts_at);
  const scheduleDirty =
    eventDate !== savedSchedule.event_date ||
    eventTime !== savedSchedule.event_time;

  async function handleSaveSchedule() {
    const nextDateError = validateCreateEventField("event_date", eventDate, {
      name: event.name,
      description: event.description,
      event_type: event.event_type,
      event_date: eventDate,
      event_time: eventTime,
      budget: "",
    });
    const nextTimeError = validateCreateEventField("event_time", eventTime, {
      name: event.name,
      description: event.description,
      event_type: event.event_type,
      event_date: eventDate,
      event_time: eventTime,
      budget: "",
    });

    setDateError(nextDateError);
    setTimeError(nextTimeError);
    setScheduleError(null);

    if (nextDateError || nextTimeError) {
      return;
    }

    setScheduleSaving(true);
    try {
      const updated = await patchEvent(event.id, {
        starts_at: combineDateAndTime(eventDate, eventTime),
      });
      onUpdated({ ...event, ...updated });
    } catch (caught) {
      setScheduleError(getApiErrorMessage(caught));
    } finally {
      setScheduleSaving(false);
    }
  }

  async function applyPhotoUpdate(updated: EventResponse) {
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

    setPhotoSaving(true);
    setPhotoError(null);
    setPreviewName(file.name);

    try {
      const updated = await uploadEventCoverPhoto(event.id, file);
      await applyPhotoUpdate(updated);
    } catch (caught) {
      setPhotoError(getApiErrorMessage(caught));
      setPreviewName(null);
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoSaving(true);
    setPhotoError(null);

    try {
      const updated = await deleteEventCoverPhoto(event.id);
      await applyPhotoUpdate(updated);
    } catch (caught) {
      setPhotoError(getApiErrorMessage(caught));
    } finally {
      setPhotoSaving(false);
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

  const location = event.location?.trim() || "Location TBA";
  const description = event.description?.trim() || "No description yet.";

  return (
    <HomeCard
      padding="md"
      className={EVENT_MANAGE_SECTION_CARD_CLASS}
      aria-label="Event Details"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={EVENT_MANAGE_SECTION_TITLE}>Event Details</h2>
          <p className={EVENT_MANAGE_SECTION_SUBTITLE}>
            Core information for this event.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)] lg:items-start">
        <div className="min-w-0 space-y-8">
          <DetailsGroup title="General Information">
            <ReadOnlyField label="Event name" value={event.name} />
          </DetailsGroup>

          <DetailsGroup title="Category">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
            >
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
          </DetailsGroup>

          <div id="event-manage-schedule">
            <DetailsGroup title="Date & Time">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="manage-event-date"
                    className="block text-xs font-medium text-gray-500"
                  >
                    Date
                  </label>
                  <input
                    id="manage-event-date"
                    type="date"
                    min={getMinEventDate()}
                    value={eventDate}
                    onChange={(changeEvent) => {
                      setEventDate(changeEvent.target.value);
                      setDateError(null);
                      setScheduleError(null);
                    }}
                    className={inputClassName}
                  />
                  {dateError ? (
                    <p className="mt-1 ds-field-error">{dateError}</p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor="manage-event-time"
                    className="block text-xs font-medium text-gray-500"
                  >
                    Start time
                  </label>
                  <input
                    id="manage-event-time"
                    type="time"
                    value={eventTime}
                    onChange={(changeEvent) => {
                      setEventTime(changeEvent.target.value);
                      setTimeError(null);
                      setScheduleError(null);
                    }}
                    className={inputClassName}
                  />
                  {timeError ? (
                    <p className="mt-1 ds-field-error">{timeError}</p>
                  ) : null}
                </div>
              </div>

              {scheduleError ? (
                <p role="alert" className="ds-field-error">
                  {scheduleError}
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!scheduleDirty || scheduleSaving}
                  loading={scheduleSaving}
                  onClick={() => void handleSaveSchedule()}
                >
                  Save schedule
                </Button>
              </div>
            </DetailsGroup>
          </div>

          <DetailsGroup title="Location">
            <ReadOnlyField label="Venue" value={location} />
          </DetailsGroup>

          <DetailsGroup title="Description">
            <ReadOnlyField label="About this event" value={description} multiline />
          </DetailsGroup>

          {event.event_type === "meeting" ? (
            <DetailsGroup title="Meeting visibility">
              <EventMeetingVisibilitySetting
                event={event}
                onUpdated={onUpdated}
                compact
              />
            </DetailsGroup>
          ) : null}
        </div>

        <DetailsGroup title="Cover Image">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
            {event.event_photo_url ? (
              <div className="relative aspect-[4/5] w-full sm:aspect-[3/4]">
                <img
                  src={event.event_photo_url}
                  alt={`Cover for ${event.name}`}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
                />
              </div>
            ) : (
              <div
                className={`flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 px-6 text-center sm:aspect-[3/4] ${EVENT_MANAGE_EMPTY} rounded-none border-0`}
              >
                <p className="text-sm font-medium text-foreground">
                  No cover photo yet
                </p>
                <p className="text-xs leading-relaxed text-gray-500">
                  JPEG, PNG, or HEIC up to 15 MB
                </p>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
            disabled={photoSaving}
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
              disabled={photoSaving}
              onClick={() => inputRef.current?.click()}
            >
              {event.event_photo_url ? "Replace photo" : "Choose file"}
            </Button>
            {event.event_photo_url ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={photoSaving}
                onClick={() => {
                  void handleRemovePhoto();
                }}
              >
                {photoSaving ? "Saving…" : "Remove"}
              </Button>
            ) : null}
          </div>

          <p
            className="truncate text-xs text-gray-500"
            title={previewName ?? undefined}
          >
            {previewName
              ? photoSaving
                ? `Uploading ${previewName}…`
                : previewName
              : event.event_photo_url
                ? "Photo uploaded"
                : "No file chosen"}
          </p>

          {photoError ? (
            <p role="alert" className="ds-field-error">
              {photoError}
            </p>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={event.show_in_photo_archive}
              disabled={archiveSaving}
              onChange={(changeEvent) =>
                void handleArchiveToggle(changeEvent.target.checked)
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Show in photo archive
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                Include this event in the shared album.
              </span>
            </span>
          </label>

          {archiveError ? (
            <p role="alert" className="ds-field-error">
              {archiveError}
            </p>
          ) : null}
        </DetailsGroup>
      </div>
    </HomeCard>
  );
}
