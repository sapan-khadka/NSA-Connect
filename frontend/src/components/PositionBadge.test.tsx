import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PositionBadge } from "./PositionBadge";

describe("PositionBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a badge for exclusive positions", () => {
    render(<PositionBadge position="vice_president" />);
    expect(screen.getByText("Vice President")).toBeInTheDocument();
  });

  it("renders nothing for the default member position", () => {
    const { container } = render(<PositionBadge position="member" />);
    expect(container).toBeEmptyDOMElement();
  });
});
