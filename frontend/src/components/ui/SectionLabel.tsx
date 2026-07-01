import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type SectionLabelProps = {
  children: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
};

export function SectionLabel({
  children,
  icon: Icon,
  iconClassName = "h-4 w-4 shrink-0 text-label",
  className,
}: SectionLabelProps) {
  return (
    <p
      className={["ds-section-label inline-flex items-center gap-1.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon ? (
        <Icon
          className={iconClassName}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </p>
  );
}
