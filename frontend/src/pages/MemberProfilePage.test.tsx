import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import { MockAuthProvider } from "../test/test-utils";

import { MemberProfilePage } from "./MemberProfilePage";

vi.mock("../lib/members-api", () => ({
  fetchMemberById: vi.fn(),
  updateMemberProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  updateMemberRole: vi.fn(),
  updateMemberPosition: vi.fn(),
}));

const secretaryMember: MemberResponse = {
  id: 2,
  full_name: "Secretary User",
  email: "secretary@semo.edu",
  student_id: "12345678",
  major: "Biology",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "secretary",
};

const presidentMember: MemberResponse = {
  id: 1,
  full_name: "President User",
  email: "president@semo.edu",
  student_id: "87654321",
  major: "Administration",
  graduation_year: 2028,
  role: "president",
  status: "approved",
  position: "president",
};

function renderMemberProfile() {
  return render(
    <MockAuthProvider
      value={{
        member: presidentMember,
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={["/members/2"]}>
        <Routes>
          <Route path="/members/:memberId" element={<MemberProfilePage />} />
        </Routes>
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("MemberProfilePage membership admin", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the balanced profile sections", async () => {
    const { fetchMemberById } = await import("../lib/members-api");
    vi.mocked(fetchMemberById).mockResolvedValue(secretaryMember);

    renderMemberProfile();
    expect(await screen.findByText("Secretary User")).toBeInTheDocument();

    expect(screen.getByRole("region", { name: "Overview" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Member Health" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "AI Insights" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Attendance" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Payments" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Notes" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Activity Timeline" }),
    ).toBeInTheDocument();
  });

  it("saves the selected position string when demoting a board officer to Member", async () => {
    const user = userEvent.setup();
    const { fetchMemberById, updateMemberPosition, updateMemberRole } = await import(
      "../lib/members-api",
    );

    vi.mocked(fetchMemberById).mockResolvedValue(secretaryMember);
    vi.mocked(updateMemberPosition).mockResolvedValue({
      ...secretaryMember,
      position: "member",
    });
    vi.mocked(updateMemberRole).mockResolvedValue({
      ...secretaryMember,
      position: "member",
      role: "general",
    });

    renderMemberProfile();
    expect(await screen.findByText("Secretary User")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Change position for Secretary User"),
      "member",
    );

    await waitFor(() => {
      expect(updateMemberPosition).toHaveBeenCalledWith(2, "member");
    });

    await user.selectOptions(
      screen.getByLabelText("Change role for Secretary User"),
      "general",
    );

    await waitFor(() => {
      expect(updateMemberRole).toHaveBeenCalledWith(2, { role: "general" });
    });
  });

  it("shows a friendly message when the backend rejects a role update", async () => {
    const user = userEvent.setup();
    const { fetchMemberById, updateMemberPosition } = await import("../lib/members-api");
    const { AxiosError } = await import("axios");

    vi.mocked(fetchMemberById).mockResolvedValue({
      ...secretaryMember,
      position: "member",
    });

    const validationError = new AxiosError("Validation failed");
    validationError.response = {
      status: 422,
      data: {
        detail: [
          {
            msg: "Input should be 'member'",
          },
        ],
      },
      statusText: "Unprocessable Entity",
      headers: {},
      config: {} as never,
    };
    vi.mocked(updateMemberPosition).mockRejectedValue(validationError);

    renderMemberProfile();
    expect(await screen.findByText("Secretary User")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Change position for Secretary User"),
      "event_manager",
    );

    expect(
      await screen.findByText("Couldn't update role or position — please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Input should be/)).not.toBeInTheDocument();
  });
});
