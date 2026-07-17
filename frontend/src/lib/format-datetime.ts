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

export function formatIsoDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
