import type { LucideIcon } from "lucide-react";
import {
  Award,
  CalendarDays,
  CircleDollarSign,
  Crown,
  Feather,
  Megaphone,
  Sparkles,
  User,
  Users,
} from "lucide-react";

import type { MemberPosition, MemberRole } from "./roles";
import { isExclusiveMemberPosition } from "./roles";

export const POSITION_BADGE_ICONS: Record<
  Exclude<MemberPosition, "member">,
  LucideIcon
> = {
  president: Crown,
  vice_president: Award,
  secretary: Feather,
  treasurer: CircleDollarSign,
  event_manager: CalendarDays,
  public_relations_officer: Megaphone,
  new_student_representative: Sparkles,
};

export const ROLE_BADGE_ICONS: Record<MemberRole, LucideIcon> = {
  president: Crown,
  treasurer: CircleDollarSign,
  board: Users,
  general: User,
};

export function getPositionBadgeIcon(
  position: MemberPosition,
): LucideIcon | null {
  if (!isExclusiveMemberPosition(position)) {
    return null;
  }

  return POSITION_BADGE_ICONS[position];
}

export function getRoleBadgeIcon(role: MemberRole): LucideIcon {
  return ROLE_BADGE_ICONS[role];
}
