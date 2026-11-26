import { useEffect, useState, type FormEvent } from "react";

import { MeetingMinutesSummary } from "./MeetingMinutesSummary";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";
import { getApiErrorMessage } from "../lib/api-error";
import type { MeetingActionItem } from "../lib/ai-api";
import type { MeetingMinutes } from "../lib/meetings-api";

export type MeetingMinutesEditorMode = "full" | "notes" | "summary";

type DraftForm = {
  summary: string;
  decisions: string[];
  items: MeetingActionItem[];
};

type MeetingMinutesEditorProps = {
  eventName: string;
  minutes: MeetingMinutes;
  canManage: boolean;
  mode?: MeetingMinutesEditorMode;
  onSaveNotes: (rawNotes: string) => Promise<MeetingMinutes>;
  onGenerate: (
    rawNotes: string,
    confirmRegenerate: boolean,
    baseDraftVersion: number | null,
  ) => Promise<MeetingMinutes>;
  onSaveDraft: (draft: {
    summary: string;
    key_decisions: string[];
    action_items: MeetingActionItem[];
    base_draft_version: number | null;
  }) => Promise<MeetingMinutes>;
  onPublish: (baseDraftVersion: number) => Promise<MeetingMinutes>;
  onGoToNotes?: () => void;
};

function seedForm(minutes: MeetingMinutes): DraftForm {
  if (minutes.draft_version != null) {
    return {
      summary: minutes.draft_summary ?? "",
      decisions: [...(minutes.draft_key_decisions ?? [])],
      items: (minutes.draft_action_items ?? []).map((item) => ({ ...item })),
    };
  }
  return {
    summary: minutes.summary ?? "",
    decisions: [...(minutes.key_decisions ?? [])],
    items: (minutes.action_items ?? []).map((item) => ({ ...item })),
  };
}

function formsMatch(left: DraftForm, right: DraftForm): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cleanForm(form: DraftForm): DraftForm {
  return {
    summary: form.summary.trim(),
    decisions: form.decisions.map((decision) => decision.trim()).filter(Boolean),
    items: form.items
      .map((item) => ({
        task: item.task.trim(),
        owner: item.owner?.trim() || null,
        due: item.due?.trim() || null,
      }))
      .filter((item) => item.task),
  };
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (next < 0 || next >= items.length) {
    return items;
  }
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function MeetingMinutesEditor({
  minutes,
  canManage,
  mode = "full",
  onSaveNotes,
  onGenerate,
  onSaveDraft,
  onPublish,
  onGoToNotes,
}: MeetingMinutesEditorProps) {
  const [notes, setNotes] = useState(minutes.raw_notes);
  const [savedMinutes, setSavedMinutes] = useState(minutes);
  const [form, setForm] = useState(() => seedForm(minutes));
  const [notesError, setNotesError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    setNotes(minutes.raw_notes);
    setSavedMinutes(minutes);
    setForm(seedForm(minutes));
  }, [minutes]);

  const hasPublishedMinutes = Boolean(savedMinutes.summary?.trim());
  const hasDraft = savedMinutes.raw_notes.trim().length > 0;
  const hasReviewDraft = savedMinutes.draft_version != null;
  const savedForm = seedForm(savedMinutes);
  const isDirty = !formsMatch(form, savedForm);
  const showNotes = mode === "full" || mode === "notes";
  const showSummary = mode === "full" || mode === "summary";
  const publishedResult = hasPublishedMinutes
    ? {
        summary: savedMinutes.summary!,
        key_decisions: savedMinutes.key_decisions,
        action_items: savedMinutes.action_items,
      }
    : null;

  function applyMinutes(updated: MeetingMinutes) {
    setSavedMinutes(updated);
    setNotes(updated.raw_notes);
    setForm(seedForm(updated));
  }

  async function handleSaveNotes(event: FormEvent) {
    event.preventDefault();
    setNotesError(null);
    setServerError(null);
    setSaveSuccess(null);
    setIsSaving(true);
    try {
      const updated = await onSaveNotes(notes);
      setSavedMinutes((current) => ({ ...current, ...updated }));
      setNotes(updated.raw_notes);
      setSaveSuccess("Notes saved. Board members will be notified when notes are first added.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerate() {
    const trimmedNotes = notes.trim() || savedMinutes.raw_notes.trim();
    if (!trimmedNotes) {
      setNotesError("Add meeting notes before generating minutes.");
      return;
    }
    const replacesEdits = hasReviewDraft || isDirty;
    if (replacesEdits) {
      const confirmed = window.confirm(
        "Regenerating replaces the unpublished draft and any edits that have not been published. Published minutes stay as they are.",
      );
      if (!confirmed) {
        return;
      }
    }
    setNotesError(null);
    setServerError(null);
    setSaveSuccess(null);
    setIsGenerating(true);
    try {
      const updated = await onGenerate(
        trimmedNotes,
        replacesEdits,
        savedMinutes.draft_version ?? null,
      );
      applyMinutes(updated);
      setSaveSuccess("Draft generated. Review it, then publish when it is ready.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDraft() {
    const cleaned = cleanForm(form);
    setServerError(null);
    setSaveSuccess(null);
    setIsSaving(true);
    try {
      const updated = await onSaveDraft({
        summary: cleaned.summary,
        key_decisions: cleaned.decisions,
        action_items: cleaned.items,
        base_draft_version: savedMinutes.draft_version ?? null,
      });
      applyMinutes(updated);
      setSaveSuccess("Draft saved. It stays private until you publish it.");
      return updated;
    } catch (error) {
      setServerError(getApiErrorMessage(error));
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    setServerError(null);
    setSaveSuccess(null);
    setIsPublishing(true);
    try {
      let version = savedMinutes.draft_version ?? null;
      if (isDirty || version == null) {
        const cleaned = cleanForm(form);
        if (!cleaned.summary) {
          setNotesError("Add an overview before publishing minutes.");
          return;
        }
        const saved = await onSaveDraft({
          summary: cleaned.summary,
          key_decisions: cleaned.decisions,
          action_items: cleaned.items,
          base_draft_version: version,
        });
        version = saved.draft_version ?? null;
        applyMinutes(saved);
      }
      if (version == null) {
        setNotesError("Save a draft before publishing minutes.");
        return;
      }
      const published = await onPublish(version);
      applyMinutes(published);
      setSaveSuccess("Minutes published. Board members will be notified.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsPublishing(false);
    }
  }

  const title = mode === "summary" ? "AI Summary" : "Minutes";
  const busy = isSaving || isGenerating || isPublishing;

  return (
    <Card id="meeting-minutes" aria-label={title} padding="md" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-light tracking-subhead text-foreground">{title}</h2>
        <Badge variant={hasPublishedMinutes ? "success" : "neutral"}>
          {hasPublishedMinutes ? "Published" : hasReviewDraft ? "Draft in review" : "Not published"}
        </Badge>
      </div>

      {serverError ? (
        <p role="alert" className="mt-4 ds-alert-banner">
          {serverError}
        </p>
      ) : null}
      {saveSuccess ? (
        <p role="status" className="mt-4 ds-alert-banner">
          {saveSuccess}
        </p>
      ) : null}
      {notesError ? <p className="mt-3 ds-field-error">{notesError}</p> : null}

      {showSummary ? (
        <div
          data-testid="minutes-review-layout"
          className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <div className="min-w-0" data-testid="published-minutes">
            {publishedResult ? (
              <>
                <MeetingMinutesSummary result={publishedResult} title="Published minutes" />
                {savedMinutes.updated_by_name &&
                (savedMinutes.published_at || savedMinutes.updated_at) ? (
                  <p className="mt-3 text-xs text-label">
                    Published by {savedMinutes.updated_by_name} on{" "}
                    {new Date(
                      savedMinutes.published_at || savedMinutes.updated_at || "",
                    ).toLocaleString()}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-label">No published minutes yet.</p>
            )}
          </div>

          {canManage ? (
            <div className="min-w-0 space-y-4" data-testid="minutes-draft-editor">
              <div>
                <label htmlFor="meeting-minutes-overview" className="text-sm font-medium">
                  Overview
                </label>
                <textarea
                  id="meeting-minutes-overview"
                  rows={6}
                  value={form.summary}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, summary: event.target.value }))
                  }
                  className={`${inputFieldClassName} mt-2`}
                />
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Key decisions</legend>
                {form.decisions.map((decision, index) => (
                  <div key={`decision-${index}`} className="flex flex-wrap items-start gap-2">
                    <label className="sr-only" htmlFor={`meeting-decision-${index}`}>
                      Decision {index + 1}
                    </label>
                    <input
                      id={`meeting-decision-${index}`}
                      value={decision}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          decisions: current.decisions.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        }))
                      }
                      className={`${inputFieldClassName} min-w-0 flex-1`}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        aria-label={`Move decision ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            decisions: moveItem(current.decisions, index, -1),
                          }))
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        aria-label={`Move decision ${index + 1} down`}
                        disabled={index === form.decisions.length - 1}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            decisions: moveItem(current.decisions, index, 1),
                          }))
                        }
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        aria-label={`Remove decision ${index + 1}`}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            decisions: current.decisions.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  onClick={() =>
                    setForm((current) => ({ ...current, decisions: [...current.decisions, ""] }))
                  }
                >
                  Add decision
                </button>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Action items</legend>
                {form.items.map((item, index) => (
                  <div key={`action-${index}`} className="space-y-2 rounded-md border border-gray-100 p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.7fr)]">
                      <div className="min-w-0">
                        <label className="text-xs text-label" htmlFor={`meeting-action-task-${index}`}>
                          Task
                        </label>
                        <input
                          id={`meeting-action-task-${index}`}
                          value={item.task}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, task: event.target.value } : entry,
                              ),
                            }))
                          }
                          className={`${inputFieldClassName} mt-1`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="text-xs text-label" htmlFor={`meeting-action-owner-${index}`}>
                          Owner
                        </label>
                        <input
                          id={`meeting-action-owner-${index}`}
                          value={item.owner ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index
                                  ? { ...entry, owner: event.target.value }
                                  : entry,
                              ),
                            }))
                          }
                          className={`${inputFieldClassName} mt-1`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="text-xs text-label" htmlFor={`meeting-action-due-${index}`}>
                          Deadline
                        </label>
                        <input
                          id={`meeting-action-due-${index}`}
                          value={item.due ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, due: event.target.value } : entry,
                              ),
                            }))
                          }
                          className={`${inputFieldClassName} mt-1`}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        aria-label={`Move action item ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            items: moveItem(current.items, index, -1),
                          }))
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        aria-label={`Move action item ${index + 1} down`}
                        disabled={index === form.items.length - 1}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            items: moveItem(current.items, index, 1),
                          }))
                        }
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        aria-label={`Remove action item ${index + 1}`}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            items: current.items.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      items: [...current.items, { task: "", owner: null, due: null }],
                    }))
                  }
                >
                  Add action item
                </button>
              </fieldset>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || !isDirty}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-60"
                  onClick={() => void handleSaveDraft()}
                >
                  {isSaving ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  disabled={busy || !isDirty}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-60"
                  onClick={() => {
                    setForm(seedForm(savedMinutes));
                    setNotesError(null);
                    setServerError(null);
                  }}
                >
                  Cancel changes
                </button>
                <Button
                  type="button"
                  disabled={busy || (!isDirty && !hasReviewDraft)}
                  onClick={() => void handlePublish()}
                >
                  {isPublishing ? "Publishing…" : "Publish minutes"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showNotes && canManage ? (
        <form onSubmit={handleSaveNotes} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="meeting-minutes-notes" className="sr-only">
              Minutes notes
            </label>
            <textarea
              id="meeting-minutes-notes"
              rows={10}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setNotesError(null);
                setServerError(null);
                setSaveSuccess(null);
              }}
              placeholder="Agenda items, discussion points, votes, and action items…"
              className={inputFieldClassName}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save notes"}
            </button>
            <Button type="button" disabled={busy} onClick={() => void handleGenerate()}>
              {isGenerating ? "Generating…" : "Generate AI minutes"}
            </Button>
          </div>
          {hasDraft && savedMinutes.updated_by_name && savedMinutes.updated_at ? (
            <p className="text-xs text-label">
              Notes last saved by {savedMinutes.updated_by_name} on{" "}
              {new Date(savedMinutes.updated_at).toLocaleString()}
            </p>
          ) : null}
        </form>
      ) : null}

      {showNotes && !canManage ? (
        <>
          {!hasDraft ? <p className="mt-4 text-sm text-label">No notes yet.</p> : null}
          {hasDraft ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                View meeting notes
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {savedMinutes.raw_notes}
              </p>
            </details>
          ) : null}
        </>
      ) : null}

      {showSummary && !canManage && !publishedResult && onGoToNotes ? (
        <button type="button" className="mt-4 text-sm underline" onClick={onGoToNotes}>
          View meeting notes
        </button>
      ) : null}
    </Card>
  );
}
