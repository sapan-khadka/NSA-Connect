import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ReportDocument } from "../components/ReportDocument";
import { getApiErrorMessage } from "../lib/api-error";
import {
  downloadReportPdf,
  fetchReport,
  type ReportDetailResponse,
} from "../lib/reports-api";
import { triggerBrowserDownload } from "../lib/photo-archive-api";

type ReportDetailPageProps = {
  reportId?: number;
};

export function ReportDetailPage({ reportId: reportIdProp }: ReportDetailPageProps) {
  const { reportId: reportIdParam } = useParams();
  const reportId = reportIdProp ?? Number(reportIdParam);
  const [report, setReport] = useState<ReportDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchReport(reportId);
        if (!cancelled) {
          setReport(data);
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
  }, [reportId]);

  async function handleDownloadPdf() {
    setIsDownloading(true);
    try {
      const { blob, filename } = await downloadReportPdf(reportId);
      triggerBrowserDownload(blob, filename);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsDownloading(false);
    }
  }

  if (!Number.isFinite(reportId)) {
    return <p className="ds-field-error">Invalid report.</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-label">Loading report…</p>;
  }

  if (error || !report) {
    return (
      <p role="alert" className="ds-field-error">
        {error ?? "Report not found."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="report-toolbar no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/reports" className="text-sm text-accent hover:underline">
          ← All reports
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-foreground hover:border-accent hover:bg-accent/5"
          >
            Print
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => void handleDownloadPdf()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {isDownloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>

      <ReportDocument
        data={report.data}
        generatedByName={report.generated_by_name}
        createdAt={report.created_at}
      />
    </div>
  );
}
