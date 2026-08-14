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
      <MembersBulkActionBar
        selectedCount={0}
        onClear={() => undefined}
        onSelectAll={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Selected count and selection controls only", () => {
    render(
      <MembersBulkActionBar
        selectedCount={3}
        onClear={() => undefined}
        onSelectAll={() => undefined}
      />,
    );

    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getByText("3 Members")).toBeInTheDocument();
    expect(
      screen.getByRole("toolbar", { name: "Bulk member actions" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /Assign Role/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Coming Soon/i }),
    ).not.toBeInTheDocument();
  });

  it("uses singular Member label for one selection", () => {
    render(
      <MembersBulkActionBar
        selectedCount={1}
        onClear={() => undefined}
        onSelectAll={() => undefined}
      />,
    );
    expect(screen.getByText("1 Member")).toBeInTheDocument();
  });

  it("clears selection and can select all", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onSelectAll = vi.fn();

    render(
      <MembersBulkActionBar
        selectedCount={2}
        onClear={onClear}
        onSelectAll={onSelectAll}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear Selection" }));
    expect(onClear).toHaveBeenCalledOnce();

    await user.click(
      screen.getByRole("button", { name: "Select All on this page" }),
    );
    expect(onSelectAll).toHaveBeenCalledOnce();
  });

  it("disables Select All when every visible row is selected", () => {
    render(
      <MembersBulkActionBar
        selectedCount={4}
        allVisibleSelected
        onClear={() => undefined}
        onSelectAll={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "All visible members already selected",
      }),
    ).toBeDisabled();
  });
});
