import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as memberDocumentsApi from "../../lib/member-documents-api";
import { MemberWorkspaceDocuments } from "./MemberWorkspaceDocuments";

vi.mock("../../lib/member-documents-api", async () => {
  const actual = await vi.importActual<typeof memberDocumentsApi>(
    "../../lib/member-documents-api",
  );
  return {
    ...actual,
    fetchMemberDocuments: vi.fn(),
    uploadMemberDocument: vi.fn(),
    deleteMemberDocument: vi.fn(),
  };
});

describe("MemberWorkspaceDocuments", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows officer-only unavailable state when viewer cannot manage", () => {
    render(<MemberWorkspaceDocuments memberId={2} canManage={false} />);

    const section = screen.getByLabelText("Documents");
    expect(
      within(section).getByRole("heading", { name: "Documents" }),
    ).toBeInTheDocument();
    expect(
      within(section).getByText("Documents unavailable"),
    ).toBeInTheDocument();
    expect(memberDocumentsApi.fetchMemberDocuments).not.toHaveBeenCalled();
  });

  it("renders empty state and document rows for board viewers", async () => {
    vi.mocked(memberDocumentsApi.fetchMemberDocuments).mockResolvedValue({
      member_id: 2,
      total: 1,
      documents: [
        {
          id: 9,
          member_id: 2,
          uploaded_by_id: 1,
          uploaded_by_name: "Board Member",
          file_url: "https://example.com/resume.pdf",
          file_name: "Resume.pdf",
          document_type: "resume",
          uploaded_at: "2026-07-01T12:00:00Z",
          can_delete: true,
        },
      ],
    });

    render(<MemberWorkspaceDocuments memberId={2} canManage />);

    const section = await screen.findByLabelText("Documents");
    await waitFor(() => {
      expect(within(section).getByText("Resume.pdf")).toBeInTheDocument();
    });
    expect(
      within(section).getByText("Resume", { selector: ".member-workspace-docs-badge" }),
    ).toBeInTheDocument();
    expect(within(section).getByText(/Board Member/)).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: /View/i }),
    ).toHaveAttribute("href", "https://example.com/resume.pdf");
  });

  it("shows no-documents empty state when list is empty", async () => {
    vi.mocked(memberDocumentsApi.fetchMemberDocuments).mockResolvedValue({
      member_id: 2,
      total: 0,
      documents: [],
    });

    render(<MemberWorkspaceDocuments memberId={2} canManage />);

    expect(
      await screen.findByText("No documents on file."),
    ).toBeInTheDocument();
  });

  it("uploads a selected file with the chosen document type", async () => {
    const user = userEvent.setup();
    vi.mocked(memberDocumentsApi.fetchMemberDocuments).mockResolvedValue({
      member_id: 2,
      total: 0,
      documents: [],
    });
    vi.mocked(memberDocumentsApi.uploadMemberDocument).mockResolvedValue({
      id: 11,
      member_id: 2,
      uploaded_by_id: 1,
      uploaded_by_name: "Board Member",
      file_url: "https://example.com/waiver.pdf",
      file_name: "waiver.pdf",
      document_type: "waiver",
      uploaded_at: "2026-07-02T12:00:00Z",
      can_delete: true,
    });

    render(<MemberWorkspaceDocuments memberId={2} canManage />);
    await screen.findByText("No documents on file.");

    await user.selectOptions(screen.getByLabelText("Type"), "waiver");
    const file = new File(["%PDF-1.4"], "waiver.pdf", {
      type: "application/pdf",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(memberDocumentsApi.uploadMemberDocument).toHaveBeenCalledWith(
        2,
        file,
        "waiver",
      );
    });
    expect(await screen.findByText("waiver.pdf")).toBeInTheDocument();
  });
});
