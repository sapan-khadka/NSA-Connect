import nsaCover from "../assets/nsa-cover.PNG";
import { Card } from "./ui/Card";

type CoverBannerProps = {
  alt?: string;
  className?: string;
};

export function CoverBanner({
  alt = "Nepalese Students Association at SEMO — community events, cultural celebrations, and student life",
  className = "",
}: CoverBannerProps) {
  return (
    <Card
      as="div"
      padding="none"
      className={["overflow-hidden", className].join(" ")}
    >
      <div className="relative">
        <img
          src={nsaCover}
          alt={alt}
          data-testid="nsa-cover-banner"
          className="h-36 w-full object-cover object-center sm:h-44 md:h-48 lg:h-52"
        />
        <div
          aria-hidden="true"
          data-testid="cover-banner-gradient"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent"
        />
      </div>
    </Card>
  );
}
