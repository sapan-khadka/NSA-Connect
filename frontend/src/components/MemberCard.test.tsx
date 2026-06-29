import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MemberResponse } from "../lib/auth-api";

import { MemberCard } from "./MemberCard";

const member: MemberResponse = {
  id: 2,
  full_name: "Pending User",
  email: "pending@semo.edu",
  student_id: "S12345678",
  major: "Biology",
  graduation_year: 2027,
  role: "general",
  status: "pending",
  position: "member",
};

describe("MemberCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders member contact and academic details", () => {
    render(<MemberCard member={member} />);

    expect(screen.getByText("Pending User")).toBeInTheDocument();
    expect(screen.getByText("pending@semo.edu")).toBeInTheDocument();
    expect(screen.getByText("S12345678")).toBeInTheDocument();
    expect(screen.getByText("Biology")).toBeInTheDocument();
    expect(screen.getByText("2027")).toBeInTheDocument();
  });

  it("renders an actions slot when provided", () => {
    render(
      <MemberCard
        member={member}
        actions={<button type="button">Approve</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });
});
