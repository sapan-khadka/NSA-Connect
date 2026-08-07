import { describe, expect, it } from "vitest";

import {
  colors,
  radii,
  shadows,
  spacing,
  typography,
} from "./tokens";

describe("NSA Connect design tokens", () => {
  it("uses monochrome brand chrome with colorful semantic tones", () => {
    expect(colors.surface.DEFAULT).toBe("#FAFAFA");
    expect(colors.surface.card).toBe("#FFFFFF");
    expect(colors.border).toBe("#E5E5E5");
    expect(colors.primary.DEFAULT).toBe("#111111");
    expect(colors.primary.hover).toBe("#000000");
    expect(colors.accent.DEFAULT).toBe("#111111");
    expect(colors.badge.teal.fg).toBe("#0F766E");
    expect(colors.success.DEFAULT).toBe("#16A34A");
    expect(colors.warning.DEFAULT).toBe("#EA580C");
    expect(colors.overdue.DEFAULT).toBe("#DC2626");
    expect(colors.roleBadge.president.fg).toBe("#9A6B2E");
  });

  it("uses an 8-point spacing grid", () => {
    expect(spacing[1]).toBe("8px");
    expect(spacing[2]).toBe("16px");
    expect(spacing[3]).toBe("24px");
    expect(spacing[4]).toBe("32px");
  });

  it("standardizes tighter card radius and soft neutral shadows", () => {
    expect(radii.card).toBe("12px");
    expect(shadows.card).toContain("rgba(0, 0, 0");
  });

  it("defines the Plus Jakarta Sans typography scale", () => {
    expect(typography.fontFamily.sans[0]).toBe('"Plus Jakarta Sans"');
    expect(typography.fontFamily.display[0]).toBe("Outfit");
    expect(typography.size.display).toBe("32px");
    expect(typography.size.title).toBe("18px");
    expect(typography.size.body).toBe("14px");
    expect(typography.size.number).toBe("32px");
    expect(typography.weight.bold).toBe("700");
    expect(typography.weight.semibold).toBe("600");
  });
});
