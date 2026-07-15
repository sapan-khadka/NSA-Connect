import api from "./api";

export const MEMBER_DOCUMENT_TYPES = [
  "resume",
  "waiver",
  "certificate",
  "other",
] as const;

export type MemberDocumentType = (typeof MEMBER_DOCUMENT_TYPES)[number];

export type MemberDocument = {
  id: number;
  member_id: number;
  uploaded_by_id: number;
  uploaded_by_name: string;
  file_url: string;
  file_name: string;
  document_type: MemberDocumentType;
  uploaded_at: string;
  can_delete: boolean;
};

export type MemberDocumentListResponse = {
  member_id: number;
  documents: MemberDocument[];
  total: number;
};

export const MEMBER_DOCUMENT_TYPE_LABELS: Record<MemberDocumentType, string> = {
  resume: "Resume",
  waiver: "Waiver",
  certificate: "Certificate",
  other: "Other",
};

/** Matches finance receipt / member-document upload validation (PDF + images). */
export const MEMBER_DOCUMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

export async function fetchMemberDocuments(
  memberId: number,
): Promise<MemberDocumentListResponse> {
  const response = await api.get<MemberDocumentListResponse>(
    `/v1/members/${memberId}/documents`,
  );
  return response.data;
}

export async function uploadMemberDocument(
  memberId: number,
  file: File,
  documentType: MemberDocumentType,
  options?: {
    fileName?: string;
    onProgress?: (percent: number) => void;
  },
): Promise<MemberDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  if (options?.fileName?.trim()) {
    formData.append("file_name", options.fileName.trim());
  }

  const response = await api.post<MemberDocument>(
    `/v1/members/${memberId}/documents`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!options?.onProgress || !event.total) {
          return;
        }
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );
  return response.data;
}

export async function deleteMemberDocument(
  memberId: number,
  documentId: number,
): Promise<void> {
  await api.delete(`/v1/members/${memberId}/documents/${documentId}`);
}
