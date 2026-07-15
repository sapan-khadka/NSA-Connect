import { describe, expect, it } from "vitest";

import {
  filterDocumentsByCategory,
  type MemberDocument,
} from "./member-documents-api";

function doc(
  overrides: Partial<MemberDocument> & Pick<MemberDocument, "id" | "document_type">,
): MemberDocument {
  return {
    member_id: 2,
    uploaded_by_id: 2,
    uploaded_by_name: "Alex",
    file_url: "https://example.com/f",
    file_name: "file.pdf",
    uploaded_at: "2026-07-01T00:00:00Z",
    can_delete: true,
    can_replace: true,
    ...overrides,
  };
}

describe("filterDocumentsByCategory", () => {
  it("returns all or a single category", () => {
    const rows = [
      doc({ id: 1, document_type: "resume" }),
      doc({ id: 2, document_type: "personal_records" }),
    ];
    expect(filterDocumentsByCategory(rows, "all")).toHaveLength(2);
    expect(filterDocumentsByCategory(rows, "personal_records")).toEqual([
      rows[1],
    ]);
  });
});
