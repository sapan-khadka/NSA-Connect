import type { ChecklistCategory } from "./ai-api";

export const MAX_CHECKLIST_ITEMS = 20;
export const MAX_CHECKLIST_LABEL_LENGTH = 255;

export type DraftChecklistItem = {
  id: string;
  label: string;
};

export type DraftChecklistCategory = {
  id: string;
  name: string;
  items: DraftChecklistItem[];
};

export type DraftChecklistIssue = {
  categoryId: string;
  itemId: string | null;
  message: string;
};

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `draft-${Math.random().toString(36).slice(2)}`;
}

export function draftFieldDomId(id: string): string {
  return `draft-checklist-${id}`;
}

export function createDraftItem(label = ""): DraftChecklistItem {
  return { id: newId(), label };
}

export function createDraftCategory(
  name = "",
  itemLabels?: string[],
): DraftChecklistCategory {
  const labels = itemLabels && itemLabels.length > 0 ? itemLabels : [""];
  return {
    id: newId(),
    name,
    items: labels.map((label) => createDraftItem(label)),
  };
}

export function draftFromGenerated(
  categories: ChecklistCategory[],
): DraftChecklistCategory[] {
  return categories.map((category) =>
    createDraftCategory(
      category.category,
      category.tasks.length > 0 ? category.tasks : [""],
    ),
  );
}

export function draftToCategories(
  categories: DraftChecklistCategory[],
): ChecklistCategory[] {
  return categories.map((category) => ({
    category: category.name.trim(),
    tasks: category.items.map((item) => item.label.trim()),
  }));
}

export function checklistContentKey(categories: ChecklistCategory[]): string {
  return JSON.stringify(
    categories.map((category) => ({
      category: category.category.trim(),
      tasks: category.tasks.map((task) => task.trim()),
    })),
  );
}

/** True when replacing the draft would discard manual work or edits. */
export function isDraftDirty(
  categories: DraftChecklistCategory[],
  generatedSnapshot: ChecklistCategory[] | null,
): boolean {
  if (categories.length === 0) {
    return false;
  }
  if (generatedSnapshot === null) {
    return true;
  }
  return (
    checklistContentKey(draftToCategories(categories)) !==
    checklistContentKey(generatedSnapshot)
  );
}

export function formatChecklistSummary(
  itemCount: number,
  categoryCount: number,
): string {
  const tasks = itemCount === 1 ? "task" : "tasks";
  const categoryLabel = categoryCount === 1 ? "category" : "categories";
  return `${itemCount} ${tasks} across ${categoryCount} ${categoryLabel}`;
}

export function countDraftItems(categories: DraftChecklistCategory[]): number {
  return categories.reduce((total, category) => total + category.items.length, 0);
}

function moveInList<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (
    index < 0 ||
    index >= items.length ||
    nextIndex < 0 ||
    nextIndex >= items.length
  ) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);
  return next;
}

export function moveDraftCategory(
  categories: DraftChecklistCategory[],
  index: number,
  direction: -1 | 1,
): DraftChecklistCategory[] {
  return moveInList(categories, index, direction);
}

export function moveDraftItem(
  categories: DraftChecklistCategory[],
  categoryId: string,
  index: number,
  direction: -1 | 1,
): DraftChecklistCategory[] {
  return categories.map((category) =>
    category.id === categoryId
      ? { ...category, items: moveInList(category.items, index, direction) }
      : category,
  );
}

export function updateDraftCategoryName(
  categories: DraftChecklistCategory[],
  categoryId: string,
  name: string,
): DraftChecklistCategory[] {
  return categories.map((category) =>
    category.id === categoryId ? { ...category, name } : category,
  );
}

export function updateDraftItemLabel(
  categories: DraftChecklistCategory[],
  categoryId: string,
  itemId: string,
  label: string,
): DraftChecklistCategory[] {
  return categories.map((category) =>
    category.id === categoryId
      ? {
          ...category,
          items: category.items.map((item) =>
            item.id === itemId ? { ...item, label } : item,
          ),
        }
      : category,
  );
}

export function addDraftCategory(categories: DraftChecklistCategory[]): {
  categories: DraftChecklistCategory[];
  categoryId: string;
} {
  const category = createDraftCategory();
  return {
    categories: [...categories, category],
    categoryId: category.id,
  };
}

export function removeDraftCategory(
  categories: DraftChecklistCategory[],
  categoryId: string,
): DraftChecklistCategory[] {
  return categories.filter((category) => category.id !== categoryId);
}

export function addDraftItem(
  categories: DraftChecklistCategory[],
  categoryId: string,
): { categories: DraftChecklistCategory[]; itemId: string | null } {
  let itemId: string | null = null;
  const next = categories.map((category) => {
    if (
      category.id !== categoryId ||
      category.items.length >= MAX_CHECKLIST_ITEMS
    ) {
      return category;
    }
    const item = createDraftItem();
    itemId = item.id;
    return { ...category, items: [...category.items, item] };
  });
  return { categories: next, itemId };
}

export function removeDraftItem(
  categories: DraftChecklistCategory[],
  categoryId: string,
  itemId: string,
): DraftChecklistCategory[] {
  return categories.map((category) =>
    category.id === categoryId
      ? {
          ...category,
          items: category.items.filter((item) => item.id !== itemId),
        }
      : category,
  );
}

export function validateDraftChecklist(
  categories: DraftChecklistCategory[],
): DraftChecklistIssue[] {
  const issues: DraftChecklistIssue[] = [];

  for (const category of categories) {
    const name = category.name.trim();
    if (!name) {
      issues.push({
        categoryId: category.id,
        itemId: null,
        message: "Category name is required",
      });
    } else if (name.length > MAX_CHECKLIST_LABEL_LENGTH) {
      issues.push({
        categoryId: category.id,
        itemId: null,
        message: "Category name must be 255 characters or fewer",
      });
    }

    if (category.items.length === 0) {
      issues.push({
        categoryId: category.id,
        itemId: null,
        message: "Add at least one checklist item",
      });
    } else if (category.items.length > MAX_CHECKLIST_ITEMS) {
      issues.push({
        categoryId: category.id,
        itemId: null,
        message: "A category can include at most 20 items",
      });
    }

    for (const item of category.items) {
      const label = item.label.trim();
      if (!label) {
        issues.push({
          categoryId: category.id,
          itemId: item.id,
          message: "Checklist item is required",
        });
      } else if (label.length > MAX_CHECKLIST_LABEL_LENGTH) {
        issues.push({
          categoryId: category.id,
          itemId: item.id,
          message: "Checklist item must be 255 characters or fewer",
        });
      }
    }
  }

  return issues;
}
