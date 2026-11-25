import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { FinanceCategoryField } from "./FinanceCategoryField";
import { Button } from "./ui/Button";
import { inputFieldClassName } from "./ui/Input";
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
import { getApiErrorMessage } from "../lib/api-error";
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
  /** Locks the entry to this event and hides the event picker. */
  lockedEventId?: number;
  lockedEventName?: string;
};

function initialValuesForEvent(lockedEventId?: number): LogFinanceEntryFormValues {
  if (lockedEventId == null) {
    return initialLogFinanceEntryValues;
  }

  return {
    ...initialLogFinanceEntryValues,
    event_id: String(lockedEventId),
  };
}

const RECEIPT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const RECEIPT_FILE_ACCEPT = `${RECEIPT_IMAGE_ACCEPT},application/pdf`;
// iOS Safari and Android Chrome ignore `capture` unless accept is the image/*
// wildcard. A list of concrete types makes Take photo open the file picker.
const RECEIPT_CAMERA_ACCEPT = "image/*";
const SCAN_FALLBACK_MESSAGE =
  "Couldn't read that receipt clearly. Please fill in the details manually";

const labelClassName = "block text-sm font-light text-label";
const inputClassName = `${inputFieldClassName} mt-1`;

function fieldId(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}-${name}` : name;
}

function isReceiptImage(file: File): boolean {
  return RECEIPT_IMAGE_ACCEPT.split(",").includes(file.type);
}

const receiptPickerLabelClassName = [
  "relative inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px]",
  "border border-gray-200 bg-surface-card px-4 py-2 text-sm font-medium text-foreground",
  "transition duration-200 ease-out hover:border-foreground/25 hover:bg-surface-muted",
  "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2",
].join(" ");

function ReceiptPickerLabel({
  label,
  inputId,
  inputRef,
  accept,
  capture,
  disabled,
  onFile,
}: {
  label: string;
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  capture?: "environment";
  disabled: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <label
      htmlFor={inputId}
      className={`${receiptPickerLabelClassName} ${
        disabled ? "pointer-events-none cursor-not-allowed opacity-60" : ""
      }`}
      aria-disabled={disabled || undefined}
    >
      {label}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        capture={capture}
        disabled={disabled}
        className="absolute h-px w-px overflow-hidden opacity-0"
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
        }}
      />
    </label>
  );
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
  lockedEventId,
  lockedEventName,
}: LogFinanceEntryFormProps) {
  const [values, setValues] = useState<LogFinanceEntryFormValues>(() =>
    initialValuesForEvent(lockedEventId),
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
  const eventLocked = lockedEventId != null;

  useEffect(() => {
    if (lockedEventId == null) {
      return;
    }
    setValues((current) => ({
      ...current,
      event_id: String(lockedEventId),
    }));
  }, [lockedEventId]);

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
        "Receipt details filled in. Review and edit anything before saving.",
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
        event_id:
          lockedEventId ??
          (values.event_id ? Number(values.event_id) : null),
      });

      setValues(initialValuesForEvent(lockedEventId));
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
        <div className="rounded-lg bg-mint/20 px-4 py-3 text-sm font-light text-foreground">
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
          onCategoryChange={(category) =>
            updateField(
              "category",
              category as LogFinanceEntryFormValues["category"],
            )
          }
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

        {eventLocked ? (
          <div>
            <p className={labelClassName}>Linked event</p>
            <p
              className="mt-1 rounded-lg border border-gray-200 bg-surface-muted px-3 py-2 text-sm text-foreground"
              data-testid="log-finance-locked-event"
            >
              {lockedEventName ?? `Event #${lockedEventId}`}
            </p>
          </div>
        ) : (
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
        )}

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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ReceiptPickerLabel
              label="Take photo"
              inputId={fieldId(idPrefix, "receipt-camera")}
              inputRef={cameraInputRef}
              accept={RECEIPT_CAMERA_ACCEPT}
              capture="environment"
              disabled={isScanning || isSubmitting}
              onFile={(file) => handleReceiptFileSelected(file, { autoScan: true })}
            />
            <ReceiptPickerLabel
              label="Upload file"
              inputId={fieldId(idPrefix, "receipt")}
              inputRef={uploadInputRef}
              accept={RECEIPT_FILE_ACCEPT}
              disabled={isScanning || isSubmitting}
              onFile={(file) => handleReceiptFileSelected(file, { autoScan: false })}
            />
            <Button
              type="button"
              disabled={
                isScanning ||
                isSubmitting ||
                !receiptFile ||
                !isReceiptImage(receiptFile)
              }
              loading={isScanning}
              onClick={() => {
                if (receiptFile) {
                  void runReceiptScan(receiptFile);
                }
              }}
            >
              Scan receipt
            </Button>
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
          <Button
            type="submit"
            disabled={isSubmitting || isScanning}
            loading={isSubmitting}
          >
            Log transaction
          </Button>
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
    <section className="finance-log-form">
      {!isExpanded ? (
        <Button type="button" variant="outline" onClick={onExpand}>
          + Log transaction
        </Button>
      ) : (
        <>
          <div className="finance-log-form-head">
            <h2 className="finance-panel-title">Log transaction</h2>
            <button
              type="button"
              onClick={onCollapse}
              className="finance-log-form-close"
            >
              Close
            </button>
          </div>
          <div className="finance-log-form-body">{children}</div>
        </>
      )}
    </section>
  );
}
