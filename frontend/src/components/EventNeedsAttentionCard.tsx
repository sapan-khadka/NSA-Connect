/**
 * Presentational “Needs Attention” list for an event inspector.
 * Items are derived by the parent; this component only renders (or returns null).
 * Nested Card chrome keeps it aligned with the sidebar shell.
 */

import { Card } from "./ui/Card";

export type NeedsAttentionSeverity = "urgent" | "pending" | "info";

export type NeedsAttentionItem = {
  id: string;
  label: string;
  /** urgent = red, pending = orange, info = gray */
  severity: NeedsAttentionSeverity;
};

export type EventNeedsAttentionCardProps = {
  items: NeedsAttentionItem[];
  className?: string;
};

const SEVERITY_DOT_CLASS: Record<NeedsAttentionSeverity, string> = {
  urgent: "bg-overdue",
  pending: "bg-warning",
  info: "bg-gray-400",
};

export function EventNeedsAttentionCard({
  items,
  className = "",
}: EventNeedsAttentionCardProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card
      nested
      padding="none"
      className={["space-y-3 p-3", className].filter(Boolean).join(" ")}
      aria-label="Needs Attention"
    >
      <h3 className="text-[12px] font-semibold tracking-tight text-foreground">
        Needs Attention
      </h3>

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={[
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                SEVERITY_DOT_CLASS[item.severity],
              ].join(" ")}
            />
            <span className="min-w-0 text-[13px] leading-snug text-foreground">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
