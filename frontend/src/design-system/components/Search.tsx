import { Search as SearchIcon, X } from "lucide-react";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cx } from "../cx";
import { Spinner } from "./Spinner";

export type SearchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> & {
  /** Show leading search icon. */
  showIcon?: boolean;
  /** Show a clear control when there is a value. */
  clearable?: boolean;
  onClear?: () => void;
  /** Trailing adornment (e.g. ⌘K hint). Hidden while loading. */
  trailing?: ReactNode;
  /** Replaces trailing content with a spinner. */
  loading?: boolean;
  inputClassName?: string;
  containerClassName?: string;
};

/**
 * Reusable CampusOS search field — header bars, command palettes, filters.
 */
export const Search = forwardRef<HTMLInputElement, SearchProps>(
  function Search(
    {
      showIcon = true,
      clearable = false,
      onClear,
      trailing,
      loading = false,
      className = "",
      inputClassName = "",
      containerClassName = "",
      value,
      disabled,
      "aria-label": ariaLabel = "Search",
      ...rest
    },
    ref,
  ) {
    const hasValue = typeof value === "string" && value.length > 0;
    const showClear = clearable && hasValue && !loading && !disabled;

    return (
      <div className={cx("relative w-full", containerClassName, className)}>
        {showIcon ? (
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label"
            strokeWidth={1.75}
          />
        ) : null}

        <input
          ref={ref}
          type="search"
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className={cx(
            "w-full rounded-full border border-gray-200 bg-surface text-sm text-foreground outline-none transition duration-200",
            "placeholder:text-label focus:border-primary/40 focus:bg-surface-card focus:ring-2 focus:ring-primary/10",
            "disabled:cursor-not-allowed disabled:opacity-60",
            showIcon ? "py-2.5 pl-11" : "px-4 py-2.5",
            showClear || trailing || loading ? "pr-12" : "pr-4",
            inputClassName,
          )}
          {...rest}
        />

        {loading ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" label="Searching" />
          </span>
        ) : showClear ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-label transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : trailing ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);
