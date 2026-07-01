import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleBadge } from "./RoleBadge";

describe("RoleBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ["president", "President"],
    ["treasurer", "Treasurer"],
    ["board", "Board"],
    ["general", "General"],
  ] as const)("renders the %s role label", (role, label) => {
    render(<RoleBadge role={role} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders unknown roles with a neutral fallback badge", () => {
    render(<RoleBadge role="unknown" />);

    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("supports medium size styling for profile views", () => {
    render(<RoleBadge role="board" size="md" />);

    expect(screen.getByText("Board")).toHaveClass("text-sm");
    expect(screen.getByText("Board").closest("span")).toHaveClass(
      "bg-roleBadge-board-bg",
    );
  });
});
