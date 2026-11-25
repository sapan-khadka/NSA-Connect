import { describe, expect, it } from "vitest";

import {
  addDraftItem,
  createDraftCategory,
  draftFromGenerated,
  draftToCategories,
  formatChecklistSummary,
  isDraftDirty,
  MAX_CHECKLIST_ITEMS,
  moveDraftCategory,
  moveDraftItem,
  removeDraftCategory,
  removeDraftItem,
  updateDraftCategoryName,
  updateDraftItemLabel,
  validateDraftChecklist,
  type DraftChecklistCategory,
} from "./draft-checklist";

const sample: DraftChecklistCategory[] = [
  {
    id: "setup",
    name: "Setup",
    items: [
      { id: "room", label: "Reserve room" },
      { id: "av", label: "Test AV" },
    ],
  },
  {
    id: "food",
    name: "Food",
    items: [{ id: "catering", label: "Order catering" }],
  },
];

describe("draft checklist editing", () => {
  it("edits category names and item labels without changing ids", () => {
    const renamed = updateDraftCategoryName(sample, "setup", "Room setup");
    const edited = updateDraftItemLabel(renamed, "setup", "room", "Book the hall");

    expect(edited[0]).toMatchObject({
      id: "setup",
      name: "Room setup",
      items: [
        { id: "room", label: "Book the hall" },
        { id: "av", label: "Test AV" },
      ],
    });
    expect(edited[1]).toEqual(sample[1]);
  });

  it("adds and removes categories and items", () => {
    const withoutItem = removeDraftItem(sample, "setup", "av");
    expect(withoutItem[0].items.map((item) => item.id)).toEqual(["room"]);

    const added = addDraftItem(withoutItem, "setup");
    expect(added.categories[0].items).toHaveLength(2);
    expect(added.itemId).toBe(added.categories[0].items[1].id);

    const withoutCategory = removeDraftCategory(added.categories, "food");
    expect(withoutCategory.map((category) => category.id)).toEqual(["setup"]);
  });

  it("reorders categories and items", () => {
    const itemsMoved = moveDraftItem(sample, "setup", 1, -1);
    expect(itemsMoved[0].items.map((item) => item.label)).toEqual([
      "Test AV",
      "Reserve room",
    ]);
    expect(moveDraftItem(sample, "setup", 0, -1)).toEqual(sample);

    const categoriesMoved = moveDraftCategory(sample, 1, -1);
    expect(categoriesMoved.map((category) => category.name)).toEqual([
      "Food",
      "Setup",
    ]);
    expect(moveDraftCategory(sample, 0, -1)).toBe(sample);
  });

  it("stops adding items at the checklist limit", () => {
    let categories = [createDraftCategory("Setup", ["First"])];
    for (let index = 1; index < MAX_CHECKLIST_ITEMS; index += 1) {
      const result = addDraftItem(categories, categories[0].id);
      categories = result.categories;
      expect(result.itemId).not.toBeNull();
    }

    const blocked = addDraftItem(categories, categories[0].id);
    expect(blocked.itemId).toBeNull();
    expect(blocked.categories[0].items).toHaveLength(MAX_CHECKLIST_ITEMS);
  });

  it("rejects empty names and items and keeps the edited order for submit", () => {
    const draft = updateDraftItemLabel(
      updateDraftCategoryName(sample, "food", "  Food & Beverage  "),
      "setup",
      "room",
      "  Book the hall  ",
    );

    expect(draftToCategories(draft)).toEqual([
      { category: "Setup", tasks: ["Book the hall", "Test AV"] },
      { category: "Food & Beverage", tasks: ["Order catering"] },
    ]);

    const empty = [
      createDraftCategory("   ", ["   "]),
      { id: "bare", name: "Programs", items: [] },
    ];
    expect(validateDraftChecklist(empty).map((issue) => issue.message)).toEqual([
      "Category name is required",
      "Checklist item is required",
      "Add at least one checklist item",
    ]);
    expect(validateDraftChecklist(sample)).toEqual([]);
  });

  it("treats manual drafts and changed AI drafts as edits", () => {
    const generated = draftFromGenerated([
      { category: "Setup", tasks: ["Reserve room"] },
    ]);
    const snapshot = draftToCategories(generated);

    expect(isDraftDirty(generated, snapshot)).toBe(false);
    expect(
      isDraftDirty(
        updateDraftItemLabel(generated, generated[0].id, generated[0].items[0].id, "Book the hall"),
        snapshot,
      ),
    ).toBe(true);
    expect(isDraftDirty([createDraftCategory()], null)).toBe(true);
    expect(isDraftDirty([], snapshot)).toBe(false);
    expect(formatChecklistSummary(1, 1)).toBe("1 task across 1 category");
    expect(formatChecklistSummary(5, 2)).toBe("5 tasks across 2 categories");
  });
});
