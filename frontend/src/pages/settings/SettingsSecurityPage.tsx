import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { SettingsPageHeader } from "../../layouts/SettingsLayout";
import { useAuth } from "../../context/useAuth";

export function SettingsSecurityPage() {
  const { member } = useAuth();

  if (!member) {
    return null;
  }

  return (
    <div className="settings-page">
      <SettingsPageHeader
        title="Security"
        description="Password for this account."
      />
      <ChangePasswordForm
        email={member.email ?? undefined}
        fullName={member.full_name}
      />
    </div>
  );
}
