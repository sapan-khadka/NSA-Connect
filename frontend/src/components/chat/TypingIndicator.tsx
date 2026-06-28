export function TypingIndicator({ label = "Assistant is typing" }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 text-sm text-gray-500"
      aria-live="polite"
      aria-label={label}
    >
      <span className="inline-flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.2s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.1s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
      </span>
      <span>{label}</span>
    </div>
  );
}
