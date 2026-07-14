/**
 * Member Health panel — score, factors, and coaching suggestions.
 * Presentation only; scoring is local (see lib/member-health).
 */

import { Activity, Banknote, CalendarCheck2, ListTodo } from "lucide-react";

import {
  type MemberHealthFactor,
  type MemberHealthFactorKey,
  type MemberHealthSnapshot,
  type MemberHealthSuggestion,
  computeMemberHealth,
} from "../lib/member-health";
import { AppIcon } from "./ui/AppIcon";

type MemberHealthPanelProps = {
  snapshot?: MemberHealthSnapshot;
  memberId?: number;
  role?: string;
  /** Compact embedding inside an already-titled profile section. */
  embedded?: boolean;
};

const FACTOR_ICONS: Record<MemberHealthFactorKey, typeof CalendarCheck2> = {
  attendance: CalendarCheck2,
  taskCompletion: ListTodo,
  paymentStatus: Banknote,
  recentActivity: Activity,
};

function FactorRow({ factor }: { factor: MemberHealthFactor }) {
  return (
    <div className="member-health-factor">
      <span className="member-health-factor-icon" aria-hidden="true">
        <AppIcon
          icon={FACTOR_ICONS[factor.key]}
          size="xs"
          className="text-current"
        />
      </span>
      <div className="member-health-factor-copy">
        <div className="member-health-factor-top">
          <dt className="member-health-factor-label">{factor.label}</dt>
          <dd className="member-health-factor-score tabular-nums">
            {factor.score}
          </dd>
        </div>
        <div
          className="member-health-factor-bar"
          role="progressbar"
          aria-valuenow={factor.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${factor.label} score`}
        >
          <div
            className="member-health-factor-bar-fill"
            style={{ width: `${factor.score}%` }}
          />
        </div>
        <p className="member-health-factor-detail">{factor.detail}</p>
      </div>
    </div>
  );
}

function SuggestionList({
  suggestions,
}: {
  suggestions: MemberHealthSuggestion[];
}) {
  return (
    <ul className="member-health-suggestions">
      {suggestions.map((suggestion) => (
        <li
          key={suggestion.id}
          className={`member-health-suggestion member-health-suggestion--${suggestion.tone}`}
        >
          {suggestion.text}
        </li>
      ))}
    </ul>
  );
}

export function MemberHealthPanel({
  snapshot: snapshotProp,
  memberId,
  role,
  embedded = false,
}: MemberHealthPanelProps) {
  const snapshot =
    snapshotProp ?? computeMemberHealth({ memberId, role });

  return (
    <div
      className={
        embedded ? "member-health member-health--embedded" : "member-health"
      }
      aria-label="Member health"
    >
      {!embedded ? (
        <div className="member-health-header">
          <h3 className="member-health-title">Member Health</h3>
          <p className="member-health-subtitle">
            Engagement score from attendance, tasks, dues, and activity.
          </p>
        </div>
      ) : null}

      <div className={`member-health-scorecard member-health-scorecard--${snapshot.band}`}>
        <div
          className={`member-health-score member-health-score--${snapshot.band}`}
        >
          <p className="member-health-score-label">Health Score</p>
          <p className="member-health-score-value tabular-nums">
            {snapshot.score}
          </p>
          <span
            className={`member-health-band member-health-band--${snapshot.band}`}
          >
            {snapshot.bandLabel}
          </span>
        </div>

        <dl className="member-health-factors" aria-label="Health factors">
          {snapshot.factors.map((factor) => (
            <FactorRow key={factor.key} factor={factor} />
          ))}
        </dl>
      </div>

      <div className="member-health-suggestions-block">
        <p className="member-profile-eyebrow">Suggestions</p>
        <SuggestionList suggestions={snapshot.suggestions} />
        {snapshot.usingPlaceholders ? (
          <p className="members-demo-note" role="note">
            Some factors use placeholders until attendance, dues, tasks, and
            activity are recorded.
          </p>
        ) : null}
      </div>
    </div>
  );
}
