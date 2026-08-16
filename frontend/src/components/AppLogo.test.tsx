import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AppLogo } from "./AppLogo";

describe("AppLogo", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the NSA logo image and wordmark", () => {
    render(
      <MemoryRouter>
        <AppLogo />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("img", {
        name: "Nepalese Students Association at SEMO",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("NSA Connect")).toBeInTheDocument();
  });

  it("links to home when asLink is enabled", () => {
    render(
      <MemoryRouter>
        <AppLogo asLink />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });

  it("renders the original NSA logo and wordmark in the nav brand", () => {
    render(
      <MemoryRouter>
        <AppLogo asLink size="nav" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("img", {
        name: "Nepalese Students Association at SEMO",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("NSA Connect")).toHaveClass("ds-nav-brand-wordmark");
  });
});
