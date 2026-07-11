import { Megaphone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ArrowLink } from "./ui/ArrowLink";
import { Badge } from "./ui/Badge";
import { HomeCard } from "./ui/HomeCard";
import { IconBadge } from "./ui/IconBadge";
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  fetchAnnouncements,
  type Announcement,
} from "../lib/announcements-api";
import { formatRelativeTimestamp } from "../lib/format-datetime";
import nsaCover from "../assets/nsa-cover.PNG";

function AnnouncementCardShell({
  children,
  headerAction,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <HomeCard
      padding="sm"
      className="flex h-full flex-col"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="ds-icon-label">
          <IconBadge icon={Megaphone} category="announcements" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">Announcements</h2>
        </div>
        {headerAction}
      </div>
      <div className="mt-3 flex flex-col">{children}</div>
    </HomeCard>
  );
}

function AnnouncementPreviewRow({ announcement }: { announcement: Announcement }) {
  return (
    <Link
      to="/announcements"
      className="group flex gap-3 rounded-card p-1.5 transition duration-200 ease-out hover:bg-surface-muted"
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-muted ring-1 ring-inset ring-gray-200/80">
        <img
          src={nsaCover}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
          {announcement.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm font-normal leading-snug text-gray-600">
          {announcement.body}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="primary" className="px-2 py-0.5 text-xs font-medium">
            {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]}
          </Badge>
          <time
            dateTime={announcement.created_at}
            className="text-xs font-normal tracking-[0.02em] text-gray-500"
          >
            {formatRelativeTimestamp(announcement.created_at)}
          </time>
        </div>
      </div>
    </Link>
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
        <p className="text-sm font-normal text-gray-600">Loading announcements…</p>
      </AnnouncementCardShell>
    );
  }

  if (announcements.length === 0) {
    return (
      <AnnouncementCardShell
        headerAction={<ArrowLink to="/announcements">View all</ArrowLink>}
      >
        <p className="text-sm font-normal text-gray-600">No announcements yet.</p>
      </AnnouncementCardShell>
    );
  }

  const visibleAnnouncements = announcements.slice(0, previewLimit);

  return (
    <AnnouncementCardShell
      headerAction={<ArrowLink to="/announcements">View all</ArrowLink>}
    >
      <ul className="space-y-0.5">
        {visibleAnnouncements.map((announcement) => (
          <li key={announcement.id}>
            <AnnouncementPreviewRow announcement={announcement} />
          </li>
        ))}
      </ul>
    </AnnouncementCardShell>
  );
}
