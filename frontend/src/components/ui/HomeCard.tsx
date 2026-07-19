import type { ReactNode } from "react";

import { Card } from "./Card";

type HomeCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "xs" | "sm" | "md";
  interactive?: boolean;
  "aria-label"?: string;
};

const PADDING_CLASS = {
  xs: "p-3",
  sm: "p-4",
  md: "p-6",
} as const;

export function HomeCard({
  children,
  className = "",
  padding = "md",
  interactive = false,
  "aria-label": ariaLabel,
}: HomeCardProps) {
  return (
    <Card
      className={[PADDING_CLASS[padding], className].filter(Boolean).join(" ")}
      interactive={interactive}
      aria-label={ariaLabel}
    >
      {children}
    </Card>
  );
}
