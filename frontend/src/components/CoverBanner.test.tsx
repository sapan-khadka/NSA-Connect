import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { MockAuthProvider } from "../test/test-utils";
import { HomePage } from "../pages/HomePage";
import { CoverBanner } from "./CoverBanner";

afterEach(() => {
  cleanup();
});

describe("CoverBanner", () => {
  it("renders the NSA community cover image", () => {
    render(<CoverBanner />);

    expect(screen.getByTestId("nsa-cover-banner")).toBeInTheDocument();
  });
});

describe("HomePage cover", () => {
  it("shows the cover banner on the public home page", () => {
    render(
      <MemoryRouter>
        <MockAuthProvider value={{ member: null, isAuthenticated: false, token: null }}>
          <HomePage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("nsa-cover-banner")).toBeInTheDocument();
  });
});
