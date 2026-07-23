export function formatEventDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

export function formatRelativeTimestamp(isoDate: string, now = new Date()): string {
  const then = new Date(isoDate).getTime();
  const diffSeconds = Math.round((now.getTime() - then) / 1000);

  if (!Number.isFinite(diffSeconds)) {
    return formatEventDateTime(isoDate);
  }

  if (diffSeconds < 45) {
    return "just now";
  }
  if (diffSeconds < 90) {
    return "1 min ago";
  }
  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)} min ago`;
  }
  if (diffSeconds < 5400) {
    return "1 hr ago";
  }
  if (diffSeconds < 86400) {
    return `${Math.floor(diffSeconds / 3600)} hr ago`;
  }
  if (diffSeconds < 172800) {
    return "yesterday";
  }
  if (diffSeconds < 604800) {
    return `${Math.floor(diffSeconds / 86400)} days ago`;
  }

  return formatEventDateTime(isoDate);
}

/** Shorter stamp for dense lists (inbox rows) — avoids wrapping at phone widths. */
export function formatCompactRelativeTimestamp(
  isoDate: string,
  now = new Date(),
): string {
  const then = new Date(isoDate).getTime();
  const diffSeconds = Math.round((now.getTime() - then) / 1000);

  if (!Number.isFinite(diffSeconds)) {
    return "—";
  }

  if (diffSeconds < 45) {
    return "now";
  }
  if (diffSeconds < 3600) {
    return `${Math.max(1, Math.floor(diffSeconds / 60))}m`;
  }
  if (diffSeconds < 86400) {
    return `${Math.max(1, Math.floor(diffSeconds / 3600))}h`;
  }
  if (diffSeconds < 172800) {
    return "yday";
  }
  if (diffSeconds < 604800) {
    return `${Math.floor(diffSeconds / 86400)}d`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

export function formatIsoDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function formatCountdownBadge(isoDate: string, now = new Date()): string {
  const start = new Date(isoDate).getTime();
  const diffMs = start - now.getTime();

  if (!Number.isFinite(diffMs)) {
    return "Soon";
  }
  if (diffMs <= 0) {
    return "Happening now";
  }

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);

  if (days > 1) {
    return `${days} days left`;
  }
  if (days === 1) {
    return "Tomorrow";
  }
  if (hours >= 1) {
    return `${hours} hr left`;
  }

  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return `${minutes} min left`;
}
