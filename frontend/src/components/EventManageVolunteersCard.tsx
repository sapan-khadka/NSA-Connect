import type { EventVolunteerSignupMember } from "../lib/events-api";
import {
  EVENT_MANAGE_ACTION_LINK,
  EVENT_MANAGE_CARD_CLASS,
  EVENT_MANAGE_EMPTY,
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_LOADING,
  EVENT_MANAGE_PRIMARY_BTN_FLEX,
  EVENT_MANAGE_SECONDARY_BTN_FLEX,
} from "../lib/event-manage-ui";
import {
  filledNeededRoles,
  inferVolunteerRole,
  NEEDED_VOLUNTEER_ROLES,
  volunteerInitials,
} from "../lib/event-volunteer-summary";
import { HomeCard } from "./ui/HomeCard";

type EventManageVolunteersCardProps = {
  volunteers: EventVolunteerSignupMember[];
  isLoading: boolean;
  onInvite: () => void;
  onAssignRoles: () => void;
  onViewAll: () => void;
};

export function EventManageVolunteersCard({
  volunteers,
  isLoading,
  onInvite,
  onAssignRoles,
  onViewAll,
}: EventManageVolunteersCardProps) {
  const filled = filledNeededRoles(volunteers);
  const preview = volunteers.slice(0, 4);
  const countLabel =
    volunteers.length === 1 ? "1 volunteer" : `${volunteers.length} volunteers`;

  return (
    <HomeCard
      padding="sm"
      className={EVENT_MANAGE_CARD_CLASS}
      aria-label="Volunteers"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="home-section-title">Volunteers</h2>
        {!isLoading && volunteers.length > 0 ? (
          <button
            type="button"
            onClick={onViewAll}
            className={EVENT_MANAGE_ACTION_LINK}
          >
            View all
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className={`mt-3 ${EVENT_MANAGE_LOADING}`}>Loading volunteers…</p>
      ) : (
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={EVENT_MANAGE_EYEBROW}>Volunteer count</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {volunteers.length}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{countLabel}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className={EVENT_MANAGE_EYEBROW}>Needed roles</p>
            <ul className="mt-2.5 space-y-1.5">
              {NEEDED_VOLUNTEER_ROLES.map((role) => {
                const isFilled = filled.has(role);
                return (
                  <li
                    key={role}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{role}</span>
                    <span
                      className={
                        isFilled
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                          : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                      }
                    >
                      {isFilled ? "Filled" : "Open"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {volunteers.length === 0 ? (
            <div className={`mt-4 flex flex-1 flex-col ${EVENT_MANAGE_EMPTY}`}>
              <p className="text-sm font-medium text-foreground">
                No volunteers yet
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Invite members to help with setup, registration, photography, and
                cleanup so roles are covered before the event.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {preview.map((signup) => {
                const role = inferVolunteerRole(signup.note);
                return (
                  <li
                    key={signup.id}
                    className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-2.5 py-2"
                  >
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-badge-teal-bg text-[11px] font-semibold text-primary"
                      aria-hidden="true"
                    >
                      {volunteerInitials(signup.full_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {signup.full_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {role}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Signed up
                    </span>
                  </li>
                );
              })}
              {volunteers.length > preview.length ? (
                <li className="text-xs text-gray-500">
                  +{volunteers.length - preview.length} more
                </li>
              ) : null}
            </ul>
          )}

          <div className="mt-auto flex gap-2 pt-4">
            <button
              type="button"
              onClick={onInvite}
              className={EVENT_MANAGE_PRIMARY_BTN_FLEX}
            >
              Invite Volunteers
            </button>
            <button
              type="button"
              onClick={onAssignRoles}
              className={EVENT_MANAGE_SECONDARY_BTN_FLEX}
            >
              Assign Roles
            </button>
          </div>
        </div>
      )}
    </HomeCard>
  );
}
