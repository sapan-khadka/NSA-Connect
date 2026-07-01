import type { ChecklistCategory } from "../lib/ai-api";
import { countChecklistTasks } from "../lib/ai-api";

type DraftPrepChecklistProps = {
  categories: ChecklistCategory[];
  onClear: () => void;
};

export function DraftPrepChecklist({
  categories,
  onClear,
}: DraftPrepChecklistProps) {
  const taskCount = countChecklistTasks(categories);

  return (
    <section className="rounded-md border border-accent/20 bg-accent/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Generated prep checklist</h3>
          <p className="mt-1 text-sm text-label">
            {taskCount} tasks across {categories.length} categories will be added when
            you create this event.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-label underline-offset-2 hover:text-accent hover:underline"
        >
          Clear
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {categories.map((category) => (
          <article
            key={category.category}
            className="rounded-md border border-white/80 bg-white p-3"
          >
            <h4 className="text-sm font-medium text-foreground">{category.category}</h4>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {category.tasks.map((task) => (
                <li key={task} className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">
                    •
                  </span>
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
