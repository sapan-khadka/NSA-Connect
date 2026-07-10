import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  Alert,
  ConfirmationDialog,
  Drawer,
  LoadingOverlay,
  Modal,
  Toast,
  ToastViewport,
} from "../index";

describe("design-system feedback components", () => {
  it("renders Alert tones and dismiss", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <Alert tone="success" title="Saved" onDismiss={onDismiss}>
        Your changes are live.
      </Alert>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders Toast inside viewport", () => {
    render(
      <ToastViewport>
        <Toast title="Uploaded" description="Receipt scanned." tone="info" />
      </ToastViewport>,
    );
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it("opens Modal and ConfirmationDialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <Modal open title="Edit entry" onClose={onClose}>
        <p>Modal body</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Edit entry");
    await user.click(screen.getByRole("button", { name: /^Close$/ }));
    expect(onClose).toHaveBeenCalled();

    rerender(
      <ConfirmationDialog
        open
        title="Delete item?"
        description="This cannot be undone."
        tone="danger"
        confirmLabel="Delete"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Delete item?");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("renders Drawer and LoadingOverlay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { unmount } = render(
      <Drawer open title="Filters" onClose={onClose} side="right">
        <p>Drawer content</p>
      </Drawer>,
    );

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Close$/ }));
    expect(onClose).toHaveBeenCalled();
    unmount();

    render(<LoadingOverlay open label="Saving…" />);
    expect(screen.getByText("Saving…", { selector: "p" })).toBeInTheDocument();
  });
});
