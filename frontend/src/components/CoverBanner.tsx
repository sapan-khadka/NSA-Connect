import nsaCover from "../assets/nsa-cover.png";

type CoverBannerProps = {
  alt?: string;
  className?: string;
};

export function CoverBanner({
  alt = "Nepalese Students Association at SEMO — community events, cultural celebrations, and student life",
  className = "",
}: CoverBannerProps) {
  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      <img
        src={nsaCover}
        alt={alt}
        data-testid="nsa-cover-banner"
        className="h-44 w-full object-cover object-center sm:h-52 md:h-60 lg:h-64"
      />
    </div>
  );
}
