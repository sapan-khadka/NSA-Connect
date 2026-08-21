import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NsaDocumentsPanel } from "../components/NsaDocumentsPanel";
import { uploadConstitutionPdf } from "../lib/constitution-api";
import { createMockMember, renderWithRouter } from "../test/test-utils";

vi.mock("../lib/org-documents-api", () => ({
  fetchOrgDocuments: vi.fn(async () => []),
  uploadOrgDocument: vi.fn(),
  deleteOrgDocument: vi.fn(),
}));

vi.mock("../lib/constitution-api", () => ({
  uploadConstitutionPdf: vi.fn(async () => ({
    filename: "constitution.pdf",
    page_count: 12,
    char_count: 42000,
    chunk_size_tokens: 512,
    overlap_tokens: 64,
    chunk_count: 18,
  })),
}));

describe("NsaDocumentsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows constitution upload for board members and reports indexing result", async () => {
    const user = userEvent.setup();

    renderWithRouter(<NsaDocumentsPanel />, {
      auth: {
        member: createMockMember("board"),
        isAuthenticated: true,
      },
    });

    expect(
      await screen.findByText("Constitution (canonical)"),
    ).toBeInTheDocument();

    const constitutionForm = screen
      .getByText("Constitution (canonical)")
      .closest("form");
    expect(constitutionForm).not.toBeNull();
    const fileInput = constitutionForm!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "constitution.pdf", {
      type: "application/pdf",
    });
    await user.upload(fileInput, file);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /upload constitution for ai/i }),
      ).not.toBeDisabled();
    });
    fireEvent.submit(constitutionForm!);

    await waitFor(() => {
      expect(uploadConstitutionPdf).toHaveBeenCalledWith(file);
    });
    expect(screen.getByRole("status")).toHaveTextContent("constitution.pdf");
    expect(screen.getByRole("status")).toHaveTextContent("12 pages");
    expect(screen.getByRole("status")).toHaveTextContent("18 AI sections");
  });

  it("hides constitution upload for non-board members", async () => {
    renderWithRouter(<NsaDocumentsPanel />, {
      auth: {
        member: createMockMember("general"),
        isAuthenticated: true,
      },
    });

    await screen.findByText(/No chapter documents yet\./);
    expect(
      screen.queryByText("Constitution (canonical)"),
    ).not.toBeInTheDocument();
  });
});
