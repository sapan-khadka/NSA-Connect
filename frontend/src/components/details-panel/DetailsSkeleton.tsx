import { cx } from "../../design-system/cx";

type DetailsSkeletonProps = {
  /** Include a tall hero placeholder. */
  withHero?: boolean;
  className?: string;
};

/** Quiet loading placeholder for the details panel. */
export function DetailsSkeleton({
  withHero = true,
  className,
}: DetailsSkeletonProps) {
  return (
    <div
      className={cx("details-panel-skeleton", className)}
      aria-hidden="true"
    >
      {withHero ? <div className="details-panel-skeleton-hero" /> : null}
      <div className="details-panel-skeleton-body">
        <div className="details-panel-skeleton-line details-panel-skeleton-line--lg" />
        <div className="details-panel-skeleton-line" />
        <div className="details-panel-skeleton-line details-panel-skeleton-line--sm" />
        <div className="details-panel-skeleton-block" />
        <div className="details-panel-skeleton-block" />
      </div>
    </div>
  );
}
