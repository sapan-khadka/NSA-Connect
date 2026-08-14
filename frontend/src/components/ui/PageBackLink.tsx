import { ArrowLeft } from "lucide-react";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router";

import { resolveBackNavigation } from "../../lib/navigation-back";
import { AppIcon } from "./AppIcon";

export type PageBackLinkProps = {
  /** Parent path when history is empty or historyFirst is false. */
  to: string;
  /**
   * Destination label, e.g. "Home", "Events", "Meetings".
   * Renders as "Back to {label}" unless `label` already starts with "Back".
   */
  label: string;
  /**
   * When true, use in-app session history first (then fall back to `to`).
   * Use for generic "Back" buttons (notifications). Prefer false for
   * labeled parents so "Back to Events" always goes to Events.
   */
  historyFirst?: boolean;
  className?: string;
};

function displayLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return "Back";
  }
  if (/^back(\s|$)/i.test(trimmed) || trimmed === "←") {
    return trimmed;
  }
  return `Back to ${trimmed}`;
}

/**
 * Consistent page-level back control across the platform.
 */
export function PageBackLink({
  to,
  label,
  historyFirst = false,
  className = "",
}: PageBackLinkProps) {
  const navigate = useNavigate();
  const text = displayLabel(label);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!historyFirst) {
      return;
    }
    const resolution = resolveBackNavigation(to);
    if (resolution.type === "history") {
      event.preventDefault();
      navigate(-1);
    }
  }

  return (
    <Link
      to={to}
      onClick={handleClick}
      className={["page-back-link", className].filter(Boolean).join(" ")}
    >
      <AppIcon icon={ArrowLeft} size="xs" className="text-current" />
      <span>{text}</span>
    </Link>
  );
}
