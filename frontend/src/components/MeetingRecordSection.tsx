import { useCallback, useEffect, useState } from "react";

import { MeetingAttendancePanel } from "./MeetingAttendancePanel";
import { MeetingMinutesEditor } from "./MeetingMinutesEditor";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchMeetingDetail,
  saveMeetingAttendance,
  saveMeetingNotes,
  summarizeMeetingForEvent,
  type MeetingDetailResponse,
} from "../lib/meetings-api";

type MeetingRecordSectionProps = {
  eventId: number;
  eventName: string;
};

export function MeetingRecordSection({
  eventId,
  eventName,
}: MeetingRecordSectionProps) {
  const [detail, setDetail] = useState<MeetingDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchMeetingDetail(eventId);
      setDetail(response);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading meeting record…</p>;
  }

  if (error || !detail) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        {error ?? "Could not load meeting record."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MeetingAttendancePanel
        attendance={detail.attendance}
        canManage={detail.can_manage}
        presentCount={detail.present_count}
        absentCount={detail.absent_count}
        excusedCount={detail.excused_count}
        unmarkedCount={detail.unmarked_count}
        saving={attendanceSaving}
        onSave={async (entries) => {
          setAttendanceSaving(true);
          try {
            const updated = await saveMeetingAttendance(eventId, entries);
            setDetail(updated);
          } finally {
            setAttendanceSaving(false);
          }
        }}
      />

      <MeetingMinutesEditor
        eventName={eventName}
        minutes={detail.minutes}
        canManage={detail.can_manage}
        onSaveNotes={async (rawNotes) => {
          const updated = await saveMeetingNotes(eventId, rawNotes);
          setDetail((current) =>
            current ? { ...current, minutes: updated } : current,
          );
          return updated;
        }}
        onSummarize={async (rawNotes) => {
          const updated = await summarizeMeetingForEvent(eventId, rawNotes);
          setDetail((current) =>
            current ? { ...current, minutes: updated } : current,
          );
          return updated;
        }}
      />
    </div>
  );
}
