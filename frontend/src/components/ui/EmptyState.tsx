import { CalendarDays, CheckCircle2, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppIcon } from "./AppIcon";

export type EmptyStateIcon = "clipboard" | "calendar" | "check";

type EmptyStateProps = {
  icon: EmptyStateIcon;
  title: string;
  description: string;
};

const EMPTY_STATE_ICONS: Record<EmptyStateIcon, LucideIcon> = {
  clipboard: ClipboardList,
  calendar: CalendarDays,
  check: CheckCircle2,
};

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center px-4 py-10 text-center"
    >
      <div
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-mint/40 text-foreground"
      >
        <AppIcon icon={EMPTY_STATE_ICONS[icon]} size="md" />
      </div>
      <p className="mt-3 text-sm font-normal text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-sm font-light text-label">{description}</p>
    </div>
  );
}
