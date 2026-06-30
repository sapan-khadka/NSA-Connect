import { Link } from "react-router-dom";

import type { MemberResponse } from "../lib/auth-api";
import { getMyTasksPath } from "../lib/home-tasks";

type Pill = {
  label: string;
  to: string;
};

function buildPills(member: MemberResponse): Pill[] {
  const workLabel = member.role === "general" ? "My work" : "My tasks";

  return [
    { label: "Events", to: "/events/calendar" },
    { label: workLabel, to: getMyTasksPath(member.role) },
    { label: "Profile", to: "/profile" },
  ];
}

type HomeShortcutPillsProps = {
  member: MemberResponse;
};

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
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-light"
        >
          {pill.label}
        </Link>
      ))}
    </nav>
  );
}
