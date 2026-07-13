import { useEffect, useId, type ReactNode } from "react";

type ModalSize = "md" | "lg" | "xl";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
};

const SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function Modal({
  open,
  title,
  onClose,
  children,
  size = "md",
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          "relative z-10 flex max-h-[min(90vh,48rem)] w-full flex-col overflow-hidden rounded-card border border-gray-200 bg-surface-card shadow-card",
          SIZE_CLASS[size],
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-medium text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-light text-label transition hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
