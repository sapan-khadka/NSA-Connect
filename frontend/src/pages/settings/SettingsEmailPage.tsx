import { Navigate } from "react-router";

import { AdminTestEmailButton } from "../../components/AdminTestEmailButton";
import { SettingsPageHeader } from "../../layouts/SettingsLayout";
import { useAuth } from "../../context/useAuth";
import { canAccessEmailIntegration } from "../../lib/settings-nav";

export function SettingsEmailPage() {
  const { member } = useAuth();

  if (!member) {
    return null;
  }

  if (!canAccessEmailIntegration(member.role)) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="settings-page">
      <SettingsPageHeader
        title="Email"
        description="Send a test to confirm chapter mail is landing."
      />
      <AdminTestEmailButton />
    </div>
  );
}
