import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";

export type HeroBannerProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Background image URL. */
  imageSrc?: string;
  imageAlt?: string;
  /** Right-side or trailing actions (buttons, links). */
  actions?: ReactNode;
  /** Banner height class or fixed style. Default matches current Home hero. */
  heightClassName?: string;
  className?: string;
  overlayClassName?: string;
  "aria-label"?: string;
};

/**
 * Full-bleed hero / welcome banner. Generic — no auth or domain coupling.
 */
export function HeroBanner({
  title,
  description,
  imageSrc,
  imageAlt = "",
  actions,
  heightClassName = "h-[200px]",
  className = "",
  overlayClassName = "bg-black/55",
  "aria-label": ariaLabel = "Welcome",
}: HeroBannerProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cx(
        "relative overflow-hidden rounded-card",
        heightClassName,
        className,
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          aria-hidden={imageAlt ? undefined : true}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-primary"
        />
      )}
      <div
        aria-hidden="true"
        className={cx("absolute inset-0", overlayClassName)}
      />
      <div className="relative flex h-full flex-col justify-center gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="min-w-0 text-white">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Optional helper for a primary action on dark hero backgrounds. */
export function HeroBannerAction({
  children,
  to,
  onClick,
  variant = "solid",
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  variant?: "solid" | "ghost";
}) {
  const className = cx(
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition duration-200",
    variant === "solid"
      ? "bg-surface-card text-foreground shadow-sm hover:bg-surface-card/90"
      : "border border-white/35 bg-white/10 text-white backdrop-blur-sm hover:bg-white/15",
  );

  if (to) {
    return (
      <Link to={to} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
