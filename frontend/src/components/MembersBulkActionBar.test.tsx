import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MembersBulkActionBar } from "./MembersBulkActionBar";

describe("MembersBulkActionBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("hides when nothing is selected", () => {
    const { container } = render(
      <MembersBulkActionBar selectedCount={0} onClear={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows count and actions when members are selected", () => {
    render(
      <MembersBulkActionBar selectedCount={3} onClear={() => undefined} />,
    );

    expect(screen.getByText("3 members selected")).toBeInTheDocument();
    expect(
      screen.getByRole("toolbar", { name: "Bulk member actions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Email 3 selected members/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Assign Role 3 selected members/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Assign Committee 3 selected members/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Deactivate 3 selected members/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Export 3 selected members/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete 3 selected members/i }),
    ).toBeInTheDocument();
  });

  it("uses singular label for one member", () => {
    render(
      <MembersBulkActionBar selectedCount={1} onClear={() => undefined} />,
    );
    expect(screen.getByText("1 member selected")).toBeInTheDocument();
  });

  it("clears selection from the dismiss control", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(<MembersBulkActionBar selectedCount={2} onClear={onClear} />);

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
