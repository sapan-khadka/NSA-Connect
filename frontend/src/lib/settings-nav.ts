import { isRoleAtLeast, type MemberRole } from "./roles";

export type SettingsNavGroupId = "account" | "chapter";

export type SettingsNavItem = {
  id: string;
  label: string;
  to: string;
  group: SettingsNavGroupId;
};

export type SettingsNavGroup = {
  id: SettingsNavGroupId;
  label: string;
  items: SettingsNavItem[];
};

export function canAccessEmailIntegration(role: MemberRole): boolean {
  return isRoleAtLeast(role, "board");
}

const SETTINGS_NAV_GROUPS: { id: SettingsNavGroupId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "chapter", label: "Chapter" },
];

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "profile", label: "Profile", to: "/settings/profile", group: "account" },
  { id: "privacy", label: "Privacy", to: "/settings/privacy", group: "account" },
  {
    id: "notifications",
    label: "Notifications",
    to: "/settings/notifications",
    group: "account",
  },
  { id: "security", label: "Security", to: "/settings/security", group: "account" },
  { id: "email", label: "Email", to: "/settings/email", group: "chapter" },
];

export function getSettingsNavItems(role: MemberRole): SettingsNavItem[] {
  return SETTINGS_NAV.filter(
    (item) => item.group !== "chapter" || canAccessEmailIntegration(role),
  );
}

export function getSettingsNavGroups(role: MemberRole): SettingsNavGroup[] {
  const items = getSettingsNavItems(role);
  return SETTINGS_NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}
