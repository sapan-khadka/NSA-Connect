import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ClipboardList,
  Megaphone,
  Sparkles,
  UserPlus,
  Wallet,
} from "lucide-react";

export type NotificationVisual = {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  chipClass: string;
};

const DEFAULT_VISUAL: NotificationVisual = {
  label: "Update",
  icon: Sparkles,
  iconClass: "text-primary",
  chipClass: "bg-badge-teal-bg",
};

const BY_TYPE: Record<string, NotificationVisual> = {
  announcement: {
    label: "Announcement",
    icon: Megaphone,
    iconClass: "text-primary",
    chipClass: "bg-badge-teal-bg",
  },
  task_assigned: {
    label: "Task",
    icon: ClipboardList,
    iconClass: "text-accent",
    chipClass: "bg-accent/10",
  },
  task_due_reminder: {
    label: "Task due",
    icon: ClipboardList,
    iconClass: "text-overdue",
    chipClass: "bg-overdue-surface",
  },
  finance_change_pending: {
    label: "Budget",
    icon: Wallet,
    iconClass: "text-primary",
    chipClass: "bg-badge-teal-bg",
  },
  finance_change_resolved: {
    label: "Budget",
    icon: Wallet,
    iconClass: "text-primary",
    chipClass: "bg-badge-teal-bg",
  },
  member_pending: {
    label: "Members",
    icon: UserPlus,
    iconClass: "text-primary",
    chipClass: "bg-badge-teal-bg",
  },
  member_approved: {
    label: "Welcome",
    icon: CheckCircle2,
    iconClass: "text-primary",
    chipClass: "bg-badge-teal-bg",
  },
  suggestion_submitted: {
    label: "Suggestion",
    icon: Sparkles,
    iconClass: "text-accent",
    chipClass: "bg-accent/10",
  },
  suggestion_noted: {
    label: "Suggestion",
    icon: CheckCircle2,
    iconClass: "text-primary",
    chipClass: "bg-badge-teal-bg",
  },
};

export function getNotificationVisual(type: string | undefined): NotificationVisual {
  if (!type) {
    return DEFAULT_VISUAL;
  }
  return BY_TYPE[type] ?? DEFAULT_VISUAL;
}
