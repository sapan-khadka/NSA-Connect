import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

import { DiscussionFeed } from "./DiscussionFeed";
import { MeetingAttendancePanel } from "./MeetingAttendancePanel";
import { MeetingFilesPanel } from "./MeetingFilesPanel";
import { MeetingMinutesEditor } from "./MeetingMinutesEditor";
import { MeetingStatusChips } from "./MeetingStatusChips";
import { Card } from "./ui/Card";
import { getApiErrorMessage } from "../lib/api-error";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  MEETING_WORKSPACE_TABS,
  meetingTabFromHash,
  parseMeetingWorkspaceTab,
  type MeetingWorkspaceTab,
} from "../lib/meeting-workspace";
import {
  meetingRecordStatus,
  saveMeetingAttendance,
  saveMeetingNotes,
  summarizeMeetingForEvent,
  type MeetingDetailResponse,
} from "../lib/meetings-api";

type MeetingWorkspaceProps = {
  detail: MeetingDetailResponse;
  onDetailChange: (detail: MeetingDetailResponse) => void;
};

function tabButtonClassName(active: boolean): string {
  return [
    "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
    active
      ? "bg-surface-card text-foreground shadow-sm"
      : "text-label hover:text-foreground",
  ].join(" ");
}

function OverviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-surface-muted/30 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-label">
        {label}
      </p>
      <p className="mt-1 text-xl font-light tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-label">{hint}</p> : null}
    </div>
  );
}

export function MeetingWorkspace({
  detail,
  onDetailChange,
}: MeetingWorkspaceProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<MeetingWorkspaceTab>(() =>
    parseMeetingWorkspaceTab(searchParams.get("tab")),
  );
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const selectTab = useCallback(
    (tab: MeetingWorkspaceTab) => {
      setActiveTab(tab);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (tab === "overview") {
            next.delete("tab");
          } else {
            next.set("tab", tab);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const fromHash = meetingTabFromHash(location.hash);
    if (!fromHash) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (fromHash === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", fromHash);
    }
    const search = next.toString();
    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
        hash: "",
      },
      { replace: true },
    );
    setActiveTab(fromHash);
  }, [location.hash, location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (location.hash) {
      return;
    }
    const fromUrl = parseMeetingWorkspaceTab(searchParams.get("tab"));
    if (fromUrl !== activeTab) {
      setActiveTab(fromUrl);
    }
    // Sync when the URL changes externally (back/forward / deep link).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional URL-driven sync
  }, [searchParams, location.hash]);

  useEffect(() => {
    if (activeTab !== "minutes") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("meeting-minutes")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      document
        .getElementById("meeting-minutes-notes")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, detail.event_id]);

  const status = meetingRecordStatus(detail);
  const agendaPreview = detail.agenda.trim();

  return (
    <div className="space-y-5">
      <Card padding="md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-headline text-foreground">
              {detail.event_name}
            </h1>
            <p className="text-sm text-label">
              {formatEventDateTime(detail.starts_at)}
            </p>
            <MeetingStatusChips meeting={status} />
          </div>
          {detail.can_manage ? (
            <Link
              to={`/events/${detail.event_id}/manage`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5"
            >
              Manage event
            </Link>
          ) : null}
        </div>
      </Card>

      <div className="sticky top-0 z-20 -mx-1 border-b border-gray-100/80 bg-surface/95 px-1 py-2 backdrop-blur-sm">
        <div
          role="tablist"
          aria-label="Meeting sections"
          className="inline-flex max-w-full flex-wrap rounded-xl border border-gray-200 bg-surface-muted/40 p-1"
        >
          {MEETING_WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={tabButtonClassName(activeTab === tab.id)}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewStat
              label="Present"
              value={String(detail.present_count)}
              hint={
                detail.unmarked_count > 0
                  ? `${detail.unmarked_count} unmarked`
                  : undefined
              }
            />
            <OverviewStat
              label="Absent / Excused"
              value={`${detail.absent_count} / ${detail.excused_count}`}
            />
            <OverviewStat
              label="Minutes"
              value={status.has_minutes ? "Draft on file" : "Not started"}
            />
            <OverviewStat
              label="AI summary"
              value={status.has_summary ? "Published" : "Not published"}
            />
          </div>

          <Card padding="md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-foreground">Agenda</h2>
                {agendaPreview ? (
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {agendaPreview}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-label">No agenda on file.</p>
                )}
              </div>
              <button
                type="button"
                className="ds-link text-sm"
                onClick={() => selectTab("agenda")}
              >
                Open agenda →
              </button>
            </div>
          </Card>

          <Card padding="md">
            <h2 className="text-base font-medium text-foreground">
              Continue working
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["attendance", "Attendance"],
                  ["minutes", "Minutes"],
                  ["ai-summary", "AI Summary"],
                  ["discussion", "Discussion"],
                  ["files", "Files"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5"
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "attendance" ? (
        <div className="space-y-3">
          {attendanceError ? (
            <p role="alert" className="ds-alert-banner">
              {attendanceError}
            </p>
          ) : null}
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
              setAttendanceError(null);
              try {
                const updated = await saveMeetingAttendance(
                  detail.event_id,
                  entries,
                );
                onDetailChange(updated);
              } catch (caught) {
                setAttendanceError(getApiErrorMessage(caught));
                throw caught;
              } finally {
                setAttendanceSaving(false);
              }
            }}
          />
        </div>
      ) : null}

      {activeTab === "agenda" ? (
        <Card padding="md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-light tracking-subhead text-foreground">
                Agenda
              </h2>
              <p className="mt-1 text-sm text-label">
                Pulled from the meeting event description.
              </p>
            </div>
            {detail.can_manage ? (
              <Link
                to={`/events/${detail.event_id}/manage?tab=details`}
                className="ds-link text-sm"
              >
                Edit in Manage →
              </Link>
            ) : null}
          </div>
          {agendaPreview ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {agendaPreview}
            </p>
          ) : (
            <p className="mt-4 text-sm text-label">
              No agenda was added when this meeting was created.
            </p>
          )}
        </Card>
      ) : null}

      {activeTab === "discussion" ? (
        <DiscussionFeed
          title="Discussion"
          description="Board members and volunteers for this meeting can post here."
          scope={{ type: "event", eventId: detail.event_id }}
        />
      ) : null}

      {activeTab === "minutes" ? (
        <MeetingMinutesEditor
          eventName={detail.event_name}
          minutes={detail.minutes}
          canManage={detail.can_manage}
          mode="notes"
          onSaveNotes={async (rawNotes) => {
            const updated = await saveMeetingNotes(detail.event_id, rawNotes);
            onDetailChange({ ...detail, minutes: updated });
            return updated;
          }}
          onSummarize={async (rawNotes) => {
            const updated = await summarizeMeetingForEvent(
              detail.event_id,
              rawNotes,
            );
            onDetailChange({ ...detail, minutes: updated });
            selectTab("ai-summary");
            return updated;
          }}
        />
      ) : null}

      {activeTab === "ai-summary" ? (
        <MeetingMinutesEditor
          key={`summary-${detail.minutes.updated_at ?? "none"}`}
          eventName={detail.event_name}
          minutes={detail.minutes}
          canManage={detail.can_manage}
          mode="summary"
          onGoToNotes={() => selectTab("minutes")}
          onSaveNotes={async (rawNotes) => {
            const updated = await saveMeetingNotes(detail.event_id, rawNotes);
            onDetailChange({ ...detail, minutes: updated });
            return updated;
          }}
          onSummarize={async (rawNotes) => {
            const updated = await summarizeMeetingForEvent(
              detail.event_id,
              rawNotes,
            );
            onDetailChange({ ...detail, minutes: updated });
            return updated;
          }}
        />
      ) : null}

      {activeTab === "files" ? (
        <MeetingFilesPanel eventId={detail.event_id} />
      ) : null}
    </div>
  );
}
