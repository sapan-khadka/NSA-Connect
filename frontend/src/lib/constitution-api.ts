import api from "./api";

export type ConstitutionUploadResult = {
  filename: string | null;
  page_count: number;
  char_count: number;
  chunk_size_tokens: number;
  overlap_tokens: number;
  chunk_count: number;
};

export async function uploadConstitutionPdf(file: File): Promise<ConstitutionUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<ConstitutionUploadResult>(
    "/v1/constitution/upload",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
}
