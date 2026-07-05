import api from "./api";

export type NotificationPreferences = {
  event_reminders: boolean;
  rsvp_nudges: boolean;
  task_reminders: boolean;
  dues_reminders: boolean;
  announcements: boolean;
};

export type NotificationPreferencesUpdate = Partial<NotificationPreferences>;

export type SendTestEmailResponse = {
  success: boolean;
  message: string;
  email_id: string;
};

export type NotificationCheckStats = {
  candidates: number;
  sent: number;
  skipped: number;
};

export type NotificationCheckSummary = {
  checked_at: string;
  event_reminders: NotificationCheckStats;
  rsvp_nudges: NotificationCheckStats;
  task_due_reminders: NotificationCheckStats;
  dues_reminders: NotificationCheckStats;
};

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await api.get<NotificationPreferences>("/v1/notifications/preferences");
  return response.data;
}

export async function updateNotificationPreferences(
  data: NotificationPreferencesUpdate,
): Promise<NotificationPreferences> {
  const response = await api.patch<NotificationPreferences>(
    "/v1/notifications/preferences",
    data,
  );
  return response.data;
}

export async function runNotificationCheck(
  asOf?: string,
): Promise<NotificationCheckSummary> {
  const response = await api.post<NotificationCheckSummary>(
    "/v1/notifications/run-check",
    asOf ? { as_of: asOf } : {},
  );
  return response.data;
}

export async function sendTestEmail(
  toEmail: string,
): Promise<SendTestEmailResponse> {
  const response = await api.post<SendTestEmailResponse>(
    "/v1/notifications/test-email",
    { to_email: toEmail.trim().toLowerCase() },
  );
  return response.data;
}
