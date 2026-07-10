import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";

import { getApiErrorMessage } from "../../lib/auth-api";
import {
  PHOTO_UPLOAD_MAX_BATCH,
  preparePhotosForUpload,
} from "../../lib/compress-image";
import {
  uploadEventPhoto,
  type EventPhoto,
} from "../../lib/photo-archive-api";
import { AppIcon } from "../ui/AppIcon";

type UploadItem = {
  id: string;
  fileName: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

type PhotoUploadPanelProps = {
  eventId: number;
  onUploaded: (photo: EventPhoto) => void;
};

export function PhotoUploadPanel({ eventId, onUploaded }: PhotoUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      let prepared: File[];

      try {
        prepared = await preparePhotosForUpload(files);
      } catch (caught) {
        setItems([
          {
            id: "batch-error",
            fileName: "Upload batch",
            status: "error",
            progress: 0,
            error: caught instanceof Error ? caught.message : "Invalid files",
          },
        ]);
        return;
      }

      const queue: UploadItem[] = prepared.map((file, index) => ({
        id: `${file.name}-${index}-${Date.now()}`,
        fileName: file.name,
        status: "pending",
        progress: 0,
      }));
      setItems(queue);
      setIsUploading(true);

      for (let index = 0; index < prepared.length; index += 1) {
        const file = prepared[index];
        const itemId = queue[index].id;

        setItems((current) =>
          current.map((item) =>
            item.id === itemId ? { ...item, status: "uploading", progress: 0 } : item,
          ),
        );

        try {
          const photo = await uploadEventPhoto(eventId, file, (progress) => {
            setItems((current) =>
              current.map((item) =>
                item.id === itemId ? { ...item, progress } : item,
              ),
            );
          });
          onUploaded(photo);
          setItems((current) =>
            current.map((item) =>
              item.id === itemId
                ? { ...item, status: "done", progress: 100 }
                : item,
            ),
          );
        } catch (caught) {
          setItems((current) =>
            current.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    status: "error",
                    error: getApiErrorMessage(caught),
                  }
                : item,
            ),
          );
        }
      }

      setIsUploading(false);
    },
    [eventId, onUploaded],
  );

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      void uploadFiles(event.target.files);
      event.target.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  }

  return (
    <section className="ds-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm text-foreground">Add photos</h2>
          <p className="mt-1 text-xs text-label">
            JPG, PNG, or HEIC · up to 15 MB each · max {PHOTO_UPLOAD_MAX_BATCH} at a time
          </p>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <AppIcon icon={Upload} size="sm" className="text-current" />
          Add photos
        </button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          "mt-4 rounded-kanban border border-dashed px-4 py-8 text-center transition-colors",
          isDragging
            ? "border-accent bg-accent/5"
            : "border-kanban-border bg-surface-muted/40",
        ].join(" ")}
      >
        <p className="text-sm text-label">
          Drag and drop images here, or use the button above.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-kanban border border-kanban-border bg-white px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-foreground">{item.fileName}</span>
                <span className="shrink-0 text-xs text-label">
                  {item.status === "done"
                    ? "Uploaded"
                    : item.status === "error"
                      ? "Failed"
                      : `${item.progress}%`}
                </span>
              </div>
              {item.status === "uploading" || item.status === "pending" ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
              {item.error ? (
                <p className="mt-1 text-xs text-overdue">{item.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
