import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppIcon } from "../components/ui/AppIcon";
import { getApiErrorMessage } from "../lib/api-error";
import {
  calcBoardMeetingsStats,
  filterMeetings,
  formatMeetingWhen,
  getMeetingStatusMarks,
  groupMeetingsBySemester,
  meetingIsComplete,
  meetingSubtitle,
  meetingYearOptions,
  type MeetingMissingFilter,
  type MeetingStatusFilter,
} from "../lib/board-meetings";
import { fetchMeetings, type MeetingSummary } from "../lib/meetings-api";

type KpiKey = "all" | "minutes" | "attendance" | "ready";

function MeetingRow({ meeting }: { meeting: MeetingSummary }) {
  const complete = meetingIsComplete(meeting);
  const when = formatMeetingWhen(meeting.starts_at);
  const subtitle = meetingSubtitle(meeting);
  const marks = getMeetingStatusMarks(meeting);

  return (
    <li>
      <Link
        to={`/events/meetings/${meeting.event_id}`}
        aria-label={`${meeting.event_name}. Open workspace`}
        className={[
          "board-meetings-row",
          complete ? "is-complete" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="board-meetings-row__top">
          <h3 className="board-meetings-row__title">{meeting.event_name}</h3>
          <span className="board-meetings-row__open" aria-hidden="true">
            Open →
          </span>
        </div>
        <p className="board-meetings-row__meta">
          <span>{subtitle}</span>
          {when ? (
            <>
              <span className="board-meetings-row__sep" aria-hidden="true">
                ·
              </span>
              <span>{when}</span>
            </>
          ) : null}
        </p>
        {marks ? (
          <p className="board-meetings-row__status" aria-label="Record status">
            {marks.map((mark) => (
              <span
                key={mark.key}
                className={[
                  "board-meetings-mark",
                  mark.done ? "is-done" : "is-open",
                ].join(" ")}
              >
                <span className="board-meetings-mark__icon" aria-hidden="true">
                  {mark.done ? "✓" : "○"}
                </span>
                <span className="board-meetings-mark__label">{mark.label}</span>
              </span>
            ))}
          </p>
        ) : (
          <p className="board-meetings-row__status">Scheduled</p>
        )}
      </Link>
    </li>
  );
}

export function BoardMeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<MeetingStatusFilter>("all");
  const [yearFilter, setYearFilter] = useState<"all" | number>("all");
  const [missingFilter, setMissingFilter] =
    useState<MeetingMissingFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchMeetings();
        if (!cancelled) {
          setMeetings(response.meetings);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => calcBoardMeetingsStats(meetings), [meetings]);
  const yearOptions = useMemo(() => meetingYearOptions(meetings), [meetings]);

  const activeKpi: KpiKey =
    missingFilter === "minutes"
      ? "minutes"
      : missingFilter === "attendance"
        ? "attendance"
        : missingFilter === "ready"
          ? "ready"
          : "all";

  function selectKpi(key: KpiKey) {
    if (key === "all") {
      setStatusFilter("all");
      setMissingFilter("all");
      return;
    }
    if (key === "minutes") {
      const next = activeKpi === "minutes" ? "all" : "minutes";
      setStatusFilter("all");
      setMissingFilter(next === "all" ? "all" : "minutes");
      return;
    }
    if (key === "attendance") {
      const next = activeKpi === "attendance" ? "all" : "attendance";
      setStatusFilter("all");
      setMissingFilter(next === "all" ? "all" : "attendance");
      return;
    }
    const next = activeKpi === "ready" ? "all" : "ready";
    setStatusFilter("all");
    setMissingFilter(next === "all" ? "all" : "ready");
  }

  const filtered = useMemo(
    () =>
      filterMeetings(meetings, {
        search,
        status: statusFilter,
        year: yearFilter,
        missing: missingFilter,
      }),
    [meetings, search, statusFilter, yearFilter, missingFilter],
  );

  const groups = useMemo(
    () => groupMeetingsBySemester(filtered),
    [filtered],
  );

  const filtersActive =
    statusFilter !== "all" ||
    yearFilter !== "all" ||
    missingFilter !== "all";

  return (
    <div className="board-meetings-page">
      <header className="board-meetings-header">
        <div>
          <h1 className="board-meetings-title">Meetings</h1>
          <p className="board-meetings-subtitle">
            Official record of NSA board meetings — agenda, attendance, and
            minutes.
          </p>
        </div>
      </header>

      {!isLoading && meetings.length > 0 ? (
        <section className="board-meetings-kpi" aria-label="Meetings summary">
          <button
            type="button"
            className="board-meetings-kpi__cell"
            aria-pressed={activeKpi === "all"}
            onClick={() => selectKpi("all")}
          >
            <span className="board-meetings-kpi__value">{stats.total}</span>
            <span className="board-meetings-kpi__label">Meetings</span>
          </button>
          <button
            type="button"
            className={[
              "board-meetings-kpi__cell",
              activeKpi === "minutes" ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={activeKpi === "minutes"}
            onClick={() => selectKpi("minutes")}
          >
            <span className="board-meetings-kpi__value">{stats.needMinutes}</span>
            <span className="board-meetings-kpi__label">Missing minutes</span>
          </button>
          <button
            type="button"
            className={[
              "board-meetings-kpi__cell",
              activeKpi === "attendance" ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={activeKpi === "attendance"}
            onClick={() => selectKpi("attendance")}
          >
            <span className="board-meetings-kpi__value">
              {stats.needAttendance}
            </span>
            <span className="board-meetings-kpi__label">Missing attendance</span>
          </button>
          <button
            type="button"
            className={[
              "board-meetings-kpi__cell",
              activeKpi === "ready" ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={activeKpi === "ready"}
            onClick={() => selectKpi("ready")}
          >
            <span className="board-meetings-kpi__value">{stats.ready}</span>
            <span className="board-meetings-kpi__label">Completed</span>
          </button>
        </section>
      ) : null}

      {!isLoading && meetings.length > 0 ? (
        <>
          <div className="board-meetings-toolbar">
            <label className="board-meetings-search">
              <AppIcon icon={Search} size="sm" className="text-label" />
              <span className="sr-only">Search meetings</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search meetings…"
              />
            </label>
            <div className="board-meetings-toolbar__actions">
              <button
                type="button"
                className="board-meetings-filter-btn"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <AppIcon
                  icon={SlidersHorizontal}
                  size="sm"
                  className="text-current"
                />
                Filter
                {filtersActive ? (
                  <span className="board-meetings-filter-btn__on">On</span>
                ) : null}
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div
              className="board-meetings-filter-panel"
              aria-label="Meeting filters"
            >
              <div className="board-meetings-filter-field">
                <label htmlFor="board-meetings-filter-status">Status</label>
                <select
                  id="board-meetings-filter-status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as MeetingStatusFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="needs_attention">Needs attention</option>
                </select>
              </div>
              <div className="board-meetings-filter-field">
                <label htmlFor="board-meetings-filter-year">Year</label>
                <select
                  id="board-meetings-filter-year"
                  value={yearFilter === "all" ? "all" : String(yearFilter)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setYearFilter(value === "all" ? "all" : Number(value));
                  }}
                >
                  <option value="all">All years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="board-meetings-filter-field">
                <label htmlFor="board-meetings-filter-missing">
                  Missing records
                </label>
                <select
                  id="board-meetings-filter-missing"
                  value={missingFilter}
                  onChange={(event) =>
                    setMissingFilter(event.target.value as MeetingMissingFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="either">Anything missing</option>
                  <option value="minutes">Minutes missing</option>
                  <option value="attendance">Attendance missing</option>
                  <option value="ready">Complete records</option>
                </select>
              </div>
              <button
                type="button"
                className="board-meetings-filter-btn"
                onClick={() => {
                  setStatusFilter("all");
                  setYearFilter("all");
                  setMissingFilter("all");
                  setSearch("");
                }}
              >
                Reset
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {isLoading ? (
        <p className="board-meetings-loading">Loading board meetings…</p>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner p-6">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && meetings.length === 0 ? (
        <section className="board-meetings-empty">
          <p className="board-meetings-empty__title">No board meetings yet</p>
          <p className="board-meetings-empty__copy">
            Create a meeting event on the calendar, then record attendance and
            minutes from the meeting page.
          </p>
          <Link to="/events/calendar" className="mt-4 inline-block ds-link">
            Open calendar
          </Link>
        </section>
      ) : null}

      {!isLoading && !error && meetings.length > 0 && filtered.length === 0 ? (
        <section className="board-meetings-empty is-soft">
          <p className="board-meetings-empty__title">No matching meetings</p>
          <p className="board-meetings-empty__copy">
            Try clearing search or filters to see the full list.
          </p>
        </section>
      ) : null}

      {!isLoading && !error && groups.length > 0 ? (
        <div className="board-meetings-groups">
          {groups.map((group) => (
            <section
              key={group.key}
              className="board-meetings-group"
              aria-label={group.label}
            >
              <header className="board-meetings-group__head">
                <h2 className="board-meetings-group__title">{group.label}</h2>
              </header>
              {group.months.map((month) => (
                <div key={month.key} className="board-meetings-month">
                  <h3 className="board-meetings-month__title">{month.label}</h3>
                  <ul className="board-meetings-list">
                    {month.meetings.map((meeting) => (
                      <MeetingRow key={meeting.event_id} meeting={meeting} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
