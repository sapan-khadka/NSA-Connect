import type { ReactNode } from "react";

type HomeCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md";
};

const PADDING_CLASS = {
  sm: "p-5",
  md: "p-6",
} as const;

export function HomeCard({
  children,
  className = "",
  padding = "md",
}: HomeCardProps) {
  return (
    <section
      className={["ds-card", PADDING_CLASS[padding], className].join(" ")}
    >
      {children}
    </section>
  );
}
