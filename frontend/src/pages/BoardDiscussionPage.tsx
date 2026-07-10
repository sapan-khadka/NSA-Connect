import { DiscussionFeed } from "../components/DiscussionFeed";

export function BoardDiscussionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-light tracking-headline text-foreground">
          Board discussion
        </h1>
        <p className="mt-2 text-sm text-label">
          A board-only space for async updates. New posts stay in-app — no email
          notifications.
        </p>
      </header>

      <DiscussionFeed
        title="Board channel"
        description="Visible to board members and above."
        scope={{ type: "board" }}
      />
    </div>
  );
}
