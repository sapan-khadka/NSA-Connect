import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { MyEventTasks } from "../components/MyEventTasks";
import { useAuth } from "../context/useAuth";
import { Card } from "../components/ui/Card";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  fetchMyVolunteerSignups,
  type MemberVolunteerSignup,
} from "../lib/volunteer-api";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; signups: MemberVolunteerSignup[] }
  | { status: "error"; message: string };

function splitSignups(signups: MemberVolunteerSignup[]) {
  const upcoming = signups.filter((signup) => !signup.is_done);
  const done = signups.filter((signup) => signup.is_done);
  return { upcoming, done };
}

type TaskListProps = {
  title: string;
  description: string;
  signups: MemberVolunteerSignup[];
  emptyMessage: string;
  tone: "upcoming" | "done";
};

function TaskList({
  title,
  description,
  signups,
  emptyMessage,
  tone,
}: TaskListProps) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-light tracking-subhead text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-label">{description}</p>
        </div>
        <span
          className={[
            "rounded-full px-3 py-1 text-sm font-semibold",
            tone === "done"
              ? "bg-mint text-primary"
              : "bg-accent/10 text-accent",
          ].join(" ")}
        >
          {signups.length}
        </span>
      </div>

      {signups.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-label">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {signups.map((signup) => (
              <Card
                key={signup.id}
                as="li"
                nested
                padding="none"
                className="rounded-md px-4 py-4"
              >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{signup.task_name}</p>
                  <p className="mt-1 text-sm text-label">{signup.event_name}</p>
                </div>
                <span
                  className={[
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                    signup.is_done
                      ? "bg-mint text-primary"
                      : "bg-surface-muted text-label",
                  ].join(" ")}
                >
                  {signup.is_done ? "Done" : "Upcoming"}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-label">Event date</dt>
                  <dd className="font-medium text-foreground">
                    {formatEventDateTime(signup.event_starts_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-label">Signed up</dt>
                  <dd className="font-medium text-foreground">
                    {formatEventDateTime(signup.signed_up_at)}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function MyTasksPage() {
  const { member } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadSignups() {
      setLoadState({ status: "loading" });

      try {
        const response = await fetchMyVolunteerSignups();
        if (!cancelled) {
          setLoadState({ status: "ready", signups: response.signups });
        }
      } catch {
        if (!cancelled) {
          setLoadState({
            status: "error",
            message: "Unable to load your volunteer tasks.",
          });
        }
      }
    }

    void loadSignups();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!member) {
    return null;
  }

  const signups = loadState.status === "ready" ? loadState.signups : [];
  const { upcoming, done } = splitSignups(signups);

  return (
    <div className="space-y-8">
      <MyEventTasks />

      {loadState.status === "loading" ? (
        <Card as="div" padding="none" className="p-10 text-center text-label">
          Loading your tasks...
        </Card>
      ) : null}

      {loadState.status === "error" ? (
        <div
          role="alert"
          className="ds-alert-banner p-6"
        >
          {loadState.message}
        </div>
      ) : null}

      {loadState.status === "ready" && signups.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-lg font-light tracking-subhead text-foreground">
            No volunteer tasks yet
          </p>
          <p className="mt-2 text-label">
            Browse events on the calendar and sign up when volunteer slots open.
          </p>
          <Link
            to="/events/calendar"
            className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Browse events
          </Link>
        </section>
      ) : null}

      {loadState.status === "ready" && signups.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <TaskList
            title="Upcoming"
            description="Volunteer tasks for events that have not happened yet."
            signups={upcoming}
            emptyMessage="No upcoming volunteer tasks."
            tone="upcoming"
          />
          <TaskList
            title="Done"
            description="Volunteer tasks for events that have already taken place."
            signups={done}
            emptyMessage="No completed volunteer tasks yet."
            tone="done"
          />
        </div>
      ) : null}
    </div>
  );
}
