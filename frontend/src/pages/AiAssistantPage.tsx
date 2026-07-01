import { ChatPanel } from "../components/chat/ChatPanel";

export function AiAssistantPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-light tracking-headline text-foreground">AI Assistant</h1>
        <p className="mt-2 max-w-2xl text-sm text-label">
          Ask constitution questions or request live NSA Connect data. Responses
          stream in as the assistant searches the constitution and checks the
          database.
        </p>
      </header>

      <ChatPanel />
    </div>
  );
}
