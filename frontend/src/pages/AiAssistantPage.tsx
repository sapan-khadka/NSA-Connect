import { useState } from "react";

import { ChatPanel } from "../components/chat/ChatPanel";
import { NsaDocumentsPanel } from "../components/NsaDocumentsPanel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
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

const ASSISTANT_TABS = [
  { id: "chat", label: "Chat" },
  { id: "documents", label: "NSA Documents" },
] as const;

export function AiAssistantPage() {
  const { member } = useAuth();
  const isBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const [tab, setTab] = useState<"chat" | "documents">("chat");
  const [starterQuery, setStarterQuery] = useState<string | null>(null);

  return (
    <div className="ai-assistant-page space-y-5 sm:space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-headline text-foreground sm:text-2xl sm:font-light">
          AI Assistant
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-label">
          Ask about membership, dues, events, finances, constitution, and
          chapter documents. Answers use live NSA Connect data and indexed PDFs.
          Your access still follows board and treasury permissions.
        </p>
      </header>

      <SegmentedControl
        ariaLabel="Assistant section"
        value={tab}
        options={ASSISTANT_TABS}
        onChange={setTab}
      />

      {tab === "chat" ? (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {STARTERS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setStarterQuery(prompt)}
                className="shrink-0 rounded-full border border-[#E8E8E6] bg-white px-3 py-1.5 text-left text-[12px] font-medium text-foreground transition hover:border-gray-300 hover:bg-[#FAFAF9] sm:shrink"
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
