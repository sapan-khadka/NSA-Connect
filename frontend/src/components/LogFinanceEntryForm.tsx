import { useState, type FormEvent } from "react";

import { formatFinanceCategory } from "../lib/finance-categories";
import {
  createFinanceEntry,
  uploadFinanceReceipt,
  type FinanceEntryResponse,
} from "../lib/finance-api";
import {
  FINANCE_CATEGORIES,
  FINANCE_ENTRY_TYPES,
  formatAmountForSubmit,
  initialLogFinanceEntryValues,
  validateLogFinanceEntryForm,
  type LogFinanceEntryFormErrors,
  type LogFinanceEntryFormValues,
} from "../lib/finance-form";
import { getApiErrorMessage } from "../lib/auth-api";

type EventOption = {
  id: number;
  name: string;
};

type LogFinanceEntryFormProps = {
  eventOptions: EventOption[];
  onCreated: (entry: FinanceEntryResponse) => void;
};

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function LogFinanceEntryForm({
  eventOptions,
  onCreated,
}: LogFinanceEntryFormProps) {
  const [values, setValues] = useState<LogFinanceEntryFormValues>(
    initialLogFinanceEntryValues,
  );
  const [fieldErrors, setFieldErrors] = useState<LogFinanceEntryFormErrors>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof LogFinanceEntryFormValues>(
    field: K,
    value: LogFinanceEntryFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setSuccessMessage(null);
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
        category: values.category,
        amount: formatAmountForSubmit(values.amount),
        description: values.description.trim(),
        receipt_url: receiptUrl,
        event_id: values.event_id ? Number(values.event_id) : null,
      });

      setValues(initialLogFinanceEntryValues);
      setReceiptFile(null);
      setSuccessMessage("Transaction logged successfully.");
      onCreated(entry);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-card bg-surface-card p-6">
      <div>
        <h2 className="text-lg font-light tracking-subhead text-foreground">Log transaction</h2>
        <p className="mt-1 text-sm text-label">
          Record income or expense and optionally attach a receipt image.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mt-4 ds-alert-banner"
        >
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 ds-card px-4 py-3 text-sm text-primary">
          {successMessage}
        </div>
      )}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-6 grid gap-5 md:grid-cols-2"
      >
        <div>
          <label htmlFor="entry_type" className="block text-sm font-medium text-foreground">
            Type
          </label>
          <select
            id="entry_type"
            value={values.entry_type}
            onChange={(event) =>
              updateField("entry_type", event.target.value as LogFinanceEntryFormValues["entry_type"])
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

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-foreground">
            Category
          </label>
          <select
            id="category"
            value={values.category}
            onChange={(event) =>
              updateField("category", event.target.value as LogFinanceEntryFormValues["category"])
            }
            className={inputClassName}
          >
            {FINANCE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatFinanceCategory(category)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-foreground">
            Amount
          </label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            className={inputClassName}
          />
          {fieldErrors.amount && (
            <p className="mt-1 ds-field-error">{fieldErrors.amount}</p>
          )}
        </div>

        <div>
          <label htmlFor="event_id" className="block text-sm font-medium text-foreground">
            Linked event
          </label>
          <select
            id="event_id"
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
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={values.description}
            onChange={(event) => updateField("description", event.target.value)}
            className={inputClassName}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="receipt" className="block text-sm font-medium text-foreground">
            Receipt (optional)
          </label>
          <input
            id="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => {
              setReceiptFile(event.target.files?.[0] ?? null);
              setServerError(null);
              setSuccessMessage(null);
            }}
            className="mt-1 block w-full text-sm text-label file:mr-4 file:rounded-md file:border-0 file:bg-accent/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent"
          />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Log transaction"}
          </button>
        </div>
      </form>
    </section>
  );
}
