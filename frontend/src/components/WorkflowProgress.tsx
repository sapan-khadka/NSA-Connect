import { cx } from "../design-system/cx";

export type WorkflowStep = {
  id: string;
  label: string;
  /** Optional count/meta shown beside the label (e.g. Feedback · 18). */
  badge?: string | number | null;
  /** Hover / focus details for this stage. */
  detailLines?: string[];
};

export type WorkflowProgressProps = {
  steps: WorkflowStep[];
  /** Zero-based index of the current step. */
  currentIndex: number;
  /** Override label for the active step (e.g. Rejected). */
  currentLabel?: string;
  /** Treat the current step as a halted / failed state. */
  halted?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Responsive step progress for workspace pages.
 * Narrow screens: compact dots + current step.
 * Wide screens: full labeled track with connectors.
 */
export function WorkflowProgress({
  steps,
  currentIndex,
  currentLabel,
  halted = false,
  className = "",
  "aria-label": ariaLabel = "Progress",
}: WorkflowProgressProps) {
  const clamped = Math.max(0, Math.min(currentIndex, steps.length - 1));
  const activeStep = steps[clamped];
  const activeLabel =
    currentLabel?.trim() || activeStep?.label || "In progress";
  const activeBadge =
    activeStep?.badge != null &&
    activeStep.badge !== "" &&
    !(typeof activeStep.badge === "number" && activeStep.badge <= 0)
      ? activeStep.badge
      : null;

  return (
    <div className={cx("workflow-progress", className)}>
      <div className="workflow-progress__compact">
        <ol className="workflow-progress__dots" aria-label={ariaLabel}>
          {steps.map((step, index) => {
            const done = index < clamped;
            const active = index === clamped;
            const state = done
              ? "is-done"
              : active
                ? halted
                  ? "is-halted"
                  : "is-active"
                : "is-pending";
            return (
              <li
                key={step.id}
                className={cx("workflow-progress__dot-item", state)}
              >
                {index > 0 ? (
                  <span
                    className={cx(
                      "workflow-progress__dot-connector",
                      done || active ? "is-filled" : "",
                    )}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className="workflow-progress__dot"
                  title={step.label}
                  aria-label={step.label}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? "✓" : ""}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="workflow-progress__current">
          <span className="workflow-progress__current-label">
            {activeLabel}
            {activeBadge != null ? (
              <span className="workflow-progress__badge">{activeBadge}</span>
            ) : null}
          </span>
          <span className="workflow-progress__current-meta">
            Step {clamped + 1} of {steps.length}
          </span>
        </p>
      </div>

      <ol className="workflow-progress__track" aria-label={ariaLabel}>
        {steps.map((step, index) => {
          const done = index < clamped;
          const active = index === clamped;
          const label = active && currentLabel ? currentLabel : step.label;
          const state = done
            ? "is-done"
            : active
              ? halted
                ? "is-halted"
                : "is-active"
              : "is-pending";
          const showBadge =
            step.badge != null &&
            step.badge !== "" &&
            !(typeof step.badge === "number" && step.badge <= 0);
          const details = step.detailLines?.filter(Boolean) ?? [];

          return (
            <li key={step.id} className={cx("workflow-progress__item", state)}>
              {index > 0 ? (
                <span
                  className={cx(
                    "workflow-progress__connector",
                    done || active ? "is-filled" : "",
                  )}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className="workflow-progress__step"
                tabIndex={details.length > 0 ? 0 : undefined}
              >
                <span className="workflow-progress__dot" aria-hidden="true">
                  {done
                    ? "✓"
                    : active && !halted
                      ? "●"
                      : halted && active
                        ? "!"
                        : ""}
                </span>
                <span className="workflow-progress__label">
                  {label}
                  {showBadge ? (
                    <span className="workflow-progress__badge">{step.badge}</span>
                  ) : null}
                </span>
                {details.length > 0 ? (
                  <span className="workflow-progress__tip" role="tooltip">
                    <span className="workflow-progress__tip-title">{label}</span>
                    {details.map((line) => (
                      <span key={line} className="workflow-progress__tip-line">
                        {line}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
