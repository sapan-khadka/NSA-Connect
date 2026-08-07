import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  clampInboxRailWidth,
  inboxRailDisplayWidth,
  inboxRailStorageKey,
  loadInboxRailPrefs,
  saveInboxRailPrefs,
  INBOX_RAIL_COLLAPSED_WIDTH,
  INBOX_RAIL_DEFAULT_WIDTH,
} from "./inbox-rail-prefs";

describe("inbox-rail-prefs", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("clamps width to safe bounds", () => {
    expect(clampInboxRailWidth(100)).toBe(280);
    expect(clampInboxRailWidth(900)).toBe(480);
    expect(clampInboxRailWidth(320)).toBe(320);
  });

  it("persists open / collapsed / width per member", () => {
    saveInboxRailPrefs(7, {
      version: 1,
      open: false,
      collapsed: true,
      width: 400,
    });
    expect(window.localStorage.getItem(inboxRailStorageKey(7))).toContain(
      '"open":false',
    );
    const loaded = loadInboxRailPrefs(7);
    expect(loaded.open).toBe(false);
    expect(loaded.collapsed).toBe(true);
    expect(loaded.width).toBe(400);
  });

  it("reports display width for expanded, collapsed, and hidden", () => {
    expect(
      inboxRailDisplayWidth({
        version: 1,
        open: true,
        collapsed: false,
        width: INBOX_RAIL_DEFAULT_WIDTH,
      }),
    ).toBe(INBOX_RAIL_DEFAULT_WIDTH);
    expect(
      inboxRailDisplayWidth({
        version: 1,
        open: true,
        collapsed: true,
        width: 400,
      }),
    ).toBe(INBOX_RAIL_COLLAPSED_WIDTH);
    expect(
      inboxRailDisplayWidth({
        version: 1,
        open: false,
        collapsed: false,
        width: 400,
      }),
    ).toBe(0);
  });

  it("falls back to defaults when storage is corrupt", () => {
    window.localStorage.setItem(inboxRailStorageKey(3), "{not-json");
    const loaded = loadInboxRailPrefs(3);
    expect(loaded.open).toBe(true);
    expect(loaded.collapsed).toBe(false);
    expect(loaded.width).toBe(INBOX_RAIL_DEFAULT_WIDTH);
  });
});
