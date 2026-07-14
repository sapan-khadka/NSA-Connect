/**
 * Member AI Insights — presentation-only placeholder content.
 * Do not call backend AI from this module.
 */

import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
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

/**
 * Static demo snapshot for the Member Profile AI Insights card.
 * Copy matches product examples — placeholder UX only.
 */
export const PLACEHOLDER_MEMBER_AI_INSIGHTS: MemberAiInsightsSnapshot = {
  headline: "Balanced signals with clear next steps",
  summary:
    "Placeholder insights combine engagement strengths with attendance and dues follow-ups. No live AI model is connected yet.",
  insights: [
    {
      id: "missed-events",
      tone: "attention",
      title: "Member has missed four events.",
      detail: "Recent RSVP pattern shows a widening attendance gap.",
      icon: CalendarOff,
    },
    {
      id: "highly-engaged",
      tone: "positive",
      title: "Member is highly engaged.",
      detail: "Tasks and event interest remain stronger than peer average.",
      icon: Flame,
    },
    {
      id: "leadership",
      tone: "opportunity",
      title: "Recommend leadership role.",
      detail: "Reliability signals look ready for a committee or board seat.",
      icon: Award,
    },
    {
      id: "outstanding-dues",
      tone: "risk",
      title: "Outstanding dues.",
      detail: "An unpaid or partial balance is still open this semester.",
      icon: CircleDollarSign,
    },
    {
      id: "send-reminder",
      tone: "attention",
      title: "Recommend sending reminder.",
      detail: "A short check-in could recover attendance before the next event.",
      icon: Bell,
    },
  ],
  suggestions: [
    {
      id: "suggest-reminder",
      text: "Recommend sending reminder before the next cultural night.",
    },
    {
      id: "suggest-dues",
      text: "Pair outstanding dues outreach with a clear payment path.",
    },
    {
      id: "suggest-leadership",
      text: "Invite this member to shadow a current committee lead.",
    },
  ],
  actions: [
    {
      id: "action-reminder",
      label: "Send reminder",
      intent: "primary",
    },
    {
      id: "action-dues",
      label: "Follow up on dues",
      intent: "secondary",
    },
    {
      id: "action-leadership",
      label: "Recommend leadership",
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
