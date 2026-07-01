import { useState } from "react";

import type { DraftAnnouncementEmailResponse } from "../lib/ai-api";

type AnnouncementEmailDraftProps = {
  draft: DraftAnnouncementEmailResponse;
  onClear: () => void;
};

type CopyTarget = "subject" | "body" | "full";

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function AnnouncementEmailDraft({
  draft,
  onClear,
}: AnnouncementEmailDraftProps) {
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);

  async function handleCopy(target: CopyTarget, text: string) {
    await copyText(text);
    setCopiedTarget(target);
    window.setTimeout(() => setCopiedTarget(null), 2000);
  }

  const fullEmail = `Subject: ${draft.subject}\n\n${draft.body}`;

  return (
    <section
      aria-label="Announcement email draft"
      className="rounded-lg border border-accent/20 bg-accent/5 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-light tracking-subhead text-foreground">Email draft</h2>
          <p className="mt-1 text-sm text-label">
            Ready to paste into your email client or mailing list.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-label underline-offset-2 hover:text-accent hover:underline"
        >
          Clear draft
        </button>
      </div>

      <article className="mt-5 overflow-hidden rounded-md border border-white/80 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-label">
                Subject
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{draft.subject}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleCopy("subject", draft.subject);
              }}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/5"
            >
              {copiedTarget === "subject" ? "Copied!" : "Copy subject"}
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-label">
              Body
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopy("body", draft.body);
                }}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/5"
              >
                {copiedTarget === "body" ? "Copied!" : "Copy body"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCopy("full", fullEmail);
                }}
                className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {copiedTarget === "full" ? "Copied!" : "Copy full email"}
              </button>
            </div>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {draft.body}
          </pre>
        </div>
      </article>
    </section>
  );
}
