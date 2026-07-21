import { Calendar, MapPin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AppIcon } from "../components/ui/AppIcon";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { eventDetailPath } from "../lib/event-links";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { formatCountdownBadge, formatEventDateTime } from "../lib/format-datetime";
import {
  fetchPublicEvent,
  type PublicEventResponse,
} from "../lib/public-events-api";

const primaryCtaClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover";
const secondaryCtaClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-badge-teal-bg px-4 py-2 text-sm font-medium text-primary transition hover:bg-badge-teal-bg/80";

export function PublicEventPage() {
  const { eventId } = useParams();
  const numericEventId = Number(eventId);
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState<PublicEventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(numericEventId)) {
      setError("Invalid event link.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchPublicEvent(numericEventId)
      .then((response) => {
        if (!cancelled) {
          setEvent(response);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
          setEvent(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [numericEventId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-gray-500">Loading event…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card padding="md" className="space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Event unavailable
          </h1>
          <p className="text-sm text-gray-600">
            {error ?? "This event could not be found or is not publicly shared."}
          </p>
          <Link
            to="/"
            className="inline-flex text-sm font-medium text-primary hover:text-primary/80"
          >
            Back to NSA Connect
          </Link>
        </Card>
      </div>
    );
  }

  const memberPath = eventDetailPath(event.id);
  const loginHref = `/login?next=${encodeURIComponent(memberPath)}`;
  const location = event.location?.trim() || "Location TBA";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
        NSA Connect
      </p>

      <Card padding="none" className="mt-4 overflow-hidden">
        {event.event_photo_url ? (
          <div className="relative aspect-[16/9] w-full bg-gray-100">
            <img
              src={event.event_photo_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
            >
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
            {!event.is_past ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-100/70">
                {formatCountdownBadge(event.starts_at)}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700">
                Past event
              </span>
            )}
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {event.name}
          </h1>

          <div className="space-y-3 text-sm text-gray-700">
            <p className="flex items-start gap-2.5">
              <AppIcon
                icon={Calendar}
                size="xs"
                className="mt-0.5 shrink-0 text-gray-400"
              />
              <span>{formatEventDateTime(event.starts_at)}</span>
            </p>
            <p className="flex items-start gap-2.5">
              <AppIcon
                icon={MapPin}
                size="xs"
                className="mt-0.5 shrink-0 text-gray-400"
              />
              <span>{location}</span>
            </p>
            <p className="flex items-start gap-2.5">
              <AppIcon
                icon={Users}
                size="xs"
                className="mt-0.5 shrink-0 text-gray-400"
              />
              <span>
                {event.going_count} going
                {event.capacity != null ? ` · Capacity ${event.capacity}` : ""}
              </span>
            </p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-medium text-foreground">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {event.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-5">
            {isAuthenticated ? (
              <Link to={memberPath} className={primaryCtaClass}>
                Open in NSA Connect
              </Link>
            ) : (
              <>
                <Link to={loginHref} className={primaryCtaClass}>
                  Log in to RSVP
                </Link>
                <Link to="/register" className={secondaryCtaClass}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
