import { describe, expect, it } from "vitest";

import { getSeasonalTheme } from "./seasonal-theme";

describe("seasonal-theme", () => {
  it("returns dashain theme during October", () => {
    const theme = getSeasonalTheme(new Date(2030, 9, 5));

    expect(theme.variant).toBe("dashain");
  });

  it("returns holi theme during March", () => {
    const theme = getSeasonalTheme(new Date(2030, 2, 10));

    expect(theme.variant).toBe("holi");
  });

  it("returns default theme in ordinary months", () => {
    const theme = getSeasonalTheme(new Date(2030, 5, 15));

    expect(theme.variant).toBe("default");
    expect(theme.heroClass).toBe("nepali-hero");
  });
});
