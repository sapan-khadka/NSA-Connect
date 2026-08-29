import api from "./api";

export type PersonalNote = {
  id: number;
  title: string | null;
  content: string;
  event_id: number | null;
  event_name: string | null;
  event_starts_at: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type PersonalNoteListResponse = {
  notes: PersonalNote[];
  total: number;
};

export type CreatePersonalNoteInput = {
  title?: string | null;
  content: string;
  event_id?: number | null;
  pinned?: boolean;
};

export type UpdatePersonalNoteInput = {
  title?: string | null;
  content?: string;
  event_id?: number | null;
  pinned?: boolean;
  clear_event?: boolean;
};

export async function fetchPersonalNotes(
  eventId?: number | null,
): Promise<PersonalNoteListResponse> {
  const params =
    eventId != null ? { event_id: eventId } : undefined;
  const { data } = await api.get<PersonalNoteListResponse>("/v1/me/notepad", {
    params,
  });
  return data;
}

export async function createPersonalNote(
  input: CreatePersonalNoteInput,
): Promise<PersonalNote> {
  const { data } = await api.post<PersonalNote>("/v1/me/notepad", input);
  return data;
}

export async function updatePersonalNote(
  noteId: number,
  input: UpdatePersonalNoteInput,
): Promise<PersonalNote> {
  const { data } = await api.patch<PersonalNote>(
    `/v1/me/notepad/${noteId}`,
    input,
  );
  return data;
}

export async function deletePersonalNote(noteId: number): Promise<void> {
  await api.delete(`/v1/me/notepad/${noteId}`);
}
