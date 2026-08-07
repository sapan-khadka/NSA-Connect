/**
 * Persistent prefs for the global desktop Inbox rail (chrome, not a Home widget).
 */

import { useEffect, useState } from "react";

export const INBOX_RAIL_MIN_WIDTH = 280;
export const INBOX_RAIL_MAX_WIDTH = 480;
export const INBOX_RAIL_DEFAULT_WIDTH = 352;
export const INBOX_RAIL_COLLAPSED_WIDTH = 64;

export type InboxRailPrefs = {
  version: 1;
  /** Fully hidden for maximum workspace (reopen from top bar). */
  open: boolean;
  /** Narrow icon rail vs full conversation list. */
  collapsed: boolean;
  /** Expanded panel width in px. */
  width: number;
};

const DEFAULT_PREFS: InboxRailPrefs = {
  version: 1,
  open: true,
  collapsed: false,
  width: INBOX_RAIL_DEFAULT_WIDTH,
};

export function inboxRailStorageKey(memberId: number): string {
  return `nsa-connect.inbox-rail.v1:${memberId}`;
}

export function clampInboxRailWidth(width: number): number {
  return Math.min(
    INBOX_RAIL_MAX_WIDTH,
    Math.max(INBOX_RAIL_MIN_WIDTH, Math.round(width)),
  );
}

export function loadInboxRailPrefs(memberId: number): InboxRailPrefs {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(inboxRailStorageKey(memberId));
    if (!raw) {
      return { ...DEFAULT_PREFS };
    }
    const parsed = JSON.parse(raw) as Partial<InboxRailPrefs>;
    if (parsed.version !== 1) {
      return { ...DEFAULT_PREFS };
    }
    return {
      version: 1,
      open: parsed.open !== false,
      collapsed: Boolean(parsed.collapsed),
      width: clampInboxRailWidth(
        typeof parsed.width === "number"
          ? parsed.width
          : INBOX_RAIL_DEFAULT_WIDTH,
      ),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveInboxRailPrefs(
  memberId: number,
  prefs: InboxRailPrefs,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      inboxRailStorageKey(memberId),
      JSON.stringify({
        ...prefs,
        width: clampInboxRailWidth(prefs.width),
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function inboxRailDisplayWidth(prefs: InboxRailPrefs): number {
  if (!prefs.open) {
    return 0;
  }
  if (prefs.collapsed) {
    return INBOX_RAIL_COLLAPSED_WIDTH;
  }
  return clampInboxRailWidth(prefs.width);
}

export function useInboxRailPrefs(memberId: number | undefined) {
  const [prefs, setPrefsState] = useState<InboxRailPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (memberId == null) {
      setPrefsState({ ...DEFAULT_PREFS });
      return;
    }
    setPrefsState(loadInboxRailPrefs(memberId));
  }, [memberId]);

  useEffect(() => {
    if (memberId == null) {
      document.documentElement.style.setProperty("--inbox-rail-width", "0px");
      return;
    }
    saveInboxRailPrefs(memberId, prefs);
    document.documentElement.style.setProperty(
      "--inbox-rail-width",
      `${inboxRailDisplayWidth(prefs)}px`,
    );
  }, [memberId, prefs]);

  function setPrefs(
    update: InboxRailPrefs | ((current: InboxRailPrefs) => InboxRailPrefs),
  ) {
    setPrefsState((current) =>
      typeof update === "function" ? update(current) : update,
    );
  }

  return { prefs, setPrefs };
}
