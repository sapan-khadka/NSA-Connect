type SegmentedOption<T extends string> = {
  id: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (id: T) => void;
  /** Fill the parent width (page section tabs). Default hugs the widest label. */
  fill?: boolean;
  /** On small screens, wrap into equal 2-column rows. */
  wrap?: boolean;
  className?: string;
};

/**
 * Equal-width segmented control. Every option shares the widest label’s
 * column so “Chat” / “NSA Documents” (and similar) stay the same ratio.
 */
export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  fill = false,
  wrap = false,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={[
        "ds-seg",
        fill ? "is-fill" : "",
        wrap ? "is-wrap" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={active ? "is-active" : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
