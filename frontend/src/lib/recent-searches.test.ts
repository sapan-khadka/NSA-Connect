import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRecentSearches,
  readRecentSearches,
  writeRecentSearch,
} from "./recent-searches";

describe("recent searches", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  it("stores unique recent queries with newest first", () => {
    writeRecentSearch("Ada");
    writeRecentSearch("Dashain");
    writeRecentSearch("ada");
    expect(readRecentSearches()).toEqual(["ada", "Dashain"]);
  });

  it("clears recent searches", () => {
    writeRecentSearch("Finance");
    clearRecentSearches();
    expect(readRecentSearches()).toEqual([]);
  });
});
