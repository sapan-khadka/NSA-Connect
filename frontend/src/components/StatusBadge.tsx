import { Badge, type BadgeVariant } from "./ui/Badge";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  approved: "success",
  pending: "neutral",
  rejected: "danger",
};

type StatusBadgeProps = {
  status: string;
};

/**
 * Member/account status chip built on the design-system Badge.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "neutral"}
      className="capitalize"
    >
      {status}
    </Badge>
  );
}
