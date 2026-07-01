import { Link } from "react-router-dom";

import type { MemberResponse } from "../lib/auth-api";
import { getMyTasksPath } from "../lib/home-tasks";

type Pill = {
  label: string;
  to: string;
  variant: "primary" | "secondary";
};

function buildPills(member: MemberResponse): Pill[] {
  const workLabel = member.role === "general" ? "My work" : "My tasks";

  return [
    { label: "Events", to: "/events/calendar", variant: "primary" },
    { label: workLabel, to: getMyTasksPath(member.role), variant: "secondary" },
    { label: "Profile", to: "/profile", variant: "secondary" },
  ];
}

type HomeShortcutPillsProps = {
  member: MemberResponse;
};

const PILL_CLASS = {
  primary:
    "rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover",
  secondary:
    "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent",
} as const;

export function HomeShortcutPills({ member }: HomeShortcutPillsProps) {
  const pills = buildPills(member);

  return (
    <nav
      aria-label="Shortcuts"
      className="mt-4 flex flex-wrap gap-2"
    >
      {pills.map((pill) => (
        <Link
          key={pill.to}
          to={pill.to}
          className={PILL_CLASS[pill.variant]}
        >
          {pill.label}
        </Link>
      ))}
    </nav>
  );
}
