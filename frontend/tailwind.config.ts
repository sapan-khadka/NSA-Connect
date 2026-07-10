import type { Config } from "tailwindcss";

/**
 * Tailwind theme maps to CampusOS CSS variables (`design-system/tokens.css`).
 * Do not hardcode hex here — change values in tokens.ts / tokens.css.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        foreground: "var(--color-foreground)",
        label: "var(--color-label)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
        },
        mint: {
          DEFAULT: "var(--color-mint)",
        },
        urgent: "var(--color-urgent)",
        overdue: {
          DEFAULT: "var(--color-overdue)",
          surface: "var(--color-overdue-surface)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          surface: "var(--color-warning-surface)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          surface: "var(--color-success-surface)",
        },
        kanban: {
          header: "var(--color-kanban-header)",
          border: "var(--color-kanban-border)",
          badge: "var(--color-kanban-badge)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          card: "var(--color-surface-card)",
          muted: "var(--color-surface-muted)",
        },
        badge: {
          green: { DEFAULT: "var(--badge-green-fg)", bg: "var(--badge-green-bg)" },
          purple: {
            DEFAULT: "var(--badge-purple-fg)",
            bg: "var(--badge-purple-bg)",
          },
          blue: { DEFAULT: "var(--badge-blue-fg)", bg: "var(--badge-blue-bg)" },
          teal: { DEFAULT: "var(--badge-teal-fg)", bg: "var(--badge-teal-bg)" },
          coral: { DEFAULT: "var(--badge-coral-fg)", bg: "var(--badge-coral-bg)" },
          amber: { DEFAULT: "var(--badge-amber-fg)", bg: "var(--badge-amber-bg)" },
          red: { DEFAULT: "var(--badge-red-fg)", bg: "var(--badge-red-bg)" },
        },
        marigold: {
          DEFAULT: "var(--color-marigold)",
          hover: "var(--color-marigold-hover)",
        },
        olive: {
          DEFAULT: "var(--color-olive)",
          light: "var(--color-olive-light)",
        },
        roleBadge: {
          president: {
            DEFAULT: "var(--role-president-fg)",
            bg: "var(--role-president-bg)",
          },
          vicePresident: {
            DEFAULT: "var(--role-vice-president-fg)",
            bg: "var(--role-vice-president-bg)",
          },
          secretary: {
            DEFAULT: "var(--role-secretary-fg)",
            bg: "var(--role-secretary-bg)",
          },
          treasurer: {
            DEFAULT: "var(--role-treasurer-fg)",
            bg: "var(--role-treasurer-bg)",
          },
          eventManager: {
            DEFAULT: "var(--role-event-manager-fg)",
            bg: "var(--role-event-manager-bg)",
          },
          nsr: {
            DEFAULT: "var(--role-nsr-fg)",
            bg: "var(--role-nsr-bg)",
          },
          pro: {
            DEFAULT: "var(--role-pro-fg)",
            bg: "var(--role-pro-bg)",
          },
          board: {
            DEFAULT: "var(--role-board-fg)",
            bg: "var(--role-board-bg)",
          },
          general: {
            DEFAULT: "var(--role-general-fg)",
            bg: "var(--role-general-bg)",
          },
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
        ],
      },
      fontSize: {
        "ds-caption": ["var(--text-caption)", { lineHeight: "var(--leading-normal)" }],
        "ds-body": ["var(--text-body)", { lineHeight: "var(--leading-normal)" }],
        "ds-body-lg": [
          "var(--text-body-lg)",
          { lineHeight: "var(--leading-normal)" },
        ],
        "ds-title": ["var(--text-title)", { lineHeight: "var(--leading-snug)" }],
        "ds-heading": [
          "var(--text-heading)",
          { lineHeight: "var(--leading-tight)" },
        ],
        "ds-display": [
          "var(--text-display)",
          { lineHeight: "var(--leading-tight)" },
        ],
        "ds-number": ["var(--text-number)", { lineHeight: "1" }],
      },
      spacing: {
        ds0: "var(--space-0)",
        ds1: "var(--space-1)",
        ds2: "var(--space-2)",
        ds3: "var(--space-3)",
        ds4: "var(--space-4)",
        ds5: "var(--space-5)",
        ds6: "var(--space-6)",
        ds8: "var(--space-8)",
      },
      letterSpacing: {
        headline: "var(--tracking-headline)",
        subhead: "var(--tracking-subhead)",
        body: "var(--tracking-body)",
        label: "var(--tracking-label)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
        kanban: "var(--radius-kanban)",
        "ds-sm": "var(--radius-sm)",
        "ds-md": "var(--radius-md)",
        "ds-lg": "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      maxWidth: {
        canvas: "var(--main-max-width)",
      },
    },
  },
  plugins: [],
} satisfies Config;
