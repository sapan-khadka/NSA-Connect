import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarItem,
  SidebarSection,
  SidebarSubItem,
} from "../design-system/components/navigation";
import { useAuth } from "../context/useAuth";
import { useLogout } from "../context/useLogout";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
  canViewMemberDirectory,
  formatRoleLabel,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";
import { AppLogo } from "./AppLogo";

type AppSidebarProps = {
  onNavigate?: () => void;
};

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavIcon({ icon }: { icon: typeof LayoutDashboard }) {
  return <AppIcon icon={icon} size="sm" className="text-current" />;
}

/**
 * CampusOS app sidebar: fixed 240px shell, sectioned nav, help + profile footer.
 * Role gates and board tools are preserved; Documents/Inventory stay visible but disabled until routes exist.
 */
export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { member } = useAuth();
  const logout = useLogout();
  const location = useLocation();

  const showMembers = member ? canBrowseMemberDirectory(member.role) : false;
  const showFinance = member ? canAccessFinance(member.role) : false;
  const showBoardTools = member ? canViewMemberDirectory(member.role) : false;

  const boardItems = [
    { label: "Board discussion", to: "/board/discussion" },
    { label: "Meeting minutes", to: "/board/meeting-minutes" },
    { label: "Announcement email", to: "/board/announcement-email" },
  ];

  const boardActive = boardItems.some((item) =>
    location.pathname.startsWith(item.to),
  );
  const [boardOpen, setBoardOpen] = useState(boardActive);

  useEffect(() => {
    if (boardActive) {
      setBoardOpen(true);
    }
  }, [boardActive]);

  const roleLabel = member ? formatRoleLabel(member.role) : "";

  const footer: ReactNode = (
    <div className="space-y-3">
      <div className="ds-help-card">
        <div className="flex items-start gap-2.5">
          <span className="ds-icon-btn mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white text-primary shadow-sm">
            <AppIcon icon={Sparkles} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Need help?</p>
            <p className="mt-0.5 text-xs leading-snug text-label">
              Ask the assistant about events, dues, and member tools.
            </p>
          </div>
        </div>
        <Link
          to="/assistant"
          onClick={onNavigate}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition duration-200 hover:bg-primary hover:text-white"
        >
          Ask Assistant
          <AppIcon icon={ChevronRight} size="xs" className="text-current" />
        </Link>
      </div>

      {member ? (
        <div className="space-y-1">
          <Link
            to="/profile"
            onClick={onNavigate}
            aria-label={`User profile for ${member.full_name}`}
            className="flex w-full items-center gap-3 rounded-card px-2 py-2 text-left transition-all duration-200 hover:translate-x-0.5 hover:bg-surface-muted"
          >
            <span className="ds-icon-btn h-9 w-9 shrink-0 rounded-full bg-badge-teal-bg text-xs font-semibold text-badge-teal">
              {getInitials(member.full_name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {member.full_name.split(/\s+/)[0] ?? member.full_name}
              </span>
              <span className="block truncate text-xs text-label">
                {roleLabel}
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              logout();
            }}
            className="ds-icon-label w-full gap-2.5 rounded-card px-2.5 py-2 text-sm font-medium text-label transition-all duration-200 hover:translate-x-0.5 hover:bg-overdue-surface hover:text-overdue"
          >
            <AppIcon icon={LogOut} size="sm" className="text-current" />
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <Sidebar header={<AppLogo asLink size="nav" showTagline={false} />} footer={footer}>
      <div className="space-y-4">
        <SidebarSection title="Main">
          <SidebarItem
            label="Dashboard"
            to="/"
            end
            icon={<NavIcon icon={LayoutDashboard} />}
            onClick={onNavigate}
          />
          {showMembers ? (
            <SidebarItem
              label="Members"
              to="/members"
              icon={<NavIcon icon={Users} />}
              onClick={onNavigate}
            />
          ) : null}
          <SidebarItem
            label="Events"
            to="/events/calendar"
            icon={<NavIcon icon={CalendarDays} />}
            onClick={onNavigate}
          />
          {showFinance ? (
            <SidebarItem
              label="Finance"
              to="/finance"
              icon={<NavIcon icon={Wallet} />}
              onClick={onNavigate}
            />
          ) : null}
        </SidebarSection>

        <SidebarSection title="Management">
          <SidebarItem
            label="Announcements"
            to="/announcements"
            icon={<NavIcon icon={Megaphone} />}
            onClick={onNavigate}
          />
          <SidebarItem
            label="Documents"
            icon={<NavIcon icon={FileText} />}
            disabled
          />
          <SidebarItem
            label="Inventory"
            icon={<NavIcon icon={Package} />}
            disabled
          />
          <SidebarItem
            label="Reports"
            to="/reports"
            icon={<NavIcon icon={ClipboardList} />}
            onClick={onNavigate}
          />

          {showBoardTools ? (
            <li>
              <button
                type="button"
                aria-expanded={boardOpen}
                onClick={() => setBoardOpen((current) => !current)}
                className={[
                  "group relative ds-icon-label w-full gap-2.5 rounded-card px-2.5 py-2 text-sm font-medium transition-all duration-200 ease-out",
                  "hover:translate-x-0.5 hover:bg-surface-muted",
                  boardActive && !boardOpen
                    ? "bg-badge-teal-bg font-semibold text-primary"
                    : "text-foreground",
                ].join(" ")}
              >
                <span className="shrink-0 text-label group-hover:text-primary">
                  <NavIcon icon={MessageSquare} />
                </span>
                <span className="min-w-0 flex-1 truncate text-left">
                  Board tools
                </span>
                <AppIcon
                  icon={ChevronDown}
                  size="xs"
                  className={[
                    "text-label transition-transform duration-200",
                    boardOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              <div
                className={[
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  boardOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                ].join(" ")}
              >
                <ul className="mt-1 space-y-0.5 overflow-hidden border-l border-gray-200 ml-5 pl-2">
                  {boardItems.map((item) => (
                    <SidebarSubItem
                      key={item.to}
                      label={item.label}
                      to={item.to}
                      onClick={onNavigate}
                    />
                  ))}
                </ul>
              </div>
            </li>
          ) : null}
        </SidebarSection>

        <SidebarSection title="Tools">
          <SidebarItem
            label="AI Assistant"
            to="/assistant"
            icon={<NavIcon icon={Sparkles} />}
            onClick={onNavigate}
          />
        </SidebarSection>

        <SidebarSection title="System">
          <SidebarItem
            label="Settings"
            to="/profile"
            icon={<NavIcon icon={Settings} />}
            onClick={onNavigate}
          />
        </SidebarSection>
      </div>
    </Sidebar>
  );
}
