import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { HimalayanSilhouette } from "./NepaliDecor";
import nsaLogo from "../assets/nsa-logo.png";

type AppLogoSize = "nav" | "sm" | "md" | "lg";

type AppLogoProps = {
  size?: AppLogoSize;
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
  asLink?: boolean;
};

function NavMountainMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 18.5L9.25 9.5L12.75 14L16.25 8L20.5 18.5"
        stroke="#023D54"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SIZE_STYLES: Record<
  AppLogoSize,
  { image: string; title: string; tagline: string; gap: string }
> = {
  nav: {
    image: "",
    title: "ds-nav-brand-wordmark",
    tagline: "text-[10px] leading-tight",
    gap: "gap-2.5",
  },
  sm: {
    image: "h-16 w-auto shrink-0 object-contain sm:h-[4.5rem]",
    title: "text-base leading-tight",
    tagline: "text-[10px] leading-tight",
    gap: "gap-2.5",
  },
  md: {
    image: "h-20 w-auto shrink-0 object-contain sm:h-[5.5rem]",
    title: "text-xl leading-tight",
    tagline: "text-xs leading-tight",
    gap: "gap-3",
  },
  lg: {
    image: "h-32 w-auto shrink-0 object-contain md:h-36 lg:h-40",
    title: "text-3xl md:text-4xl leading-tight",
    tagline: "text-sm leading-tight",
    gap: "gap-4",
  },
};

export function AppLogo({
  size = "sm",
  showWordmark = true,
  showTagline = false,
  className = "",
  asLink = false,
}: AppLogoProps) {
  const styles = SIZE_STYLES[size];
  const isNavBrand = size === "nav";

  const content = (
    <div
      className={[
        "inline-flex items-center",
        styles.gap,
        className,
      ].join(" ")}
    >
      {isNavBrand ? (
        <NavMountainMark />
      ) : (
        <img
          src={nsaLogo}
          alt="Nepalese Students Association at SEMO"
          className={styles.image}
        />
      )}
      {showWordmark || isNavBrand ? (
        <div className="min-w-0 text-left">
          <p className={isNavBrand ? styles.title : ["font-light tracking-headline text-foreground", styles.title].join(" ")}>
            NSA Connect
          </p>
          {showTagline ? (
            <p
              className={[
                "ds-section-label",
                styles.tagline,
              ].join(" ")}
            >
              Nepalese Students&apos; Association · SEMO
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (asLink) {
    return (
      <Link
        to="/"
        className={[
          "inline-flex shrink-0 items-center transition-opacity hover:opacity-80",
          "rounded-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/35",
        ].join(" ")}
      >
        {content}
      </Link>
    );
  }

  return content;
}

type HomeHeroBrandProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  align?: "left" | "center";
  heroClass?: string;
  showSilhouette?: boolean;
};

export function HomeHeroBrand({
  eyebrow,
  title,
  description,
  actions,
  align = "left",
  heroClass = "nepali-hero",
  showSilhouette = false,
}: HomeHeroBrandProps) {
  const centered = align === "center";

  return (
    <div
      className={[
        "relative flex flex-col gap-6",
        heroClass,
        centered ? "items-center text-center md:items-start md:text-left" : "",
        !centered ? "md:flex-row md:items-center" : "md:flex-row md:items-center",
      ].join(" ")}
    >
      {showSilhouette ? <HimalayanSilhouette /> : null}
      <AppLogo size="lg" showWordmark={false} className="shrink-0" />
      <div className={centered ? "md:text-left" : "min-w-0 flex-1"}>
        <p className="ds-section-label">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-headline text-foreground md:text-4xl">
          {title}
        </h1>
        <p
          className={[
            "mt-3 max-w-2xl text-label",
            centered ? "mx-auto md:mx-0" : "",
          ].join(" ")}
        >
          {description}
        </p>
        {actions ? (
          <div
            className={[
              "mt-6 flex flex-wrap gap-3",
              centered ? "justify-center md:justify-start" : "",
            ].join(" ")}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
