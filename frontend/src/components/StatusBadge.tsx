const STATUS_STYLES: Record<string, string> = {
  approved: "border-green-200 bg-green-50 text-green-800",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
};

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style =
    STATUS_STYLES[status] ?? "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}
    >
      {status}
    </span>
  );
}
