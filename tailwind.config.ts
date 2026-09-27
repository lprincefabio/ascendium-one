import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          deep: "hsl(217 70% 9%)",
          DEFAULT: "hsl(217 66% 13%)",
          glow: "hsl(217 55% 22%)",
          line: "hsl(217 40% 24%)",
        },
        gold: {
          DEFAULT: "hsl(45 71% 47%)",
          light: "hsl(45 78% 62%)",
          dark: "hsl(42 65% 38%)",
          soft: "hsl(45 60% 92%)",
        },
        teal: {
          DEFAULT: "hsl(185 55% 42%)",
          light: "hsl(185 45% 62%)",
        },
        silver: "hsl(220 12% 74%)",
        ink: {
          DEFAULT: "hsl(217 66% 13%)",
          muted: "hsl(220 10% 40%)",
        },
      },
      fontFamily: {
        display: ['"Optima"', '"Iowan Old Style"', '"Palatino Linotype"', "Palatino", "Georgia", "serif"],
        body: ["ui-sans-serif", "-apple-system", '"Segoe UI"', "Inter", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", '"SF Mono"', '"JetBrains Mono"', "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 3px 0 rgb(0 0 0 / 0.08)",
        panel: "0 8px 24px -12px rgb(2 8 23 / 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
