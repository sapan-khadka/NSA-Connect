import { Navigate, NavLink, Outlet, useLocation } from "react-router";

import { PageBackLink } from "../components/ui/PageBackLink";
import { useAuth } from "../context/useAuth";
import { Avatar } from "../design-system/components/Avatar";
import { useIsLgUp } from "../hooks/useMediaQuery";
import type { MemberResponse } from "../lib/auth-api";
import { formatMemberAccessLabel } from "../lib/roles";
import {
  getSettingsNavGroups,
  type SettingsNavGroup,
} from "../lib/settings-nav";

export function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="settings-header">
      <h1 className="settings-title">{title}</h1>
      <p className="settings-lede">{description}</p>
    </header>
  );
}

function SettingsIdentity({ member }: { member: MemberResponse }) {
  return (
    <div className="settings-identity">
      <Avatar
        name={member.full_name}
        memberId={member.id}
        src={member.avatar_url}
        size="md"
        alt=""
      />
      <div>
        <p className="settings-identity-name">{member.full_name}</p>
        <p className="settings-identity-meta">
          {formatMemberAccessLabel(member)}
        </p>
      </div>
    </div>
  );
}

function SettingsNav({
  groups,
  menu = false,
}: {
  groups: SettingsNavGroup[];
  menu?: boolean;
}) {
  return (
    <nav
      className={["settings-nav", menu ? "is-menu" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="Settings"
    >
      {groups.map((group) => (
        <div key={group.id} className="settings-nav-group">
          <p className="event-command-kicker">{group.label}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "settings-nav-link",
                      !menu && isActive ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SettingsLayout() {
  const { member } = useAuth();
  const isLgUp = useIsLgUp();
  const { pathname } = useLocation();
  const isIndex = pathname === "/settings" || pathname === "/settings/";

  if (!member) {
    return null;
  }

  if (isIndex && isLgUp) {
    return <Navigate to="/settings/profile" replace />;
  }

  const groups = getSettingsNavGroups(
    member.role,
    Boolean(member.is_org_owner),
  );

  if (isIndex) {
    return (
      <div className="settings-shell is-index">
        <SettingsIdentity member={member} />
        <SettingsNav groups={groups} menu />
      </div>
    );
  }

  return (
    <div className="settings-shell">
      {isLgUp ? (
        <SettingsNav groups={groups} />
      ) : (
        <PageBackLink to="/settings" label="Settings" />
      )}
      <div className="settings-content">
        <Outlet />
      </div>
    </div>
  );
}
