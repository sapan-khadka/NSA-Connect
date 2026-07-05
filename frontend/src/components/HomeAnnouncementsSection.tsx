import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ArrowLink } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";
import { SectionLabel } from "./ui/SectionLabel";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  fetchAnnouncements,
  type Announcement,
} from "../lib/announcements-api";
import { formatEventDateTime } from "../lib/format-datetime";

export function HomeAnnouncementsSection() {
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
      <HomeCard>
        <SectionLabel>Announcements</SectionLabel>
        <p className="mt-4 text-sm text-label">Loading announcements…</p>
      </HomeCard>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  return (
    <HomeCard>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Announcements</SectionLabel>
        <ArrowLink to="/announcements">View all</ArrowLink>
      </div>

      <ul className="mt-4 space-y-4">
        {announcements.map((announcement) => (
          <li key={announcement.id} className="border-b border-gray-100 pb-4 last:border-b-0">
            <Link to="/announcements" className="group block">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground group-hover:text-accent">
                  {announcement.title}
                </p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-label">
                  {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-label">{announcement.body}</p>
              <p className="mt-2 text-xs text-label">
                {announcement.author.full_name} · {formatEventDateTime(announcement.created_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
