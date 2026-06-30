export function PrayerFlagStripe() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[5px] w-full"
      data-testid="prayer-flag-stripe"
    >
      <span className="flex-1 bg-[#003893]" />
      <span className="flex-1 bg-white" />
      <span className="flex-1 bg-[#DC143C]" />
      <span className="flex-1 bg-emerald-600" />
      <span className="flex-1 bg-marigold" />
    </div>
  );
}

type HimalayanSilhouetteProps = {
  className?: string;
};

export function HimalayanSilhouette({ className = "" }: HimalayanSilhouetteProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      className={["pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.05]", className].join(" ")}
    >
      <path
        fill="#003893"
        d="M0 120 L0 80 L80 40 L160 70 L240 20 L320 55 L400 15 L480 50 L560 25 L640 60 L720 30 L800 55 L880 20 L960 45 L1040 25 L1120 50 L1200 35 L1200 120 Z"
      />
      <path
        fill="#003893"
        d="M0 120 L0 95 L120 65 L200 85 L280 55 L360 75 L440 50 L520 70 L600 45 L680 65 L760 40 L840 60 L920 35 L1000 55 L1080 40 L1200 60 L1200 120 Z"
        opacity="0.6"
      />
    </svg>
  );
}
