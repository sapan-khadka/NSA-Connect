import { Megaphone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ArrowLink } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";
import { IconBadge } from "./ui/IconBadge";
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  fetchAnnouncements,
  type Announcement,
} from "../lib/announcements-api";
import { formatEventDateTime } from "../lib/format-datetime";
import nsaCover from "../assets/nsa-cover.PNG";

function AnnouncementCardShell({
  children,
  headerAction,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <HomeCard className="flex h-full min-h-[28rem] flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="ds-icon-label">
          <IconBadge icon={Megaphone} category="announcements" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">Announcements</h2>
        </div>
        {headerAction}
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </HomeCard>
  );
}

export function HomeAnnouncementsSection({
  previewLimit = 3,
}: {
  previewLimit?: number;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetchAnnouncements();
        if (!cancelled) {
          setAnnouncements(response.announcements.slice(0, 3));
        }
      } catch {
        if (!cancelled) {
          setAnnouncements([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <AnnouncementCardShell>
        <p className="text-sm text-label">Loading announcements…</p>
      </AnnouncementCardShell>
    );
  }

  if (announcements.length === 0) {
    return (
      <AnnouncementCardShell
        headerAction={<ArrowLink to="/announcements">View all</ArrowLink>}
      >
        <p className="text-sm text-label">No announcements yet.</p>
      </AnnouncementCardShell>
    );
  }

  const visibleAnnouncements = announcements.slice(0, previewLimit);
  const [featured, ...rest] = visibleAnnouncements;

  return (
    <AnnouncementCardShell
      headerAction={<ArrowLink to="/announcements">View all</ArrowLink>}
    >
      {featured ? (
        <Link
          to="/announcements"
          className="group flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-gray-200 bg-surface-muted/60 transition duration-200 ease-out hover:border-gray-300 hover:shadow-card"
        >
          <div className="relative h-36 w-full shrink-0 overflow-hidden sm:h-40">
            <img
              src={nsaCover}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent"
            />
          </div>
          <div className="flex flex-1 flex-col p-4">
            <p className="line-clamp-2 text-lg font-semibold text-foreground group-hover:text-primary">
              {featured.title}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-badge-teal-bg px-2 py-1 text-sm font-semibold text-badge-teal">
                {ANNOUNCEMENT_CATEGORY_LABELS[featured.category]}
              </span>
              <span className="text-sm text-label">
                {formatEventDateTime(featured.created_at)}
              </span>
            </div>
          </div>
        </Link>
      ) : null}

      {rest.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-gray-200 pt-4">
          {rest.map((announcement) => (
            <li key={announcement.id}>
              <Link
                to="/announcements"
                className="group flex items-start justify-between gap-4 rounded-card px-1 py-2 transition duration-200 hover:bg-surface-muted"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {announcement.title}
                  </p>
                  <p className="mt-1 text-sm text-label">
                    {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]} ·{" "}
                    {formatEventDateTime(announcement.created_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </AnnouncementCardShell>
  );
}
