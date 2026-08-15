import { NotificationPreferencesSection } from "../../components/NotificationPreferencesSection";
import { SettingsPageHeader } from "../../layouts/SettingsLayout";

export function SettingsNotificationsPage() {
  return (
    <div className="settings-page">
      <SettingsPageHeader
        title="Notifications"
        description="Email for events, tasks, and announcements."
      />
      <NotificationPreferencesSection />
    </div>
  );
}
