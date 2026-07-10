import { Search } from "lucide-react";
import {
  forwardRef,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cx } from "../../cx";

export type SearchBarProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onSubmit"
> & {
  /** Called with the trimmed query when the form is submitted. */
  onSearch?: (query: string) => void;
  /** Optional trailing adornment (e.g. keyboard hint). */
  trailing?: ReactNode;
  /** Show the leading search icon. */
  showIcon?: boolean;
  formClassName?: string;
};

/**
 * Configurable search field for headers and toolbars.
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      onSearch,
      trailing,
      showIcon = true,
      formClassName = "",
      className = "",
      placeholder = "Search…",
      "aria-label": ariaLabel = "Search",
      value,
      defaultValue,
      onChange,
      ...rest
    },
    ref,
  ) {
    function handleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!onSearch) {
        return;
      }
      const form = event.currentTarget;
      const data = new FormData(form);
      const raw =
        typeof value === "string"
          ? value
          : String(data.get("q") ?? "");
      const trimmed = raw.trim();
      if (trimmed) {
        onSearch(trimmed);
      }
    }

    return (
      <form
        role="search"
        onSubmit={handleSubmit}
        className={cx("relative w-full", formClassName)}
      >
        {showIcon ? (
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label"
            strokeWidth={1.75}
          />
        ) : null}
        <input
          ref={ref}
          type="search"
          name="q"
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cx(
            "w-full rounded-full border border-gray-200 bg-surface py-2.5 text-sm text-foreground outline-none transition duration-200",
            "placeholder:text-label focus:border-primary/40 focus:bg-surface-card focus:ring-2 focus:ring-primary/10",
            showIcon ? "pl-11 pr-4" : "px-4",
            trailing ? "pr-14" : "",
            className,
          )}
          {...rest}
        />
        {trailing ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        ) : null}
      </form>
    );
  },
);
