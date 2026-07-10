import { describe, expect, it } from "vitest";

import {
  colors,
  radii,
  shadows,
  spacing,
  typography,
} from "./tokens";

describe("CampusOS design tokens", () => {
  it("exposes the CampusOS semantic color foundation", () => {
    expect(colors.surface.DEFAULT).toBe("#F8FAFC");
    expect(colors.surface.card).toBe("#FFFFFF");
    expect(colors.border).toBe("#E5E7EB");
    expect(colors.primary.DEFAULT).toBe("#0F766E");
    expect(colors.warning.DEFAULT).toBe("#EA580C");
    expect(colors.success.DEFAULT).toBe("#16A34A");
    expect(colors.overdue.DEFAULT).toBe("#DC2626");
  });

  it("uses an 8-point spacing grid", () => {
    expect(spacing[1]).toBe("8px");
    expect(spacing[2]).toBe("16px");
    expect(spacing[3]).toBe("24px");
    expect(spacing[4]).toBe("32px");
  });

  it("standardizes card radius and soft shadows", () => {
    expect(radii.card).toBe("16px");
    expect(shadows.card).toContain("rgba(15, 23, 42");
  });

  it("defines the Inter typography scale", () => {
    expect(typography.fontFamily.sans[0]).toBe("Inter");
    expect(typography.size.display).toBe("32px");
    expect(typography.size.title).toBe("18px");
    expect(typography.size.body).toBe("14px");
    expect(typography.size.number).toBe("32px");
    expect(typography.weight.bold).toBe("700");
    expect(typography.weight.semibold).toBe("600");
  });
});
