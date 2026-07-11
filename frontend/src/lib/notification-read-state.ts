const STORAGE_KEY = "nsa-connect-notification-read-ids";

export function readNotificationReadIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(
      parsed.filter((item): item is string => typeof item === "string"),
    );
  } catch {
    return new Set();
  }
}

export function writeNotificationReadIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function markNotificationRead(id: string): Set<string> {
  const next = readNotificationReadIds();
  next.add(id);
  writeNotificationReadIds(next);
  return next;
}

export function markNotificationsRead(ids: string[]): Set<string> {
  const next = readNotificationReadIds();
  for (const id of ids) {
    next.add(id);
  }
  writeNotificationReadIds(next);
  return next;
}
