import { useRef, useState, type ChangeEvent } from "react";

import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { getApiErrorMessage } from "../lib/api-error";
import { formatFinanceCategory } from "../lib/finance-categories";
import {
  importFinanceCsv,
  type FinanceImportPreviewRow,
  type FinanceImportResponse,
} from "../lib/finance-api";

type ImportFinanceCsvPanelProps = {
  onImported: () => void;
};

function formatPreviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatPreviewAmount(value: string): string {
  const amount = Number.parseFloat(value);
  if (Number.isNaN(amount)) {
    return value;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function ImportFinanceCsvPanel({ onImported }: ImportFinanceCsvPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FinanceImportResponse | null>(null);
  const [summary, setSummary] = useState<FinanceImportResponse | null>(null);

  function resetPreview() {
    setPreview(null);
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const result = await importFinanceCsv(file, { dryRun: true });
      setSelectedFile(file);
      setPreview(result);
    } catch (caught) {
      setPreview(null);
      setSelectedFile(null);
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!selectedFile) {
      return;
    }

    setConfirming(true);
    setError(null);
    try {
      const result = await importFinanceCsv(selectedFile, { dryRun: false });
      setSummary(result);
      resetPreview();
      onImported();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section className="finance-panel" aria-label="Import expense sheet">
      <div className="finance-panel-head">
        <h2 className="finance-panel-title">Import expense sheet</h2>
        <p className="finance-panel-copy">
          Upload an NSA Funding Sheet CSV. We preview expense rows, match events by
          name, and skip totals.
        </p>
      </div>

      <div className="finance-import-actions">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={loading || confirming}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? "Reading…" : "Choose CSV"}
        </Button>
        {selectedFile ? (
          <span className="finance-import-filename">{selectedFile.name}</span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="ds-field-error finance-import-error">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="finance-import-preview">
          <div className="finance-import-preview-meta">
            <p>
              <span className="font-medium tabular-nums">{preview.rows_ready}</span>{" "}
              ready to import
            </p>
            <p>
              <span className="font-medium tabular-nums">
                {preview.rows_skipped}
              </span>{" "}
              rows skipped
            </p>
          </div>

          {preview.preview_rows.length > 0 ? (
            <div className="finance-import-table-wrap">
              <table className="finance-import-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Category</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Event</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_rows.map((row: FinanceImportPreviewRow) => (
                    <tr key={`${row.row_number}-${row.amount}-${row.description}`}>
                      <td>{formatPreviewDate(row.date)}</td>
                      <td>{formatFinanceCategory(row.category)}</td>
                      <td className="tabular-nums">
                        {formatPreviewAmount(row.amount)}
                      </td>
                      <td>{row.event_title ?? "General"}</td>
                      <td>{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="finance-panel-copy">No importable expense rows found.</p>
          )}

          {preview.skipped_rows.length > 0 ? (
            <details className="finance-import-skipped">
              <summary>
                Skipped rows ({preview.skipped_rows.length})
              </summary>
              <ul>
                {preview.skipped_rows.map((row) => (
                  <li key={`${row.row_number}-${row.reason}`}>
                    Row {row.row_number}: {row.reason}
                    {row.raw_excerpt ? (
                      <span className="finance-import-excerpt">
                        {" "}
                        — {row.raw_excerpt}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="finance-import-confirm">
            <Button
              type="button"
              disabled={confirming || preview.rows_ready === 0}
              onClick={handleConfirm}
            >
              {confirming ? "Importing…" : "Confirm import"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={confirming}
              onClick={resetPreview}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={summary !== null}
        title="Expense import complete"
        onClose={() => setSummary(null)}
      >
        {summary ? (
          <div className="space-y-4">
            <div className="space-y-1 text-sm text-foreground">
              <p>
                <span className="font-medium tabular-nums">
                  {summary.rows_created}
                </span>{" "}
                entries created
              </p>
              <p>
                <span className="font-medium tabular-nums">
                  {summary.rows_skipped}
                </span>{" "}
                rows skipped
              </p>
            </div>
            {summary.skipped_rows.length > 0 ? (
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-label">
                {summary.skipped_rows.map((row) => (
                  <li key={`${row.row_number}-${row.reason}`}>
                    Row {row.row_number}
                    <span className="block text-foreground">{row.reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
