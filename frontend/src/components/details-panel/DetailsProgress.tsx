import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../design-system/cx";

type DetailsProgressBase = {
  label: ReactNode;
  /** Right-aligned quiet value (e.g. "2/3 · 67%"). */
  valueLabel?: ReactNode;
  percent: number;
  footnote?: ReactNode;
  className?: string;
  "aria-label"?: string;
};

type DetailsProgressLinkProps = DetailsProgressBase & {
  to: string;
  state?: unknown;
};

type DetailsProgressStaticProps = DetailsProgressBase & {
  to?: undefined;
  state?: undefined;
};

export type DetailsProgressProps =
  | DetailsProgressLinkProps
  | DetailsProgressStaticProps;

/** Progress bar block — optionally navigates when `to` is set. */
export function DetailsProgress(props: DetailsProgressProps) {
  const {
    label,
    valueLabel,
    percent,
    footnote,
    className,
    "aria-label": ariaLabel,
  } = props;
  const clamped = Math.max(0, Math.min(100, percent));

  const inner = (
    <>
      <div className="details-panel-progress-head">
        <span className="details-panel-progress-title">{label}</span>
        {valueLabel != null ? (
          <span className="details-panel-progress-value tabular-nums">
            {valueLabel}
          </span>
        ) : null}
      </div>
      <span
        className="details-panel-progress-bar"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : "Progress")}
      >
        <span style={{ width: `${clamped}%` }} />
      </span>
      {footnote != null ? (
        <p className="details-panel-progress-footnote">{footnote}</p>
      ) : null}
    </>
  );

  if ("to" in props && props.to) {
    return (
      <Link
        to={props.to}
        state={props.state}
        className={cx("details-panel-progress", className)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={cx("details-panel-progress", className)}>{inner}</div>
  );
}
