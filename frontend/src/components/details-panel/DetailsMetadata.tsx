import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "../../design-system/cx";
import { AppIcon } from "../ui/AppIcon";

export type DetailsMetadataItem = {
  key?: string;
  icon?: LucideIcon;
  value: ReactNode;
};

type DetailsMetadataProps = {
  items: DetailsMetadataItem[];
  /** `on-media` for hero overlays; `default` for body sections. */
  tone?: "default" | "on-media";
  "aria-label"?: string;
  className?: string;
};

/** Icon + value rows for scannable facts. */
export function DetailsMetadata({
  items,
  tone = "default",
  "aria-label": ariaLabel,
  className,
}: DetailsMetadataProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      className={cx(
        "details-panel-meta",
        tone === "on-media" && "details-panel-meta--on-media",
        className,
      )}
      aria-label={ariaLabel}
    >
      {items.map((item, index) => (
        <li
          key={item.key ?? String(index)}
          className="details-panel-meta-item"
        >
          {item.icon ? (
            <AppIcon
              icon={item.icon}
              size="xs"
              className="details-panel-meta-icon"
            />
          ) : null}
          <span className="details-panel-meta-value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
