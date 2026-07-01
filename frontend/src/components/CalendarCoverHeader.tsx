type CalendarCoverHeaderProps = {
  year: number;
  month: number;
};

const STRIPE_COUNT = 7;
const DIAMOND_COUNT = 14;

function formatMonthName(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(
    new Date(year, month, 1),
  );
}

function SpiralBinding() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center gap-2 pt-2"
      data-testid="calendar-spiral-binding"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="h-2 w-2 rounded-full border border-gray-300 bg-gray-50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]"
        />
      ))}
    </div>
  );
}

function StripeBar() {
  return (
    <div
      aria-hidden="true"
      className="mt-2 flex h-1 overflow-hidden rounded-full"
      data-testid="calendar-stripe-bar"
    >
      {Array.from({ length: STRIPE_COUNT }, (_, index) => (
        <span
          key={index}
          className={[
            "flex-1",
            index % 2 === 0 ? "bg-accent" : "bg-gray-800",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function DiamondRow() {
  return (
    <div
      aria-hidden="true"
      className="mt-2 flex items-center justify-center gap-1.5"
      data-testid="calendar-diamond-row"
    >
      {Array.from({ length: DIAMOND_COUNT }, (_, index) => (
        <span
          key={index}
          className={[
            "h-1.5 w-1.5 rotate-45 border bg-transparent",
            index % 2 === 0
              ? "border-accent"
              : "border-gray-400",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function FoldedCorner() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 bottom-0 h-10 w-10"
      data-testid="calendar-folded-corner"
    >
      <div className="absolute right-0 bottom-0 h-0 w-0 border-b-[40px] border-l-[40px] border-b-gray-100 border-l-transparent shadow-[-2px_-2px_4px_rgba(0,0,0,0.06)]" />
      <div className="absolute right-0 bottom-0 h-0 w-0 border-b-[36px] border-l-[36px] border-b-white/90 border-l-transparent" />
    </div>
  );
}

export function CalendarCoverHeader({ year, month }: CalendarCoverHeaderProps) {
  const monthName = formatMonthName(year, month);

  return (
    <header
      aria-hidden="true"
      data-testid="calendar-cover-header"
      className="relative mb-2 overflow-hidden rounded-card bg-surface-card px-4 pb-3 pt-0.5 shadow-md"
    >
      <SpiralBinding />
      <StripeBar />

      <div className="mt-3 flex items-center justify-center gap-2">
        <span
          className="text-[2rem] leading-none font-medium tracking-tight text-foreground sm:text-[2.25rem]"
          data-testid="calendar-cover-year"
        >
          {year}
        </span>
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rotate-45 bg-accent"
          data-testid="calendar-year-accent"
        />
      </div>

      <p
        className="mt-0.5 text-center text-base font-normal text-label sm:text-lg"
        data-testid="calendar-cover-month"
      >
        {monthName}
      </p>

      <DiamondRow />
      <FoldedCorner />
    </header>
  );
}
