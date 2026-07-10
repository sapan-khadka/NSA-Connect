import type { HTMLAttributes } from "react";

import { cx } from "../cx";

export type DividerOrientation = "horizontal" | "vertical";

export type DividerProps = HTMLAttributes<HTMLHRElement> & {
  orientation?: DividerOrientation;
  /** Soft muted border vs default border token. */
  muted?: boolean;
};

/**
 * Visual separator. Renders as a semantic `<hr>` for horizontal orientation.
 */
export function Divider({
  orientation = "horizontal",
  muted = false,
  className = "",
  ...rest
}: DividerProps) {
  const borderColor = muted ? "border-gray-100" : "border-gray-200";

  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cx("w-px self-stretch border-0", className)}
        style={{
          backgroundColor: muted
            ? "var(--color-border-muted)"
            : "var(--color-border)",
        }}
        {...(rest as HTMLAttributes<HTMLDivElement>)}
      />
    );
  }

  return (
    <hr
      aria-orientation="horizontal"
      className={cx("w-full border-0 border-t", borderColor, className)}
      {...rest}
    />
  );
}
