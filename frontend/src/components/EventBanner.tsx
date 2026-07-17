/**
 * Fixed-height calendar sidebar banner — cover photo or type-color fill,
 * with type + countdown pills overlaid the same way in both states.
 */

import { cx } from "../design-system/cx";
import {
  EVENT_TYPE_DOT_CLASS,
  EVENT_TYPE_LABELS,
  type EventType,
} from "../lib/event-types";

export type EventBannerProps = {
  eventType: EventType;
  /** Cover photo URL; when missing, fills with the type color. */
  imageUrl?: string | null;
  countdown?: string | null;
  className?: string;
};

export function EventBanner({
  eventType,
  imageUrl,
  countdown = null,
  className = "",
}: EventBannerProps) {
  const coverUrl = imageUrl?.trim() || null;

  return (
    <div
      className={cx(
        "details-panel-hero details-panel-hero--banner event-banner",
        className,
      )}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className="details-panel-hero-image" />
      ) : (
        <div
          aria-hidden="true"
          className={cx("event-banner-fill", EVENT_TYPE_DOT_CLASS[eventType])}
        />
      )}
      <div className="details-panel-hero-shade" aria-hidden="true" />
      <div className="details-panel-hero-banner-chrome">
        <div className="details-panel-hero-badge-slot">
          <span className="details-panel-hero-badge">
            {EVENT_TYPE_LABELS[eventType]}
          </span>
        </div>
        <div className="details-panel-hero-badge-slot details-panel-hero-badge-slot--end">
          {countdown ? (
            <span className="details-panel-hero-badge">{countdown}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
