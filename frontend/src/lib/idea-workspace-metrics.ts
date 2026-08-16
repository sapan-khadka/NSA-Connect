import {
  totalIdeaInterest,
  type EventSuggestion,
} from "./event-suggestions-api";

export const FEEDBACK_WINDOW_DAYS = 7;
export const RESPONSE_TARGET = 10;
const ATTENDANCE_SIGNAL = 5;

export function ideaWorkflowStageLabel(idea: EventSuggestion): string {
  switch (idea.status) {
    case "submitted":
      return "Submitted";
    case "internal_review":
      return "Review";
    case "published":
      return idea.community_feedback_closed_at ? "Decision" : "Feedback";
    case "approved":
      return "Approved";
    case "converted":
      return "Scheduled";
    case "rejected":
      return "Rejected";
    case "archived":
      return "Archived";
    default:
      return "Submitted";
  }
}

/** Weighted attendance intent: Definitely=1, Maybe=0.5. */
export function attendancePercent(idea: EventSuggestion): number | null {
  const total = totalIdeaInterest(idea.interest_counts);
  if (total === 0) return null;
  const score =
    idea.interest_counts.interested * 2 + idea.interest_counts.maybe;
  return Math.round((score / (total * 2)) * 100);
}

/** Share of respondents who chose Definitely. */
export function attendanceDefinitelyPercent(
  idea: EventSuggestion,
): number | null {
  const total = totalIdeaInterest(idea.interest_counts);
  if (total === 0) return null;
  return Math.round((idea.interest_counts.interested / total) * 100);
}

export function attendanceInterestLabel(idea: EventSuggestion): string {
  const definitely = attendanceDefinitelyPercent(idea);
  if (definitely == null) return "No responses";
  return `${definitely}% Definitely`;
}

export function feedbackDeadlineEndsAt(
  idea: EventSuggestion,
): Date | null {
  if (idea.community_feedback_closed_at) return null;
  if (idea.status !== "published" || !idea.published_at) return null;
  const published = Date.parse(idea.published_at);
  if (Number.isNaN(published)) return null;
  return new Date(published + FEEDBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function feedbackDeadlineRemainingDays(
  idea: EventSuggestion,
): number | null {
  const ends = feedbackDeadlineEndsAt(idea);
  if (!ends) return null;
  return Math.ceil((ends.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function feedbackDeadlineLabel(idea: EventSuggestion): string {
  if (idea.community_feedback_closed_at) return "Closed";
  if (idea.status !== "published" || !idea.published_at) return "Not open";
  const days = feedbackDeadlineRemainingDays(idea);
  if (days == null) return "Open";
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "Ends today";
  return "Past window";
}

export function feedbackEndsShortLabel(idea: EventSuggestion): string | null {
  const ends = feedbackDeadlineEndsAt(idea);
  if (!ends) return null;
  return `Ends ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(ends)}`;
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

/** Hover details for each workflow stage. */
export function buildWorkflowStepDetails(
  idea: EventSuggestion,
): Record<string, string[]> {
  const responses = totalIdeaInterest(idea.interest_counts);
  const openPolls = idea.open_poll_count ?? 0;
  const totalPolls = idea.poll_count ?? 0;
  const opened = formatShortDate(idea.published_at);
  const ends = feedbackDeadlineEndsAt(idea);
  const endsLabel = ends
    ? `Closes ${new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(ends)}`
    : null;
  const closed = formatShortDate(idea.community_feedback_closed_at);
  const submitted = formatShortDate(idea.created_at);
  const noted = formatShortDate(idea.noted_at);

  return {
    submitted: [
      submitted ? `Submitted ${submitted}` : "Idea submitted",
      `Suggested by ${idea.suggested_by.full_name}`,
    ],
    internal_review: [
      noted ? `Started ${noted}` : "Not started",
      "Private to officers",
    ],
    community_feedback: [
      opened ? `Opened ${opened}` : "Not opened yet",
      ...(endsLabel && !idea.community_feedback_closed_at ? [endsLabel] : []),
      ...(closed ? [`Closed ${closed}`] : []),
      `${responses} ${responses === 1 ? "response" : "responses"}`,
      totalPolls > 0
        ? `${openPolls} active ${openPolls === 1 ? "poll" : "polls"}`
        : "No polls yet",
    ],
    decision: [
      idea.community_feedback_closed_at
        ? "Feedback closed. Ready to decide"
        : "Waiting for feedback to close",
      `${responses} community ${responses === 1 ? "response" : "responses"}`,
    ],
    approved: [
      noted && idea.status === "approved" ? `Approved ${noted}` : "Not approved yet",
    ],
    event: [
      idea.converted_event_id
        ? "Converted to an event"
        : "Not scheduled yet",
    ],
  };
}

export type DecisionReadinessStatus =
  | "idle"
  | "waiting"
  | "ready"
  | "low"
  | "decided";

export type DecisionReadinessCheck = {
  id: string;
  label: string;
  done: boolean;
};

export type DecisionReadiness = {
  status: DecisionReadinessStatus;
  readyQuestion: string;
  readyAnswer: string;
  overallLabel: string;
  confidence: "low" | "moderate" | "high" | null;
  checks: DecisionReadinessCheck[];
  reasons: string[];
  reasonsLabel: "Why?" | "Reason" | null;
  recommendationLabel: string | null;
  recommendation: string | null;
};

export function ideaTimelineNowLabel(idea: EventSuggestion): string {
  switch (idea.status) {
    case "submitted":
      return "Waiting on board review";
    case "internal_review":
      return "In review. Not yet published";
    case "published":
      return idea.community_feedback_closed_at
        ? "Waiting on board decision"
        : "Collecting community feedback";
    case "approved":
      return "Approved. Ready to schedule";
    case "converted":
      return "Scheduled as an event";
    case "rejected":
      return "Idea rejected";
    case "archived":
      return "Idea archived";
    default:
      return "In progress";
  }
}

function participationFraction(idea: EventSuggestion): {
  responses: number;
  eligible: number;
  rate: number | null;
} {
  const responses = totalIdeaInterest(idea.interest_counts);
  const eligible = idea.eligible_member_count ?? 0;
  return {
    responses,
    eligible,
    rate: eligible > 0 ? responses / eligible : null,
  };
}

function participationReason(idea: EventSuggestion): string {
  const { responses, eligible } = participationFraction(idea);
  if (eligible > 0) {
    if (responses === 0) return `Only 0 of ${eligible} members have responded.`;
    if (responses === 1) return `Only 1 of ${eligible} members has responded.`;
    return `Only ${responses} of ${eligible} members have responded.`;
  }
  if (responses === 0) return "No members have responded yet.";
  if (responses === 1) return "Only 1 member has responded.";
  return `Only ${responses} members have responded.`;
}

function isStrongParticipation(idea: EventSuggestion): boolean {
  const { responses, rate } = participationFraction(idea);
  return responses >= RESPONSE_TARGET || (rate != null && rate >= 0.25);
}

export function buildDecisionReadinessChecks(
  idea: EventSuggestion,
): DecisionReadinessCheck[] {
  const responses = totalIdeaInterest(idea.interest_counts);
  const polls = idea.poll_count ?? 0;
  const feedbackClosed = idea.community_feedback_closed_at != null;
  const remainingDays = feedbackDeadlineRemainingDays(idea);
  const published =
    idea.status === "published" ||
    feedbackClosed ||
    idea.status === "approved" ||
    idea.status === "converted" ||
    idea.status === "rejected";
  const feedbackActive = idea.status === "published" && !feedbackClosed;
  const periodComplete =
    feedbackClosed || (remainingDays != null && remainingDays <= 0);

  return [
    {
      id: "attendance",
      label: "Attendance interest enabled",
      done: published && idea.community_interest_enabled !== false,
    },
    {
      id: "feedback_window",
      label: "Feedback window active",
      done: feedbackActive || periodComplete,
    },
    {
      id: "polls",
      label: "Polls published",
      done: polls > 0,
    },
    {
      id: "responses",
      label: `Minimum responses reached (${RESPONSE_TARGET})`,
      done: responses >= RESPONSE_TARGET,
    },
    {
      id: "period",
      label: "Feedback period completed",
      done: periodComplete,
    },
  ];
}

export function getDecisionReadiness(idea: EventSuggestion): DecisionReadiness {
  const readyQuestion = "Ready for Board Decision?";
  const checks = buildDecisionReadinessChecks(idea);

  if (idea.status === "submitted" || idea.status === "internal_review") {
    return {
      status: "idle",
      readyQuestion,
      readyAnswer: "Not yet",
      overallLabel: "Not ready",
      confidence: "low",
      checks,
      reasons: ["Community feedback is not open yet."],
      reasonsLabel: "Reason",
      recommendationLabel: "Recommendation",
      recommendation: "Publish for community feedback when the board is ready.",
    };
  }

  if (idea.status === "approved") {
    return {
      status: "decided",
      readyQuestion,
      readyAnswer: "Yes",
      overallLabel: "Approved",
      confidence: "high",
      checks: checks.map((check) => ({ ...check, done: true })),
      reasons: [],
      reasonsLabel: null,
      recommendationLabel: "Recommendation",
      recommendation: "Schedule this idea as an event when logistics are ready.",
    };
  }

  if (idea.status === "converted") {
    return {
      status: "decided",
      readyQuestion,
      readyAnswer: "Yes",
      overallLabel: "Scheduled",
      confidence: "high",
      checks: checks.map((check) => ({ ...check, done: true })),
      reasons: [],
      reasonsLabel: null,
      recommendationLabel: null,
      recommendation: null,
    };
  }

  if (idea.status === "rejected" || idea.status === "archived") {
    return {
      status: "decided",
      readyQuestion,
      readyAnswer: idea.status === "rejected" ? "Rejected" : "Archived",
      overallLabel: idea.status === "rejected" ? "Rejected" : "Archived",
      confidence: null,
      checks,
      reasons: [],
      reasonsLabel: null,
      recommendationLabel: null,
      recommendation: null,
    };
  }

  const responses = totalIdeaInterest(idea.interest_counts);
  const definitely = attendanceDefinitelyPercent(idea);
  const polls = idea.poll_count ?? 0;
  const openPolls = idea.open_poll_count ?? 0;
  const feedbackClosed = idea.community_feedback_closed_at != null;
  const remainingDays = feedbackDeadlineRemainingDays(idea);
  const deadlineReached =
    feedbackClosed || (remainingDays != null && remainingDays <= 0);
  const pollsDone = feedbackClosed || polls === 0 || openPolls === 0;
  const lowParticipation = responses < RESPONSE_TARGET;
  const strong = isStrongParticipation(idea);
  const allChecksDone = checks.every((check) => check.done);
  const overallFromChecks = allChecksDone ? "Ready" : "Not ready";

  if ((feedbackClosed || deadlineReached) && lowParticipation) {
    return {
      status: "low",
      readyQuestion,
      readyAnswer: "Decide carefully",
      overallLabel: "Limited signal",
      confidence: "low",
      checks,
      reasons: [
        participationReason(idea),
        ...(openPolls > 0
          ? [
              `${openPolls === 1 ? "One poll remains" : `${openPolls} polls remain`} open.`,
            ]
          : []),
        ...(polls > 0 && idea.poll_vote_count === 0
          ? ["Scheduling polls have no responses yet."]
          : []),
      ],
      reasonsLabel: "Reason",
      recommendationLabel: "Recommendation",
      recommendation:
        "Reopen feedback for more signal, or decide with limited community input.",
    };
  }

  if (allChecksDone || feedbackClosed || (strong && pollsDone)) {
    const why: string[] = [];
    const { responses: count, eligible } = participationFraction(idea);
    if (eligible > 0) {
      why.push(`${count} of ${eligible} members responded.`);
    } else {
      why.push(
        `${count} ${count === 1 ? "member has" : "members have"} responded.`,
      );
    }
    if (definitely != null && definitely >= 60) {
      why.push(`${definitely}% selected Definitely.`);
    } else if (definitely != null) {
      why.push(`Attendance interest is ${definitely}% Definitely.`);
    }
    if (polls > 0 && pollsDone) {
      why.push("Polls are complete.");
    }
    if (feedbackClosed) {
      why.push("Feedback is closed.");
    }

    return {
      status: "ready",
      readyQuestion,
      readyAnswer: "Yes",
      overallLabel: allChecksDone ? "Ready" : "Ready enough",
      confidence: "high",
      checks,
      reasons: why,
      reasonsLabel: "Reason",
      recommendationLabel: "Recommendation",
      recommendation: feedbackClosed
        ? "Proceed to Board Decision. Approve or reject this idea."
        : "Close feedback and move to Board Decision.",
    };
  }

  const why: string[] = [];
  if (responses < RESPONSE_TARGET) {
    why.push(participationReason(idea));
  }
  if (openPolls > 0 && (idea.poll_vote_count ?? 0) === 0) {
    why.push("Scheduling poll has no responses.");
  } else if (openPolls > 0) {
    why.push(
      openPolls === 1
        ? "One poll remains open."
        : `${openPolls} polls remain open.`,
    );
  }
  if (remainingDays != null && remainingDays > 0) {
    why.push(
      remainingDays === 1
        ? "Feedback closes in 1 day."
        : `Feedback closes in ${remainingDays} days.`,
    );
  }

  const confidence =
    responses >= RESPONSE_TARGET / 2 || (idea.poll_vote_count ?? 0) > 0
      ? "moderate"
      : "low";

  return {
    status: "waiting",
    readyQuestion,
    readyAnswer: "Not yet",
    overallLabel: overallFromChecks,
    confidence,
    checks,
    reasons: why,
    reasonsLabel: "Reason",
    recommendationLabel: "Recommendation",
    recommendation: "Continue collecting feedback.",
  };
}

export { ATTENDANCE_SIGNAL };
