import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#003893",
          light: "#1a4db3",
        },
        accent: {
          DEFAULT: "#DC143C",
          hover: "#b81032",
        },
        marigold: {
          DEFAULT: "#F4A024",
          hover: "#d9890a",
        },
        surface: {
          DEFAULT: "#F1F5FA",
          muted: "#E8EEF6",
        },
        olive: {
          DEFAULT: "#6B8F71",
          light: "#EEF3EF",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
