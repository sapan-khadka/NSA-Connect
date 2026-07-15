import api from "./api";

export type MemberNote = {
  id: number;
  member_id: number;
  author_id: number;
  author_name: string;
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberNoteListResponse = {
  member_id: number;
  notes: MemberNote[];
  total: number;
};

export type CreateMemberNoteInput = {
  content: string;
  pinned?: boolean;
};

export type UpdateMemberNoteInput = {
  content?: string;
  pinned?: boolean;
};

export async function fetchMemberNotes(
  memberId: number,
): Promise<MemberNoteListResponse> {
  const { data } = await api.get<MemberNoteListResponse>(
    `/v1/members/${memberId}/notes`,
  );
  return data;
}

export async function createMemberNote(
  memberId: number,
  input: CreateMemberNoteInput,
): Promise<MemberNote> {
  const { data } = await api.post<MemberNote>(
    `/v1/members/${memberId}/notes`,
    input,
  );
  return data;
}

export async function updateMemberNote(
  memberId: number,
  noteId: number,
  input: UpdateMemberNoteInput,
): Promise<MemberNote> {
  const { data } = await api.patch<MemberNote>(
    `/v1/members/${memberId}/notes/${noteId}`,
    input,
  );
  return data;
}

export async function deleteMemberNote(
  memberId: number,
  noteId: number,
): Promise<void> {
  await api.delete(`/v1/members/${memberId}/notes/${noteId}`);
}
