import type { ReactNode } from "react";

export type EmptyStateIcon = "clipboard" | "calendar" | "check";

type EmptyStateProps = {
  icon: EmptyStateIcon;
  title: string;
  description: string;
};

function EmptyStateIconGraphic({ icon }: { icon: EmptyStateIcon }) {
  const paths: Record<EmptyStateIcon, ReactNode> = {
    clipboard: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    ),
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
    check: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="h-5 w-5"
    >
      {paths[icon]}
    </svg>
  );
}

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
        <EmptyStateIconGraphic icon={icon} />
      </div>
      <p className="mt-3 text-sm font-normal text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-sm font-light text-label">{description}</p>
    </div>
  );
}
