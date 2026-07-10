import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

describe("CampusOS base UI components", () => {
  it("renders Button variants", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "bg-primary",
    );
  });

  it("renders Card with ds-card surface", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass("ds-card");
  });

  it("renders Badge with semantic tone", () => {
    render(<Badge variant="success">Paid</Badge>);
    expect(screen.getByText("Paid")).toHaveClass("text-success");
  });

  it("renders Input with label and error", () => {
    render(<Input label="Email" error="Required" name="email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});
