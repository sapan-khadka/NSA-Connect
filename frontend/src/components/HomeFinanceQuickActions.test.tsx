import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeFinanceQuickActions } from "./HomeFinanceQuickActions";

describe("HomeFinanceQuickActions", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders log transaction and review approvals with badge", () => {
    const onLogTransaction = vi.fn();

    render(
      <MemoryRouter>
        <HomeFinanceQuickActions
          pendingApprovalCount={2}
          onLogTransaction={onLogTransaction}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "+ Log transaction" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review approvals/ })).toHaveAttribute(
      "href",
      "/finance?tab=approvals",
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
