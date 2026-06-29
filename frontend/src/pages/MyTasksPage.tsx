import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { MyEventTasks } from "../components/MyEventTasks";
import { useAuth } from "../context/useAuth";
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
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <span
          className={[
            "rounded-full px-3 py-1 text-sm font-semibold",
            tone === "done"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-accent/10 text-accent",
          ].join(" ")}
        >
          {signups.length}
        </span>
      </div>

      {signups.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {signups.map((signup) => (
            <li
              key={signup.id}
              className="rounded-md border border-gray-200 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-primary">{signup.task_name}</p>
                  <p className="mt-1 text-sm text-gray-600">{signup.event_name}</p>
                </div>
                <span
                  className={[
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                    signup.is_done
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800",
                  ].join(" ")}
                >
                  {signup.is_done ? "Done" : "Upcoming"}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Event date</dt>
                  <dd className="font-medium text-primary">
                    {formatEventDateTime(signup.event_starts_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Signed up</dt>
                  <dd className="font-medium text-primary">
                    {formatEventDateTime(signup.signed_up_at)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
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
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          My tasks
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          Your volunteer signups
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          See what you have signed up for and which events are already complete.
        </p>
      </section>

      <MyEventTasks />

      {loadState.status === "loading" ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
          Loading your tasks...
        </div>
      ) : null}

      {loadState.status === "error" ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800"
        >
          {loadState.message}
        </div>
      ) : null}

      {loadState.status === "ready" && signups.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-primary">
            No volunteer tasks yet
          </p>
          <p className="mt-2 text-gray-500">
            Browse events and sign up for volunteer slots when they are available.
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
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
