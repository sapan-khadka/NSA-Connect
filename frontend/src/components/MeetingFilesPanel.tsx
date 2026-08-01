/**
 * Files attached in this meeting's discussion room.
 * Org-wide Drive lands in a later phase — this is the meeting-scoped subset.
 */

import { Download, FileText, Film, Image as ImageIcon, Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchDiscussionSharedFiles,
  type DiscussionAttachmentKind,
  type DiscussionSharedFile,
} from "../lib/discussion-api";
import { discussionRoomPath } from "../lib/discussion-paths";
import { formatCompactRelativeTimestamp } from "../lib/format-datetime";
import { AppIcon } from "./ui/AppIcon";
import { Card } from "./ui/Card";

type MeetingFilesPanelProps = {
  eventId: number;
};

const KIND_ICON = {
  image: ImageIcon,
  video: Film,
  file: FileText,
  audio: Mic,
} as const satisfies Record<DiscussionAttachmentKind, typeof FileText>;

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MeetingFilesPanel({ eventId }: MeetingFilesPanelProps) {
  const roomId = `event:${eventId}`;
  const discussionHref = discussionRoomPath(roomId);
  const [files, setFiles] = useState<DiscussionSharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchDiscussionSharedFiles(roomId, { limit: 50 })
      .then((response) => {
        if (!cancelled) {
          setFiles(response.files);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setFiles([]);
          setError(getApiErrorMessage(caught));
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
  }, [roomId]);

  return (
    <Card padding="md" aria-label="Meeting files">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-light tracking-subhead text-foreground">
            Files
          </h2>
          <p className="mt-1 text-sm text-label">
            Attachments shared in this meeting&apos;s discussion. Organization
            Drive folders come later.
          </p>
        </div>
        <Link to={discussionHref} className="ds-link text-sm">
          Open discussion →
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-label">Loading files…</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 ds-alert-banner">
          {error}
        </p>
      ) : null}

      {!isLoading && !error && files.length === 0 ? (
        <p className="mt-4 text-sm text-label">
          No files yet. Share an attachment in Discussion and it will show up
          here.
        </p>
      ) : null}

      {!isLoading && files.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-100">
          {files.map((file) => {
            const Icon = KIND_ICON[file.kind] ?? FileText;
            return (
              <li key={file.id} className="flex items-center gap-3 py-3">
                <AppIcon icon={Icon} size="sm" className="text-label" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.file_name}
                  </p>
                  <p className="text-xs text-label">
                    {formatSize(file.size_bytes)}
                    {file.created_at
                      ? ` · ${formatCompactRelativeTimestamp(file.created_at)}`
                      : ""}
                    {file.author_name ? ` · ${file.author_name}` : ""}
                  </p>
                </div>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                  download={file.file_name}
                >
                  <AppIcon icon={Download} size="xs" />
                  Open
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
