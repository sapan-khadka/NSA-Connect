import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        foreground: "#1D1D1F",
        label: "#86868B",
        primary: {
          DEFAULT: "#023D54",
          hover: "#012A3A",
        },
        accent: {
          DEFAULT: "#027C68",
          hover: "#016B5A",
        },
        mint: {
          DEFAULT: "#94DEA5",
        },
        urgent: "#FFFF66",
        overdue: {
          DEFAULT: "#E8590C",
          surface: "#FDECE3",
        },
        kanban: {
          header: "#FAFAFA",
          border: "#ECECEC",
          badge: "#E5E5E7",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          card: "#F5F5F7",
          muted: "#F5F5F7",
        },
        marigold: {
          DEFAULT: "#F4A024",
          hover: "#d9890a",
        },
        olive: {
          DEFAULT: "#6B8F71",
          light: "#EEF3EF",
        },
        roleBadge: {
          president: {
            DEFAULT: "#9A6B2E",
            bg: "#FBF0E3",
          },
          vicePresident: {
            DEFAULT: "#8B6048",
            bg: "#F7EDE8",
          },
          secretary: {
            DEFAULT: "#5C6B7A",
            bg: "#EDF1F5",
          },
          treasurer: {
            DEFAULT: "#027C68",
            bg: "#E6F5F2",
          },
          eventManager: {
            DEFAULT: "#6B5494",
            bg: "#F0ECF7",
          },
          nsr: {
            DEFAULT: "#3D7A4A",
            bg: "#EAF5EC",
          },
          pro: {
            DEFAULT: "#5A6490",
            bg: "#EEF0F8",
          },
          board: {
            DEFAULT: "#4A6274",
            bg: "#EDF1F5",
          },
          general: {
            DEFAULT: "#86868B",
            bg: "#F5F5F7",
          },
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      letterSpacing: {
        headline: "-0.02em",
        subhead: "-0.01em",
        body: "-0.005em",
        label: "0.03em",
      },
      borderRadius: {
        card: "12px",
        pill: "980px",
        kanban: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
