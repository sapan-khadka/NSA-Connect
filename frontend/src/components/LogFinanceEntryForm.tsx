import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { FinanceCategoryField } from "./FinanceCategoryField";
import {
  createFinanceEntry,
  scanFinanceReceipt,
  uploadFinanceReceipt,
  type FinanceEntryResponse,
  type ReceiptScanResponse,
} from "../lib/finance-api";
import {
  FINANCE_ENTRY_TYPES,
  formatAmountForSubmit,
  getSubmittedFinanceCategory,
  initialLogFinanceEntryValues,
  validateLogFinanceEntryForm,
  type FinanceCategory,
  type LogFinanceEntryFormErrors,
  type LogFinanceEntryFormValues,
} from "../lib/finance-form";
import { getApiErrorMessage } from "../lib/auth-api";
import { isPresetFinanceCategory } from "../lib/finance-categories";

type EventOption = {
  id: number;
  name: string;
};

type LogFinanceEntryFormProps = {
  eventOptions: EventOption[];
  onCreated: (entry: FinanceEntryResponse) => void;
  presentation?: "collapsible" | "standalone";
  onDismiss?: () => void;
  idPrefix?: string;
};

const RECEIPT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const RECEIPT_FILE_ACCEPT = `${RECEIPT_IMAGE_ACCEPT},application/pdf`;
const SCAN_FALLBACK_MESSAGE =
  "Couldn't read that receipt clearly — please fill in the details manually";

const labelClassName = "block text-sm font-light text-label";
const inputClassName =
  "mt-1 w-full rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm font-light text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40";

function fieldId(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}-${name}` : name;
}

function isReceiptImage(file: File): boolean {
  return RECEIPT_IMAGE_ACCEPT.split(",").includes(file.type);
}

function applyScanToFormValues(
  current: LogFinanceEntryFormValues,
  scan: ReceiptScanResponse,
): LogFinanceEntryFormValues {
  const next = { ...current };

  if (scan.amount) {
    next.amount = scan.amount;
  }

  if (scan.description) {
    next.description = scan.description;
  }

  if (scan.category && isPresetFinanceCategory(scan.category)) {
    next.category = scan.category as FinanceCategory;
    next.customCategory = "";
  }

  // Receipts are expenses by default when scanning at point of purchase.
  next.entry_type = "expense";

  return next;
}

export function LogFinanceEntryForm({
  eventOptions,
  onCreated,
  presentation = "collapsible",
  onDismiss,
  idPrefix,
}: LogFinanceEntryFormProps) {
  const [values, setValues] = useState<LogFinanceEntryFormValues>(
    initialLogFinanceEntryValues,
  );
  const [fieldErrors, setFieldErrors] = useState<LogFinanceEntryFormErrors>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(presentation === "standalone");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function updateField<K extends keyof LogFinanceEntryFormValues>(
    field: K,
    value: LogFinanceEntryFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setSuccessMessage(null);
  }

  async function runReceiptScan(file: File) {
    if (!isReceiptImage(file)) {
      setScanNotice(
        "Receipt scanning works with photos (JPEG, PNG, or WebP). You can still attach a PDF and fill details manually.",
      );
      return;
    }

    setIsScanning(true);
    setServerError(null);
    setScanNotice(null);
    setSuccessMessage(null);

    try {
      const scan = await scanFinanceReceipt(file);
      if (!scan.readable || !scan.amount) {
        setScanNotice(SCAN_FALLBACK_MESSAGE);
        return;
      }

      setValues((current) => applyScanToFormValues(current, scan));
      setFieldErrors({});
      setScanNotice(
        "Receipt details filled in — review and edit anything before saving.",
      );
    } catch {
      setScanNotice(SCAN_FALLBACK_MESSAGE);
    } finally {
      setIsScanning(false);
    }
  }

  function handleReceiptFileSelected(
    file: File | null,
    options: { autoScan: boolean },
  ) {
    setReceiptFile(file);
    setServerError(null);
    setSuccessMessage(null);
    setScanNotice(null);

    if (file && options.autoScan) {
      void runReceiptScan(file);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateLogFinanceEntryForm(values);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      let receiptUrl: string | null = null;

      if (receiptFile) {
        const upload = await uploadFinanceReceipt(receiptFile);
        receiptUrl = upload.receipt_url;
      }

      const entry = await createFinanceEntry({
        entry_type: values.entry_type,
        category: getSubmittedFinanceCategory(values),
        amount: formatAmountForSubmit(values.amount),
        description: values.description.trim(),
        receipt_url: receiptUrl,
        event_id: values.event_id ? Number(values.event_id) : null,
      });

      setValues(initialLogFinanceEntryValues);
      setReceiptFile(null);
      setScanNotice(null);
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }

      if (presentation === "standalone") {
        onCreated(entry);
        return;
      }

      setSuccessMessage("Transaction logged successfully.");
      onCreated(entry);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const formBody = (
    <>
      {serverError ? (
        <div role="alert" className="ds-alert-banner">
          {serverError}
        </div>
      ) : null}

      {scanNotice ? (
        <div
          role="status"
          className="rounded-lg border border-gray-200 bg-surface-muted px-4 py-3 text-sm font-light text-foreground"
        >
          {scanNotice}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg bg-mint/20 px-4 py-3 text-sm font-light text-primary">
          {successMessage}
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="grid gap-5 md:grid-cols-2"
      >
        <div>
          <label htmlFor={fieldId(idPrefix, "entry_type")} className={labelClassName}>
            Type
          </label>
          <select
            id={fieldId(idPrefix, "entry_type")}
            value={values.entry_type}
            onChange={(event) =>
              updateField(
                "entry_type",
                event.target.value as LogFinanceEntryFormValues["entry_type"],
              )
            }
            className={inputClassName}
          >
            {FINANCE_ENTRY_TYPES.map((entryType) => (
              <option key={entryType} value={entryType}>
                {entryType.charAt(0).toUpperCase() + entryType.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <FinanceCategoryField
          id={fieldId(idPrefix, "category")}
          category={values.category}
          customCategory={values.customCategory}
          categoryError={fieldErrors.category}
          customCategoryError={fieldErrors.customCategory}
          onCategoryChange={(category) => updateField("category", category)}
          onCustomCategoryChange={(customCategory) =>
            updateField("customCategory", customCategory)
          }
          inputClassName={inputClassName}
          labelClassName={labelClassName}
        />

        <div>
          <label htmlFor={fieldId(idPrefix, "amount")} className={labelClassName}>
            Amount
          </label>
          <input
            id={fieldId(idPrefix, "amount")}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            className={inputClassName}
          />
          {fieldErrors.amount ? (
            <p className="mt-1 ds-field-error">{fieldErrors.amount}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldId(idPrefix, "event_id")} className={labelClassName}>
            Linked event
          </label>
          <select
            id={fieldId(idPrefix, "event_id")}
            value={values.event_id}
            onChange={(event) => updateField("event_id", event.target.value)}
            className={inputClassName}
          >
            <option value="">None (general)</option>
            {eventOptions.map((eventOption) => (
              <option key={eventOption.id} value={eventOption.id}>
                {eventOption.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor={fieldId(idPrefix, "description")} className={labelClassName}>
            Description
          </label>
          <textarea
            id={fieldId(idPrefix, "description")}
            rows={3}
            value={values.description}
            onChange={(event) => updateField("description", event.target.value)}
            className={inputClassName}
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          <p className={labelClassName}>Receipt</p>

          <input
            ref={cameraInputRef}
            id={fieldId(idPrefix, "receipt-camera")}
            type="file"
            accept={RECEIPT_IMAGE_ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              handleReceiptFileSelected(file, { autoScan: true });
            }}
          />
          <input
            ref={uploadInputRef}
            id={fieldId(idPrefix, "receipt")}
            type="file"
            accept={RECEIPT_FILE_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              handleReceiptFileSelected(file, { autoScan: false });
            }}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={isScanning || isSubmitting}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-light text-foreground transition hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Take photo
            </button>
            <button
              type="button"
              disabled={isScanning || isSubmitting}
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-light text-foreground transition hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Upload file
            </button>
            <button
              type="button"
              disabled={
                isScanning ||
                isSubmitting ||
                !receiptFile ||
                !isReceiptImage(receiptFile)
              }
              onClick={() => {
                if (receiptFile) {
                  void runReceiptScan(receiptFile);
                }
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-light text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isScanning ? "Reading receipt…" : "Scan receipt"}
            </button>
          </div>

          {receiptFile ? (
            <p className="text-sm text-label">
              Attached: <span className="text-foreground">{receiptFile.name}</span>
            </p>
          ) : (
            <p className="text-sm text-label">
              Optional. Take a photo to scan, or upload a receipt image/PDF.
            </p>
          )}

          {isScanning ? (
            <p className="text-sm text-label" role="status" aria-live="polite">
              Reading receipt…
            </p>
          ) : null}
        </div>

        <div className="flex justify-end md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting || isScanning}
            className="min-h-11 rounded-full bg-primary px-5 py-2 text-sm font-light text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Log transaction"}
          </button>
        </div>
      </form>
    </>
  );

  if (presentation === "standalone") {
    return <div className="space-y-4">{formBody}</div>;
  }

  return (
    <CollapsibleLogFinanceEntryForm
      isExpanded={isExpanded}
      onExpand={() => setIsExpanded(true)}
      onCollapse={() => {
        setIsExpanded(false);
        onDismiss?.();
      }}
    >
      {formBody}
    </CollapsibleLogFinanceEntryForm>
  );
}

function CollapsibleLogFinanceEntryForm({
  isExpanded,
  onExpand,
  onCollapse,
  children,
}: {
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-gray-200 bg-surface-card p-6 shadow-card">
      {!isExpanded ? (
        <button
          type="button"
          onClick={onExpand}
          className="min-h-11 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-light text-foreground transition hover:border-accent hover:bg-accent/5"
        >
          + Log transaction
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-medium text-foreground">
              Log transaction
            </h2>
            <button
              type="button"
              onClick={onCollapse}
              className="min-h-11 text-sm font-light text-label transition hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="mt-6">{children}</div>
        </>
      )}
    </section>
  );
}
