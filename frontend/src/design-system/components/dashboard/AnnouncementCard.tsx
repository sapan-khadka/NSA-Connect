import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";
import { Card } from "../Card";

export type AnnouncementCardProps = {
  title: ReactNode;
  category?: ReactNode;
  date?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  /** Compact list-row style vs featured media card. */
  variant?: "featured" | "row";
  className?: string;
};

/**
 * Announcement preview — featured image card or compact row.
 */
export function AnnouncementCard({
  title,
  category,
  date,
  imageSrc,
  imageAlt = "",
  to,
  href,
  onClick,
  variant = "featured",
  className = "",
}: AnnouncementCardProps) {
  if (variant === "row") {
    const row = (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {title}
        </p>
        {(category || date) && (
          <p className="mt-1 text-sm text-label">
            {[category, date].filter(Boolean).map((part, i) => (
              <span key={i}>
                {i > 0 ? " · " : null}
                {part}
              </span>
            ))}
          </p>
        )}
      </div>
    );

    const rowClass = cx(
      "group flex items-start justify-between gap-4 rounded-card px-1 py-2 transition duration-200 hover:bg-surface-muted",
      className,
    );

    if (to) {
      return (
        <Link to={to} className={rowClass} onClick={onClick}>
          {row}
        </Link>
      );
    }
    if (href) {
      return (
        <a href={href} className={rowClass} onClick={onClick}>
          {row}
        </a>
      );
    }
    return (
      <div className={rowClass} onClick={onClick}>
        {row}
      </div>
    );
  }

  const body = (
    <>
      {imageSrc ? (
        <div className="relative h-36 w-full shrink-0 overflow-hidden sm:h-40">
          <img
            src={imageSrc}
            alt={imageAlt}
            aria-hidden={imageAlt ? undefined : true}
            className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-lg font-semibold text-foreground group-hover:text-primary">
          {title}
        </p>
        {(category || date) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {category ? (
              <span className="rounded-full bg-badge-teal-bg px-2 py-1 text-sm font-semibold text-badge-teal">
                {category}
              </span>
            ) : null}
            {date ? <span className="text-sm text-label">{date}</span> : null}
          </div>
        )}
      </div>
    </>
  );

  const featuredClass = cx(
    "group flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-gray-200 bg-surface-muted/60 transition duration-200 ease-out hover:border-gray-300 hover:shadow-card",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={featuredClass} onClick={onClick}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={featuredClass} onClick={onClick}>
        {body}
      </a>
    );
  }

  return (
    <Card padding="none" className={cx(featuredClass, "border-0 shadow-none")}>
      {body}
    </Card>
  );
}
