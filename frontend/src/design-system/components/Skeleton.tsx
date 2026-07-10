import type { HTMLAttributes } from "react";

import { cx } from "../cx";

export type SkeletonVariant = "text" | "circular" | "rectangular";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
  /** Width as CSS length (e.g. "100%", "12rem"). */
  width?: string | number;
  /** Height as CSS length. Defaults by variant. */
  height?: string | number;
};

/**
 * Placeholder shimmer for loading content. Decorative — hide from AT with aria-hidden.
 */
export function Skeleton({
  variant = "text",
  width,
  height,
  className = "",
  style,
  ...rest
}: SkeletonProps) {
  const resolvedWidth =
    width === undefined
      ? variant === "circular"
        ? "2.5rem"
        : "100%"
      : typeof width === "number"
        ? `${width}px`
        : width;

  const resolvedHeight =
    height === undefined
      ? variant === "text"
        ? "0.875rem"
        : variant === "circular"
          ? resolvedWidth
          : "6rem"
      : typeof height === "number"
        ? `${height}px`
        : height;

  return (
    <div
      aria-hidden="true"
      className={cx(
        "animate-pulse bg-surface-muted",
        variant === "circular" ? "rounded-full" : "rounded-lg",
        variant === "text" ? "max-w-full" : "",
        className,
      )}
      style={{
        width: resolvedWidth,
        height: resolvedHeight,
        ...style,
      }}
      {...rest}
    />
  );
}
