const STATUS_STYLES: Record<string, string> = {
  approved: "bg-mint text-primary",
  pending: "bg-surface-muted text-label",
  rejected: "bg-primary/10 text-primary",
};

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style =
    STATUS_STYLES[status] ?? "bg-surface-muted text-foreground";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs capitalize ${style}`}
    >
      {status}
    </span>
  );
}
