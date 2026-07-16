import type { CSSProperties, ReactNode } from "react";

import { cx } from "../../design-system/cx";

type DetailsHeroProps = {
  title: ReactNode;
  /** Optional cover image URL. */
  imageUrl?: string | null;
  /** Used when there is no image (e.g. brand gradient). */
  fallbackStyle?: CSSProperties;
  badges?: ReactNode;
  /** Compact metadata under the title (DetailsMetadata with tone="on-media"). */
  children?: ReactNode;
  className?: string;
};

/** Full-bleed media hero with title overlay. */
export function DetailsHero({
  title,
  imageUrl,
  fallbackStyle,
  badges,
  children,
  className,
}: DetailsHeroProps) {
  return (
    <div
      className={cx("details-panel-hero", className)}
      style={imageUrl ? undefined : fallbackStyle}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="details-panel-hero-image" />
      ) : null}
      <div className="details-panel-hero-shade" aria-hidden="true" />
      <div className="details-panel-hero-copy">
        {badges ? (
          <div className="details-panel-hero-badges">{badges}</div>
        ) : null}
        <h3 className="details-panel-hero-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}
