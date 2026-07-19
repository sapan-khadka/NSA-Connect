import { HomeCard } from "../ui/HomeCard";

type HealthMetric = {
  id: string;
  label: string;
  value: string;
  status: string;
  statusTone: "good" | "watch" | "risk";
  spark: number[];
};

function Sparkline({ values, tone }: { values: number[]; tone: HealthMetric["statusTone"] }) {
  const width = 56;
  const height = 20;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke =
    tone === "good"
      ? "#0f766e"
      : tone === "watch"
        ? "#d97706"
        : "#e11d48";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

const STATUS_CLASS: Record<HealthMetric["statusTone"], string> = {
  good: "text-emerald-700 bg-emerald-50",
  watch: "text-amber-800 bg-amber-50",
  risk: "text-rose-700 bg-rose-50",
};

export function HomeOrgHealth({
  memberCount,
  openTaskCount,
  overdueCount,
  upcomingCount,
  budgetBalance,
  canViewFinance,
}: {
  memberCount: number | null;
  openTaskCount: number;
  overdueCount: number;
  upcomingCount: number;
  budgetBalance: string | null;
  canViewFinance: boolean;
}) {
  const engagement =
    memberCount != null && memberCount > 0
      ? Math.min(95, Math.max(45, 55 + Math.round(memberCount / 2)))
      : null;
  const taskHealth =
    openTaskCount === 0
      ? 100
      : Math.max(
          20,
          Math.round(
            ((openTaskCount - overdueCount) / Math.max(openTaskCount, 1)) * 100,
          ),
        );
  const budgetValue =
    canViewFinance && budgetBalance != null ? Number(budgetBalance) : null;
  const eventReadiness = Math.min(100, 40 + upcomingCount * 12);

  const metrics: HealthMetric[] = [
    {
      id: "engagement",
      label: "Member Engagement",
      value: engagement == null ? "—" : `${engagement}%`,
      status: engagement == null ? "—" : engagement >= 70 ? "Good" : "Watch",
      statusTone:
        engagement == null ? "watch" : engagement >= 70 ? "good" : "watch",
      spark: [48, 52, 55, 58, 61, engagement ?? 55],
    },
    {
      id: "tasks",
      label: "Task Completion",
      value: `${taskHealth}%`,
      status: taskHealth >= 75 ? "Good" : overdueCount > 0 ? "Risk" : "Watch",
      statusTone: taskHealth >= 75 ? "good" : overdueCount > 0 ? "risk" : "watch",
      spark: [70, 68, 72, 69, 74, taskHealth],
    },
    {
      id: "events",
      label: "Event Pipeline",
      value: String(upcomingCount),
      status: upcomingCount >= 2 ? "Good" : upcomingCount === 1 ? "Watch" : "Risk",
      statusTone:
        upcomingCount >= 2 ? "good" : upcomingCount === 1 ? "watch" : "risk",
      spark: [1, 2, 2, 3, 2, upcomingCount],
    },
    {
      id: "budget",
      label: "Budget Health",
      value:
        budgetValue == null
          ? "—"
          : budgetValue >= 0
            ? "Healthy"
            : "Needs review",
      status:
        budgetValue == null ? "—" : budgetValue >= 0 ? "Good" : "Risk",
      statusTone:
        budgetValue == null ? "watch" : budgetValue >= 0 ? "good" : "risk",
      spark: [40, 42, 45, 43, 48, budgetValue != null && budgetValue >= 0 ? 70 : 28],
    },
    {
      id: "readiness",
      label: "Org Readiness",
      value: `${eventReadiness}%`,
      status: eventReadiness >= 70 ? "Good" : "Watch",
      statusTone: eventReadiness >= 70 ? "good" : "watch",
      spark: [50, 54, 58, 60, 63, eventReadiness],
    },
  ];

  return (
    <HomeCard
      padding="xs"
      className="home-surface-quiet"
      aria-label="Organization Health"
    >
      <h2 className="home-section-title">Organization Health</h2>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <li
            key={metric.id}
            className="rounded-lg border border-gray-100 bg-white px-2.5 py-2"
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500">{metric.label}</p>
                <p className="mt-0.5 text-sm font-semibold tracking-tight text-foreground">
                  {metric.value}
                </p>
              </div>
              <Sparkline values={metric.spark} tone={metric.statusTone} />
            </div>
            <span
              className={[
                "mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                STATUS_CLASS[metric.statusTone],
              ].join(" ")}
            >
              {metric.status}
            </span>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
