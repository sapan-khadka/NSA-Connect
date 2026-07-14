/**
 * Member AI Insights — presentation-only placeholder content.
 * Do not call backend AI from this module.
 */

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Award,
  CalendarOff,
  CircleDollarSign,
  Flame,
  UserRoundCheck,
} from "lucide-react";

export type MemberInsightTone =
  | "attention"
  | "risk"
  | "opportunity"
  | "positive";

export type MemberInsight = {
  id: string;
  tone: MemberInsightTone;
  title: string;
  detail: string;
  icon: LucideIcon;
};

export type MemberInsightSuggestion = {
  id: string;
  text: string;
};

export type MemberInsightAction = {
  id: string;
  label: string;
  /** Soft intent hint for styling — no API side effects. */
  intent: "primary" | "secondary";
};

export type MemberAiInsightsSnapshot = {
  headline: string;
  summary: string;
  insights: MemberInsight[];
  suggestions: MemberInsightSuggestion[];
  actions: MemberInsightAction[];
};

/** Static demo snapshot for the Member Profile AI Insights card. */
export const PLACEHOLDER_MEMBER_AI_INSIGHTS: MemberAiInsightsSnapshot = {
  headline: "Engagement needs a nudge",
  summary:
    "Recent signals suggest strong leadership potential, but attendance and dues need attention before outreach.",
  insights: [
    {
      id: "attendance-gap",
      tone: "attention",
      title: "This member hasn't attended in three events.",
      detail: "Last check-in pattern dropped after midterm week.",
      icon: CalendarOff,
    },
    {
      id: "outstanding-dues",
      tone: "attention",
      title: "Outstanding dues detected.",
      detail: "A partial or unpaid balance is still open this semester.",
      icon: CircleDollarSign,
    },
    {
      id: "leadership",
      tone: "opportunity",
      title: "Eligible for leadership.",
      detail: "Role history and reliability look ready for a committee seat.",
      icon: Award,
    },
    {
      id: "engaged",
      tone: "positive",
      title: "Highly engaged member.",
      detail: "Task completion and discussion activity stay above peer average.",
      icon: Flame,
    },
    {
      id: "inactive-risk",
      tone: "risk",
      title: "Risk of becoming inactive.",
      detail: "Quiet stretch across RSVPs may turn into a longer gap.",
      icon: AlertTriangle,
    },
  ],
  suggestions: [
    {
      id: "suggest-checkin",
      text: "Send a friendly check-in before the next cultural event.",
    },
    {
      id: "suggest-dues",
      text: "Pair the dues reminder with a clear payment option.",
    },
    {
      id: "suggest-mentor",
      text: "Invite them to shadow a current committee lead for one meeting.",
    },
  ],
  actions: [
    {
      id: "action-attendance",
      label: "Send attendance reminder",
      intent: "primary",
    },
    {
      id: "action-dues",
      label: "Follow up on dues",
      intent: "secondary",
    },
    {
      id: "action-leadership",
      label: "Nominate for committee",
      intent: "secondary",
    },
    {
      id: "action-checkin",
      label: "Schedule check-in",
      intent: "secondary",
    },
  ],
};

export function memberInsightToneLabel(tone: MemberInsightTone): string {
  switch (tone) {
    case "attention":
      return "Needs attention";
    case "risk":
      return "Risk";
    case "opportunity":
      return "Opportunity";
    case "positive":
      return "Strength";
  }
}

/** Default icon fallback for custom insight payloads. */
export const DEFAULT_MEMBER_INSIGHT_ICON: LucideIcon = UserRoundCheck;
