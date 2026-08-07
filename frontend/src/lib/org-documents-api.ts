import { api } from "./api";

export type OrgDocumentVisibility = "public" | "board";

export type OrgDocument = {
  id: number;
  title: string;
  description: string | null;
  visibility: OrgDocumentVisibility;
  file_name: string;
  file_url: string | null;
  content_type: string | null;
  page_count: number | null;
  char_count: number | null;
  chunk_count: number;
  uploaded_by_id: number | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchOrgDocuments(): Promise<OrgDocument[]> {
  const response = await api.get<{ documents: OrgDocument[] }>("/v1/org-documents");
  return response.data.documents;
}

export async function uploadOrgDocument(input: {
  title: string;
  description?: string;
  visibility: OrgDocumentVisibility;
  file: File;
}): Promise<OrgDocument> {
  const form = new FormData();
  form.append("title", input.title);
  form.append("visibility", input.visibility);
  if (input.description?.trim()) {
    form.append("description", input.description.trim());
  }
  form.append("file", input.file);
  const response = await api.post<OrgDocument>("/v1/org-documents", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function updateOrgDocument(
  documentId: number,
  patch: {
    title?: string;
    description?: string | null;
    visibility?: OrgDocumentVisibility;
  },
): Promise<OrgDocument> {
  const response = await api.patch<OrgDocument>(
    `/v1/org-documents/${documentId}`,
    patch,
  );
  return response.data;
}

export async function deleteOrgDocument(documentId: number): Promise<void> {
  await api.delete(`/v1/org-documents/${documentId}`);
}
