import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import {
  addDraftCategory,
  addDraftItem,
  countDraftItems,
  draftFieldDomId,
  formatChecklistSummary,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_LABEL_LENGTH,
  moveDraftCategory,
  moveDraftItem,
  removeDraftCategory,
  removeDraftItem,
  updateDraftCategoryName,
  updateDraftItemLabel,
  type DraftChecklistCategory,
  type DraftChecklistIssue,
} from "../lib/draft-checklist";
import { inputFieldClassName } from "./ui/Input";
import { AppIcon } from "./ui/AppIcon";

type DraftPrepChecklistProps = {
  categories: DraftChecklistCategory[];
  issues?: DraftChecklistIssue[];
  focusFieldId?: string | null;
  onChange: (categories: DraftChecklistCategory[]) => void;
  onClear: () => void;
};

const iconButtonClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40";

const textButtonClassName =
  "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-sm font-medium text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40";

function categoryMessages(
  issues: DraftChecklistIssue[],
  categoryId: string,
): string[] {
  return issues
    .filter((issue) => issue.categoryId === categoryId && issue.itemId === null)
    .map((issue) => issue.message);
}

function itemMessage(
  issues: DraftChecklistIssue[],
  itemId: string,
): string | undefined {
  return issues.find((issue) => issue.itemId === itemId)?.message;
}

export function DraftPrepChecklist({
  categories,
  issues = [],
  focusFieldId = null,
  onChange,
  onClear,
}: DraftPrepChecklistProps) {
  const appliedFocus = useRef<string | null>(null);
  const [localFocusId, setLocalFocusId] = useState<string | null>(null);
  const activeFocusId = localFocusId ?? focusFieldId;
  const itemCount = countDraftItems(categories);
  const summary = formatChecklistSummary(itemCount, categories.length);

  useEffect(() => {
    if (!activeFocusId || appliedFocus.current === activeFocusId) {
      return;
    }
    const field = document.getElementById(draftFieldDomId(activeFocusId));
    if (!field) {
      return;
    }
    field.focus();
    appliedFocus.current = activeFocusId;
  }, [activeFocusId, categories]);

  return (
    <section
      aria-label="Checklist draft"
      className="rounded-md border border-accent/20 bg-accent/5 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-label" aria-live="polite">
          {summary} will be added when you create this event.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 text-sm font-medium text-label underline-offset-2 hover:text-foreground hover:underline"
        >
          Clear
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {categories.map((category, categoryIndex) => {
          const messages = categoryMessages(issues, category.id);
          const nameErrorId = `${draftFieldDomId(category.id)}-error`;
          const atItemLimit = category.items.length >= MAX_CHECKLIST_ITEMS;

          return (
            <article
              key={category.id}
              className="rounded-md border border-white/80 bg-white p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={draftFieldDomId(category.id)}
                    className="block text-xs font-medium text-label"
                  >
                    Category {categoryIndex + 1}
                  </label>
                  <input
                    id={draftFieldDomId(category.id)}
                    value={category.name}
                    maxLength={MAX_CHECKLIST_LABEL_LENGTH}
                    aria-invalid={messages.some((message) =>
                      message.startsWith("Category name"),
                    ) || undefined}
                    aria-describedby={messages.length > 0 ? nameErrorId : undefined}
                    onChange={(event) => {
                      onChange(
                        updateDraftCategoryName(
                          categories,
                          category.id,
                          event.target.value,
                        ),
                      );
                    }}
                    placeholder="Category name"
                    className={`${inputFieldClassName} mt-1`}
                  />
                  {messages.length > 0 ? (
                    <div id={nameErrorId} className="mt-1 space-y-1">
                      {messages.map((message) => (
                        <p key={message} className="ds-field-error">
                          {message}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1 sm:mt-5">
                  <button
                    type="button"
                    className={iconButtonClassName}
                    aria-label={`Move category ${categoryIndex + 1} up`}
                    disabled={categoryIndex === 0}
                    onClick={() => {
                      onChange(moveDraftCategory(categories, categoryIndex, -1));
                    }}
                  >
                    <AppIcon icon={ChevronUp} />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClassName}
                    aria-label={`Move category ${categoryIndex + 1} down`}
                    disabled={categoryIndex === categories.length - 1}
                    onClick={() => {
                      onChange(moveDraftCategory(categories, categoryIndex, 1));
                    }}
                  >
                    <AppIcon icon={ChevronDown} />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClassName}
                    aria-label={`Remove category ${categoryIndex + 1}`}
                    onClick={() => {
                      onChange(removeDraftCategory(categories, category.id));
                    }}
                  >
                    <AppIcon icon={Trash2} />
                  </button>
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {category.items.map((item, itemIndex) => {
                  const message = itemMessage(issues, item.id);
                  const errorId = `${draftFieldDomId(item.id)}-error`;
                  return (
                    <li key={item.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={draftFieldDomId(item.id)}
                            className="sr-only"
                          >
                            Category {categoryIndex + 1} item {itemIndex + 1}
                          </label>
                          <input
                            id={draftFieldDomId(item.id)}
                            value={item.label}
                            maxLength={MAX_CHECKLIST_LABEL_LENGTH}
                            aria-invalid={Boolean(message) || undefined}
                            aria-describedby={message ? errorId : undefined}
                            onChange={(event) => {
                              onChange(
                                updateDraftItemLabel(
                                  categories,
                                  category.id,
                                  item.id,
                                  event.target.value,
                                ),
                              );
                            }}
                            placeholder="Checklist item"
                            className={inputFieldClassName}
                          />
                          {message ? (
                            <p id={errorId} className="mt-1 ds-field-error">
                              {message}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className={iconButtonClassName}
                            aria-label={`Move category ${categoryIndex + 1} item ${itemIndex + 1} up`}
                            disabled={itemIndex === 0}
                            onClick={() => {
                              onChange(
                                moveDraftItem(categories, category.id, itemIndex, -1),
                              );
                            }}
                          >
                            <AppIcon icon={ChevronUp} />
                          </button>
                          <button
                            type="button"
                            className={iconButtonClassName}
                            aria-label={`Move category ${categoryIndex + 1} item ${itemIndex + 1} down`}
                            disabled={itemIndex === category.items.length - 1}
                            onClick={() => {
                              onChange(
                                moveDraftItem(categories, category.id, itemIndex, 1),
                              );
                            }}
                          >
                            <AppIcon icon={ChevronDown} />
                          </button>
                          <button
                            type="button"
                            className={iconButtonClassName}
                            aria-label={`Remove category ${categoryIndex + 1} item ${itemIndex + 1}`}
                            onClick={() => {
                              onChange(
                                removeDraftItem(categories, category.id, item.id),
                              );
                            }}
                          >
                            <AppIcon icon={Trash2} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                className={`${textButtonClassName} mt-2`}
                aria-label={`Add item to category ${categoryIndex + 1}`}
                disabled={atItemLimit}
                onClick={() => {
                  const result = addDraftItem(categories, category.id);
                  onChange(result.categories);
                  if (result.itemId) {
                    setLocalFocusId(result.itemId);
                  }
                }}
              >
                <AppIcon icon={Plus} />
                Add item
              </button>
              {atItemLimit ? (
                <p className="mt-1 text-xs text-label">
                  A category can include up to {MAX_CHECKLIST_ITEMS} items.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className={`${textButtonClassName} mt-3`}
        onClick={() => {
          const result = addDraftCategory(categories);
          onChange(result.categories);
          setLocalFocusId(result.categoryId);
        }}
      >
        <AppIcon icon={Plus} />
        Add category
      </button>
    </section>
  );
}
