import type { IdeaPoll } from "./event-suggestion-polish-api";
import {
  totalIdeaInterest,
  type EventSuggestion,
  type IdeaInterestCounts,
} from "./event-suggestions-api";

export type IdeaCommunityInsight = {
  responseCount: number;
  insights: string[];
  source: "rules" | "ai";
  commentCount: number;
};

const CONCERN_HINTS = [
  "avoid",
  "concern",
  "final",
  "conflict",
  "issue",
  "worry",
  "don't",
  "dont",
  "cannot",
  "can't",
  "too late",
  "busy",
];

function wouldAttendPercent(counts: IdeaInterestCounts): number | null {
  const total = totalIdeaInterest(counts);
  if (total === 0) return null;
  return Math.round(((counts.interested + counts.maybe) / total) * 100);
}

function definitelyPercent(counts: IdeaInterestCounts): number | null {
  const total = totalIdeaInterest(counts);
  if (total === 0) return null;
  return Math.round((counts.interested / total) * 100);
}

function notInterestedPercent(counts: IdeaInterestCounts): number | null {
  const total = totalIdeaInterest(counts);
  if (total === 0) return null;
  return Math.round((counts.not_interested / total) * 100);
}

function preferenceKind(
  question: string,
): "semester" | "transport" | "timing" | "budget" | "volunteer" | "other" {
  const q = question.toLowerCase();
  if (q.includes("semester")) return "semester";
  if (q.includes("transport")) return "transport";
  if (
    q.includes("date") ||
    q.includes("day") ||
    q.includes("when") ||
    q.includes("time")
  ) {
    return "timing";
  }
  if (q.includes("budget") || q.includes("contribution")) return "budget";
  if (q.includes("volunteer")) return "volunteer";
  return "other";
}

function winningOption(poll: IdeaPoll): {
  label: string;
  share: number;
  tied: boolean;
} | null {
  if (poll.total_votes === 0 || poll.options.length === 0) return null;
  const maxVotes = Math.max(...poll.options.map((option) => option.vote_count));
  const leaders = poll.options.filter(
    (option) => option.vote_count === maxVotes,
  );
  const share = Math.round((maxVotes / poll.total_votes) * 100);
  if (leaders.length > 1) {
    return {
      label: leaders.map((option) => option.label).join(" / "),
      share,
      tied: true,
    };
  }
  return { label: leaders[0].label, share, tied: false };
}

function pollPreferenceLine(poll: IdeaPoll): string | null {
  const winner = winningOption(poll);
  const kind = preferenceKind(poll.question);

  if (!winner) {
    if (kind === "timing") return "Timing preference is still unclear.";
    if (kind === "transport") {
      return "Transportation preference is still unclear.";
    }
    if (kind === "semester") return "Semester preference is still unclear.";
    return null;
  }

  if (winner.tied || winner.share < 45) {
    if (kind === "timing") return "Members seem flexible about timing.";
    if (kind === "transport") {
      return "Transportation preference is still unclear.";
    }
    if (kind === "semester") return "Members seem flexible about semester.";
    return `Preference is still unclear for ${poll.question.replace(/\?+$/, "")}.`;
  }

  if (kind === "timing") return `${winner.label} is the preferred time.`;
  if (kind === "transport") return `Many members requested ${winner.label}.`;
  if (kind === "semester") return `${winner.label} is the preferred semester.`;
  if (kind === "budget") return `Preferred budget option is ${winner.label}.`;
  if (kind === "volunteer") {
    return `Volunteer interest leans toward ${winner.label}.`;
  }
  return `Members prefer ${winner.label}.`;
}

function truncateConcern(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function concernInsight(comments: string[]): string | null {
  for (const comment of comments) {
    const lower = comment.toLowerCase();
    if (CONCERN_HINTS.some((hint) => lower.includes(hint))) {
      return `One concern mentioned: ${truncateConcern(comment)}`;
    }
  }
  return null;
}

/** Local fallback when the insight API is unavailable. */
export function buildIdeaCommunityInsight(
  idea: EventSuggestion,
  polls: IdeaPoll[],
  comments: string[] = [],
): IdeaCommunityInsight {
  const counts = idea.interest_counts;
  const responses = totalIdeaInterest(counts);
  const attend = wouldAttendPercent(counts);
  const definitely = definitelyPercent(counts);
  const opposed = notInterestedPercent(counts);
  const openPolls = polls.filter((poll) => poll.is_open).length;
  const votedPolls = polls.filter((poll) => poll.total_votes > 0);
  const unvotedOpen = polls.filter(
    (poll) => poll.is_open && poll.total_votes === 0,
  );

  const insights: string[] = [];

  if (responses === 0) {
    insights.push("Waiting for community responses.");
    if (openPolls > 0) {
      insights.push("Scheduling preferences are not clear yet.");
    }
    return {
      responseCount: 0,
      insights,
      source: "rules",
      commentCount: comments.length || idea.community_comment_count || 0,
    };
  }

  if (responses < 5) {
    insights.push("Early feedback is still limited.");
  }

  if (attend != null && definitely != null && responses >= 5) {
    if (attend >= 80 && definitely >= 60) {
      insights.push("Most respondents support the event.");
    } else if (attend >= 65) {
      insights.push("Members show solid interest in attending.");
    } else if (attend >= 45) {
      insights.push("Attendance interest is mixed so far.");
    } else {
      insights.push("Attendance interest is weak so far.");
    }
  } else if (attend != null && responses >= 1 && attend >= 80) {
    insights.push("Early respondents support the event.");
  }

  const preferenceLines = [...votedPolls, ...unvotedOpen]
    .map((poll) => pollPreferenceLine(poll))
    .filter((line): line is string => line != null);
  // Prefer unique preference narratives
  const seenPrefs = new Set<string>();
  for (const line of preferenceLines) {
    if (!seenPrefs.has(line)) {
      seenPrefs.add(line);
      insights.push(line);
    }
    if (seenPrefs.size >= 3) break;
  }

  if (openPolls > 0 && votedPolls.length === 0 && preferenceLines.length === 0) {
    insights.push("No scheduling preference yet.");
  }

  const concern = concernInsight(comments);
  if (concern) {
    insights.push(concern);
  } else if (opposed != null) {
    if (opposed >= 30) {
      insights.push("Some members indicated they would not attend.");
    } else if (opposed < 15 && responses >= 3) {
      insights.push("No significant concerns were raised.");
    }
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of insights) {
    if (!seen.has(line)) {
      seen.add(line);
      unique.push(line);
    }
  }

  return {
    responseCount: responses,
    insights: unique.slice(0, 6),
    source: "rules",
    commentCount: comments.length || idea.community_comment_count || 0,
  };
}
