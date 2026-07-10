import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Input,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from "./index";

describe("design-system/components", () => {
  it("renders Button with loading state", () => {
    render(
      <Button loading aria-label="Save changes">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Save/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders Card with default surface", () => {
    const { container } = render(<Card>Body</Card>);
    expect(container.firstChild).toHaveClass("rounded-card");
    expect(container.firstChild).toHaveClass("bg-surface-card");
  });

  it("renders Input error for assistive tech", () => {
    render(<Input label="Email" error="Required" name="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("renders Textarea and Select with labels", () => {
    render(
      <>
        <Textarea label="Notes" name="notes" />
        <Select
          label="Role"
          name="role"
          options={[
            { value: "board", label: "Board" },
            { value: "general", label: "General" },
          ]}
        />
      </>,
    );
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
  });

  it("renders Badge, Avatar, Divider, Skeleton, Spinner", () => {
    render(
      <>
        <Badge variant="success">Paid</Badge>
        <Avatar name="Ada Lovelace" />
        <Divider />
        <Skeleton data-testid="skel" />
        <Spinner label="Please wait" />
      </>,
    );
    expect(screen.getByText("Paid")).toHaveClass("text-success");
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent(
      "AL",
    );
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.getByTestId("skel")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Please wait")).toBeInTheDocument();
    expect(screen.getByText("Please wait").closest("[role='status']")).not.toBeNull();
  });
});
