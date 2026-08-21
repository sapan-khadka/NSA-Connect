/**
 * Member AI Insights — presentation types only.
 * No live AI backend is connected; the UI shows an unavailable state.
 */

import type { LucideIcon } from "lucide-react";
import { UserRoundCheck } from "lucide-react";

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

/** Honest empty snapshot — do not invent engagement or dues claims. */
export const UNAVAILABLE_MEMBER_AI_INSIGHTS: MemberAiInsightsSnapshot = {
  headline: "AI insights are not available yet",
  summary:
    "This chapter pilot does not run a live insight model. Use attendance, dues, and tasks from the rest of the profile instead.",
  insights: [],
  suggestions: [],
  actions: [],
};

/** @deprecated Use UNAVAILABLE_MEMBER_AI_INSIGHTS — kept for older imports. */
export const PLACEHOLDER_MEMBER_AI_INSIGHTS = UNAVAILABLE_MEMBER_AI_INSIGHTS;

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
