import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  fetchReports,
  generateReport,
  type ReportGenerateRequest,
  type ReportListItem,
} from "../lib/reports-api";
import { Card } from "../components/ui/Card";
import {
  formatSemesterLabel,
  getRecentSemesterOptions,
} from "../lib/semester";
import { isRoleAtLeast } from "../lib/roles";

type RangeMode = "semester" | "custom";

function nextDayIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().replace(".000Z", "Z");
}

export function ReportsPage() {
  const { member } = useAuth();
  const canGenerate = member ? isRoleAtLeast(member.role, "board") : false;

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rangeMode, setRangeMode] = useState<RangeMode>("semester");
  const [semester, setSemester] = useState(getRecentSemesterOptions()[0] ?? "");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function loadReports() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchReports();
      setReports(response.reports);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerateError(null);
    setIsGenerating(true);

    try {
      let payload: ReportGenerateRequest;
      if (rangeMode === "semester") {
        payload = { range_type: "semester", semester };
      } else {
        payload = {
          range_type: "custom",
          period_start: `${periodStart}T00:00:00Z`,
          period_end: nextDayIso(periodEnd),
        };
      }
      await generateReport(payload);
      setPeriodStart("");
      setPeriodEnd("");
      await loadReports();
    } catch (caught) {
      setGenerateError(getApiErrorMessage(caught));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card padding="none" className="p-6 sm:p-8">
        <h1 className="text-3xl font-light tracking-headline text-foreground">
          Reports
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-label">
          End-of-semester summaries for sharing with advisors and incoming board
          members. All members can view generated reports.
        </p>
      </Card>

      {canGenerate ? (
        <Card padding="none" className="p-6 sm:p-8">
          <h2 className="text-lg font-medium text-foreground">Generate report</h2>
          <p className="mt-1 text-sm text-label">
            Board members can create a snapshot report for a semester or custom
            date range.
          </p>

          <form onSubmit={handleGenerate} className="mt-5 space-y-5">
            <fieldset>
              <legend className="text-sm font-medium text-foreground">
                Date range
              </legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="range-mode"
                    checked={rangeMode === "semester"}
                    onChange={() => setRangeMode("semester")}
                  />
                  Semester
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="range-mode"
                    checked={rangeMode === "custom"}
                    onChange={() => setRangeMode("custom")}
                  />
                  Custom range
                </label>
              </div>
            </fieldset>

            {rangeMode === "semester" ? (
              <div>
                <label
                  htmlFor="report-semester"
                  className="block text-sm font-medium text-foreground"
                >
                  Semester
                </label>
                <select
                  id="report-semester"
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {getRecentSemesterOptions().map((option) => (
                    <option key={option} value={option}>
                      {formatSemesterLabel(option)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="report-start"
                    className="block text-sm font-medium text-foreground"
                  >
                    Start date
                  </label>
                  <input
                    id="report-start"
                    type="date"
                    required
                    value={periodStart}
                    onChange={(event) => setPeriodStart(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="report-end"
                    className="block text-sm font-medium text-foreground"
                  >
                    End date
                  </label>
                  <input
                    id="report-end"
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(event) => setPeriodEnd(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {generateError ? (
              <p role="alert" className="ds-field-error">
                {generateError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isGenerating}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {isGenerating ? "Generating…" : "Generate report"}
            </button>
          </form>
        </Card>
      ) : null}

      <Card padding="none" className="p-6 sm:p-8">
        <h2 className="text-lg font-medium text-foreground">Past reports</h2>

        {isLoading ? (
          <p className="mt-4 text-sm text-label">Loading reports…</p>
        ) : error ? (
          <p role="alert" className="mt-4 ds-field-error">
            {error}
          </p>
        ) : reports.length === 0 ? (
          <p className="mt-4 text-sm text-label">No reports yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {reports.map((report) => (
              <li key={report.id} className="py-4">
                <Link
                  to={`/reports/${report.id}`}
                  className="group block rounded-md transition-colors hover:bg-accent/5"
                >
                  <div className="px-2 py-2">
                    <p className="text-base font-medium text-foreground group-hover:text-accent">
                      {report.title}
                    </p>
                    <p className="mt-1 text-sm text-label">
                      {report.period_label} · Generated by {report.generated_by_name}{" "}
                      · {formatEventDateTime(report.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
