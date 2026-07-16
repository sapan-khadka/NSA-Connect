import type { CSSProperties, ReactNode } from "react";

import { cx } from "../../design-system/cx";

type DetailsHeroProps = {
  /** Shown on the media for `overlay`; omit/leave empty for `banner`. */
  title?: ReactNode;
  /** Optional cover image URL. */
  imageUrl?: string | null;
  /** Used when there is no image (e.g. brand gradient). */
  fallbackStyle?: CSSProperties;
  /** Top-left badge cluster (or legacy single badges row in overlay). */
  badges?: ReactNode;
  /** Top-right badge (banner layout). */
  badgeEnd?: ReactNode;
  /** Compact metadata under the title (DetailsMetadata with tone="on-media"). */
  children?: ReactNode;
  className?: string;
  /**
   * `overlay` — title + badges on the media (default).
   * `banner` — cover image with corner pills only; title belongs below.
   */
  variant?: "overlay" | "banner";
};

/** Media hero for details panels — overlay title or cover banner. */
export function DetailsHero({
  title,
  imageUrl,
  fallbackStyle,
  badges,
  badgeEnd,
  children,
  className,
  variant = "overlay",
}: DetailsHeroProps) {
  const isBanner = variant === "banner" && Boolean(imageUrl);

  if (isBanner) {
    return (
      <div className={cx("details-panel-hero details-panel-hero--banner", className)}>
        <img src={imageUrl!} alt="" className="details-panel-hero-image" />
        <div className="details-panel-hero-shade" aria-hidden="true" />
        <div className="details-panel-hero-banner-chrome">
          <div className="details-panel-hero-badge-slot">
            {badges ?? null}
          </div>
          <div className="details-panel-hero-badge-slot details-panel-hero-badge-slot--end">
            {badgeEnd ?? null}
          </div>
        </div>
      </div>
    );
  }

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
        {title != null && title !== "" ? (
          <h3 className="details-panel-hero-title">{title}</h3>
        ) : null}
        {children}
      </div>
    </div>
  );
}
