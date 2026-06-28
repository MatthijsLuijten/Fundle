import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      colors: {
        fundle: {
          bg: "var(--fundle-bg)",
          "bg-elevated": "var(--fundle-bg-elevated)",
          card: "var(--fundle-card)",
          "card-hover": "var(--fundle-card-hover)",
          border: "var(--fundle-border)",
          "border-strong": "var(--fundle-border-strong)",
          text: "var(--fundle-text)",
          muted: "var(--fundle-muted)",
          accent: "var(--fundle-accent)",
          "accent-hover": "var(--fundle-accent-hover)",
          "accent-muted": "var(--fundle-accent-muted)",
          "accent-fg": "var(--fundle-accent-fg)",
          orange: "var(--fundle-orange)",
        },
      },
      boxShadow: {
        card: "var(--fundle-shadow)",
        sm: "var(--fundle-shadow-sm)",
      },
    },
  },
  plugins: [],
};

export default config;
