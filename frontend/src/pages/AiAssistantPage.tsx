import { useState } from "react";

import { ChatPanel } from "../components/chat/ChatPanel";
import { NsaDocumentsPanel } from "../components/NsaDocumentsPanel";
import { useAuth } from "../context/useAuth";
import { isRoleAtLeast } from "../lib/roles";

const STARTERS = [
  "Is Apsana an approved member?",
  "Did Mukesh pay dues this semester?",
  "What events are coming up?",
  "What does the constitution say about voting?",
  "Summarize open board tasks",
  "What is our treasury balance?",
];

export function AiAssistantPage() {
  const { member } = useAuth();
  const isBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const [tab, setTab] = useState<"chat" | "documents">("chat");
  const [starterQuery, setStarterQuery] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-light tracking-headline text-foreground">
          AI Assistant
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-label">
          Ask about membership, dues, events, finances, constitution, and
          chapter documents. Answers use live NSA Connect data and indexed PDFs
          — your access still follows board and treasury permissions.
        </p>
      </header>

      <div className="flex gap-1 rounded-full border border-[#EBEBEA] bg-[#F7F7F6] p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("chat")}
          className={[
            "rounded-full px-4 py-1.5 text-[13px] font-medium transition",
            tab === "chat"
              ? "bg-white text-foreground shadow-sm"
              : "text-label hover:text-foreground",
          ].join(" ")}
        >
          Chat
        </button>
        <button
          type="button"
          onClick={() => setTab("documents")}
          className={[
            "rounded-full px-4 py-1.5 text-[13px] font-medium transition",
            tab === "documents"
              ? "bg-white text-foreground shadow-sm"
              : "text-label hover:text-foreground",
          ].join(" ")}
        >
          NSA Documents
        </button>
      </div>

      {tab === "chat" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setStarterQuery(prompt)}
                className="rounded-full border border-[#E8E8E6] bg-white px-3 py-1.5 text-left text-[12px] font-medium text-foreground transition hover:border-gray-300 hover:bg-[#FAFAF9]"
              >
                {prompt}
              </button>
            ))}
          </div>
          {!isBoard ? (
            <p className="text-[12px] text-label">
              Tip: dues totals and others&apos; payments are limited to
              treasurer / president / VP. You can always ask about your own
              dues and public events.
            </p>
          ) : null}
          <ChatPanel starterQuery={starterQuery} />
        </div>
      ) : (
        <NsaDocumentsPanel />
      )}
    </div>
  );
}
