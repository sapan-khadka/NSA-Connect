import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PositionBadge } from "./PositionBadge";

describe("PositionBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a badge with icon for exclusive positions", () => {
    render(<PositionBadge position="vice_president" />);
    expect(screen.getByText("Vice President")).toBeInTheDocument();
    expect(screen.getByText("Vice President").closest("span")).toHaveClass(
      "bg-roleBadge-vicePresident-bg",
    );
  });

  it("uses role-specific styling for president", () => {
    render(<PositionBadge position="president" />);
    expect(screen.getByText("President").closest("span")).toHaveClass(
      "text-roleBadge-president",
    );
  });

  it("renders nothing for the default member position", () => {
    const { container } = render(<PositionBadge position="member" />);
    expect(container).toBeEmptyDOMElement();
  });
});
