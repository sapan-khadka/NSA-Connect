import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { id: "chat", label: "Chat" },
  { id: "documents", label: "NSA Documents" },
] as const;

function Harness() {
  const [tab, setTab] = useState<"chat" | "documents">("chat");
  return (
    <SegmentedControl
      ariaLabel="Assistant section"
      value={tab}
      options={OPTIONS}
      onChange={setTab}
    />
  );
}

describe("SegmentedControl", () => {
  it("keeps equal-width tracks for mixed-length labels", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Assistant section" });
    expect(group.className).toMatch(/\bds-seg\b/);
    expect(group.className).not.toMatch(/\bis-fill\b/);
    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "NSA Documents" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the pressed option", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "NSA Documents" }));
    expect(
      screen.getByRole("button", { name: "NSA Documents" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
