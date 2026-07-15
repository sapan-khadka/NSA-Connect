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
    replaceMemberDocument: vi.fn(),
    deleteMemberDocument: vi.fn(),
  };
});

describe("MemberWorkspaceDocuments", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows unavailable state when viewer cannot manage", () => {
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

  it("renders document rows and category filter for authorized viewers", async () => {
    const user = userEvent.setup();
    vi.mocked(memberDocumentsApi.fetchMemberDocuments).mockResolvedValue({
      member_id: 2,
      total: 2,
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
          can_replace: true,
        },
        {
          id: 10,
          member_id: 2,
          uploaded_by_id: 1,
          uploaded_by_name: "Board Member",
          file_url: "https://example.com/waiver.pdf",
          file_name: "Waiver.pdf",
          document_type: "waiver",
          uploaded_at: "2026-07-02T12:00:00Z",
          can_delete: true,
          can_replace: true,
        },
      ],
    });

    render(<MemberWorkspaceDocuments memberId={2} canManage />);

    const section = await screen.findByLabelText("Documents");
    await waitFor(() => {
      expect(within(section).getByText("Resume.pdf")).toBeInTheDocument();
    });
    expect(within(section).getByText("Waiver.pdf")).toBeInTheDocument();
    expect(
      within(section).getAllByRole("link", { name: /View/i })[0],
    ).toHaveAttribute("href", "https://example.com/resume.pdf");

    await user.selectOptions(screen.getByLabelText("Filter"), "resume");
    expect(within(section).getByText("Resume.pdf")).toBeInTheDocument();
    expect(within(section).queryByText("Waiver.pdf")).not.toBeInTheDocument();
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

  it("shows finance reimbursement caption for Personal Records", async () => {
    const user = userEvent.setup();
    vi.mocked(memberDocumentsApi.fetchMemberDocuments).mockResolvedValue({
      member_id: 2,
      total: 0,
      documents: [],
    });

    render(<MemberWorkspaceDocuments memberId={2} canManage />);
    await screen.findByText("No documents on file.");

    expect(
      screen.queryByText(/For reimbursements, use Finance/),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Category"),
      "personal_records",
    );
    expect(
      screen.getByText(memberDocumentsApi.PERSONAL_RECORDS_UPLOAD_CAPTION),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Personal Records" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Receipts" }),
    ).not.toBeInTheDocument();
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
      can_replace: true,
    });

    render(<MemberWorkspaceDocuments memberId={2} canManage />);
    await screen.findByText("No documents on file.");

    await user.selectOptions(screen.getByLabelText("Category"), "waiver");
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
