import type { ReactNode } from "react";

import { cx } from "../../design-system/cx";

export type DetailsStatItem = {
  key?: string;
  label: ReactNode;
  value: ReactNode;
};

type DetailsStatsProps = {
  items: DetailsStatItem[];
  className?: string;
};

/** Compact metric chips — reusable across domains. */
export function DetailsStats({ items, className }: DetailsStatsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className={cx("details-panel-stats", className)}>
      {items.map((item, index) => (
        <li key={item.key ?? String(index)} className="details-panel-stat">
          <span className="details-panel-stat-label">{item.label}</span>
          <span className="details-panel-stat-value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
