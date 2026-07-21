import api from "./api";
import type { EventType } from "./event-types";

export type PublicEventResponse = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string | null;
  event_type: EventType;
  description: string;
  location: string | null;
  capacity: number | null;
  going_count: number;
  event_photo_url: string | null;
  is_past: boolean;
};

export async function fetchPublicEvent(
  eventId: number,
): Promise<PublicEventResponse> {
  const response = await api.get<PublicEventResponse>(
    `/v1/public/events/${eventId}`,
  );
  return response.data;
}
