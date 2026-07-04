import type { ReactNode } from "react";

import { Card } from "./Card";

type HomeCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md";
  interactive?: boolean;
};

const PADDING_CLASS = {
  sm: "p-4",
  md: "p-5",
} as const;

export function HomeCard({
  children,
  className = "",
  padding = "md",
  interactive = false,
}: HomeCardProps) {
  return (
    <Card
      className={[PADDING_CLASS[padding], className].filter(Boolean).join(" ")}
      interactive={interactive}
    >
      {children}
    </Card>
  );
}
