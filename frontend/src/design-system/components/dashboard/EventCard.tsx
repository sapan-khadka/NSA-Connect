import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";
import { Card } from "../Card";

export type EventCardProps = {
  title: ReactNode;
  date?: ReactNode;
  location?: ReactNode;
  description?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  badge?: ReactNode;
  /** Middle column extras (e.g. RSVP controls). */
  footer?: ReactNode;
  /** Right rail (e.g. calendar CTA). */
  aside?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  /** Compact tile vs invitation-style horizontal layout. */
  variant?: "invitation" | "compact";
  className?: string;
};

/**
 * Event preview card — invitation layout or compact tile.
 */
export function EventCard({
  title,
  date,
  location,
  description,
  imageSrc,
  imageAlt = "",
  badge,
  footer,
  aside,
  to,
  href,
  onClick,
  variant = "invitation",
  className = "",
}: EventCardProps) {
  if (variant === "compact") {
    const compactBody = (
      <>
        {badge ? <div className="mb-2">{badge}</div> : null}
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {date ? <p className="mt-2 text-sm text-label">{date}</p> : null}
        {location ? (
          <p className="mt-1 text-sm text-label">{location}</p>
        ) : null}
      </>
    );

    const compactClass = cx(
      "block rounded-card border border-gray-200 bg-surface-card p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
      className,
    );

    if (to) {
      return (
        <Link to={to} className={compactClass} onClick={onClick}>
          {compactBody}
        </Link>
      );
    }
    return (
      <Card padding="sm" className={className}>
        {compactBody}
      </Card>
    );
  }

  const titleNode = to ? (
    <Link
      to={to}
      onClick={onClick}
      className="mt-2 text-lg font-semibold tracking-tight text-foreground hover:text-primary"
    >
      {title}
    </Link>
  ) : href ? (
    <a
      href={href}
      onClick={onClick}
      className="mt-2 text-lg font-semibold tracking-tight text-foreground hover:text-primary"
    >
      {title}
    </a>
  ) : (
    <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
      {title}
    </p>
  );

  return (
    <section
      className={cx(
        "w-full overflow-hidden rounded-card border border-gray-200 bg-surface-card shadow-card transition duration-200 ease-out hover:shadow-card-hover",
        className,
      )}
    >
      <div className="flex flex-col lg:flex-row">
        {imageSrc ? (
          <div className="relative h-48 w-full shrink-0 overflow-hidden lg:h-auto lg:min-h-[240px] lg:w-[280px] xl:w-[320px]">
            <img
              src={imageSrc}
              alt={imageAlt}
              aria-hidden={imageAlt ? undefined : true}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/10"
            />
            {badge ? (
              <div className="absolute left-4 top-4">{badge}</div>
            ) : null}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-6">
          {titleNode}
          <dl className="mt-4 space-y-2 text-sm">
            {date ? (
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-label">Date</dt>
                <dd className="text-foreground">{date}</dd>
              </div>
            ) : null}
            {location ? (
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-label">Location</dt>
                <dd className="text-foreground">{location}</dd>
              </div>
            ) : null}
          </dl>
          {description ? (
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-label">
              {description}
            </p>
          ) : null}
          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>

        {aside ? (
          <div className="flex shrink-0 items-center border-t border-gray-200 p-4 lg:w-44 lg:flex-col lg:justify-center lg:border-l lg:border-t-0 xl:w-48">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
