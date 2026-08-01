/**
 * Shared files for a discussion room — images, videos, docs, and voice notes
 * collected from non-deleted messages.
 */

import {
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Mic,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Drawer } from "../../design-system/components/feedback/Drawer";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  fetchDiscussionSharedFiles,
  type DiscussionAttachmentKind,
  type DiscussionSharedFile,
} from "../../lib/discussion-api";
import { formatCompactRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type KindFilter = "all" | DiscussionAttachmentKind;

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Photos" },
  { id: "video", label: "Videos" },
  { id: "file", label: "Docs" },
  { id: "audio", label: "Voice" },
];

const KIND_ICON: Record<DiscussionAttachmentKind, LucideIcon> = {
  image: ImageIcon,
  video: Film,
  file: FileText,
  audio: Mic,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DiscussionSharedFilesDrawerProps = {
  open: boolean;
  roomId: string | null;
  onClose: () => void;
  onJumpToMessage?: (messageId: number) => void;
};

export function DiscussionSharedFilesDrawer({
  open,
  roomId,
  onClose,
  onJumpToMessage,
}: DiscussionSharedFilesDrawerProps) {
  const [files, setFiles] = useState<DiscussionSharedFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  useEffect(() => {
    if (!open || !roomId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchDiscussionSharedFiles(roomId, {
      kind: kindFilter === "all" ? undefined : kindFilter,
    })
      .then((response) => {
        if (!cancelled) {
          setFiles(response.files);
          setTotal(response.total);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setFiles([]);
          setTotal(0);
          setError(getApiErrorMessage(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, roomId, kindFilter]);

  const title = useMemo(() => {
    if (loading) {
      return "Shared files";
    }
    return total === 1 ? "1 file" : `${total} files`;
  }, [loading, total]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="sm"
      closeOnBackdrop
      showClose
      title={title}
      description="Files shared in this chat"
      className="discussion-shared-files-drawer"
    >
      <div className="space-y-4">
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Filter by type"
        >
          {KIND_FILTERS.map((filter) => {
            const active = kindFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setKindFilter(filter.id)}
                className={[
                  "rounded-full px-2.5 py-1 text-[12px] font-medium transition",
                  active
                    ? "bg-primary text-white"
                    : "bg-[#F3F3F2] text-gray-600 hover:bg-[#EBEBEA]",
                ].join(" ")}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="py-6 text-sm text-gray-500">Loading files…</p>
        ) : error ? (
          <p className="py-6 text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : files.length === 0 ? (
          <p className="py-6 text-sm text-gray-500">
            No shared files in this chat yet. Attach a file when you send a
            message.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100" aria-label="Shared files">
            {files.map((file) => {
              const Icon = KIND_ICON[file.kind];
              return (
                <li key={file.id} className="flex items-start gap-3 py-3">
                  {file.kind === "image" ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#F3F3F2]"
                    >
                      <img
                        src={file.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F3F3F2] text-primary">
                      <AppIcon icon={Icon} size="sm" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {file.file_name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-500">
                      {file.author_name} · {formatSize(file.size_bytes)} ·{" "}
                      {formatCompactRelativeTimestamp(file.created_at)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        download={file.file_name}
                        className="inline-flex h-7 items-center gap-1 rounded-full border border-[#EBEBEA] px-2.5 text-[11px] font-medium text-gray-600 transition hover:bg-[#F5F5F4] hover:text-foreground"
                      >
                        <AppIcon icon={Download} size="xs" />
                        Download
                      </a>
                      {onJumpToMessage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="!h-7 !px-2.5 !text-[11px]"
                          onClick={() => {
                            onJumpToMessage(file.message_id);
                            onClose();
                          }}
                        >
                          View in chat
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
