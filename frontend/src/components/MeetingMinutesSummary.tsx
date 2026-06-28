import type { SummarizeMinutesResponse } from "../lib/ai-api";

type MeetingMinutesSummaryProps = {
  result: SummarizeMinutesResponse;
  onClear: () => void;
};

function formatMeta(value: string | null): string {
  return value?.trim() ? value : "—";
}

export function MeetingMinutesSummary({
  result,
  onClear,
}: MeetingMinutesSummaryProps) {
  const summaryParagraphs = result.summary
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <section
      aria-label="Meeting minutes summary"
      className="rounded-lg border border-accent/20 bg-accent/5 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Summary</h2>
          <p className="mt-1 text-sm text-gray-600">
            {result.key_decisions.length} decisions · {result.action_items.length}{" "}
            action items
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-gray-600 underline-offset-2 hover:text-primary hover:underline"
        >
          Clear results
        </button>
      </div>

      <div className="mt-5 space-y-6">
        <article className="rounded-md border border-white/80 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Overview
          </h3>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">
            {summaryParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>

        {result.key_decisions.length > 0 ? (
          <article className="rounded-md border border-white/80 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Key decisions
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {result.key_decisions.map((decision) => (
                <li key={decision} className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">
                    •
                  </span>
                  <span>{decision}</span>
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {result.action_items.length > 0 ? (
          <article className="rounded-md border border-white/80 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Action items
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-gray-700">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Task
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Owner
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.action_items.map((item) => (
                    <tr
                      key={`${item.task}-${item.owner ?? ""}-${item.due ?? ""}`}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-2 py-3 align-top font-medium text-primary">
                        {item.task}
                      </td>
                      <td className="px-2 py-3 align-top">
                        {formatMeta(item.owner)}
                      </td>
                      <td className="px-2 py-3 align-top">
                        {formatMeta(item.due)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
