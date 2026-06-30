import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { HimalayanSilhouette } from "./NepaliDecor";
import nsaLogo from "../assets/nsa-logo.svg";

type AppLogoSize = "sm" | "md" | "lg";

type AppLogoProps = {
  size?: AppLogoSize;
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
  asLink?: boolean;
};

const SIZE_STYLES: Record<
  AppLogoSize,
  { image: string; title: string; tagline: string; gap: string }
> = {
  sm: {
    image: "h-10 w-10",
    title: "text-base leading-tight",
    tagline: "text-[10px] leading-tight",
    gap: "gap-2.5",
  },
  md: {
    image: "h-14 w-14",
    title: "text-xl leading-tight",
    tagline: "text-xs leading-tight",
    gap: "gap-3",
  },
  lg: {
    image: "h-20 w-20 md:h-24 md:w-24",
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

  const content = (
    <div
      className={[
        "inline-flex items-center",
        styles.gap,
        className,
      ].join(" ")}
    >
      <img
        src={nsaLogo}
        alt="Nepalese Students Association at SEMO"
        className={[
          styles.image,
          "shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5",
        ].join(" ")}
      />
      {showWordmark ? (
        <div className="min-w-0 text-left">
          <p
            className={[
              "font-bold tracking-tight text-primary",
              styles.title,
            ].join(" ")}
          >
            NSA Connect
          </p>
          {showTagline ? (
            <p
              className={[
                "font-medium uppercase tracking-wide text-accent",
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
        className="rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary md:text-4xl">
          {title}
        </h1>
        <p
          className={[
            "mt-3 max-w-2xl text-gray-600",
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
