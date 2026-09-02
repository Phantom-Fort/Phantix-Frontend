/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic tokens for shadcn-style Radix primitives, mapped to the
        // runtime CSS vars in index.css so light/dark/system flip automatically.
        background: "rgb(var(--surface) / <alpha-value>)",
        foreground: "rgb(var(--slate-200) / <alpha-value>)",
        card: "rgb(var(--surface-card) / <alpha-value>)",
        "card-foreground": "rgb(var(--slate-200) / <alpha-value>)",
        popover: "rgb(var(--surface-card) / <alpha-value>)",
        "popover-foreground": "rgb(var(--slate-200) / <alpha-value>)",
        muted: "rgb(var(--surface-inset) / <alpha-value>)",
        "muted-foreground": "rgb(var(--slate-400) / <alpha-value>)",
        accent: "rgb(var(--phantix-800) / <alpha-value>)",
        "accent-foreground": "rgb(var(--slate-100) / <alpha-value>)",
        border: "rgb(var(--border-subtle) / <alpha-value>)",
        input: "rgb(var(--border-subtle) / <alpha-value>)",
        ring: "rgb(var(--gold-400) / <alpha-value>)",
        primary: "rgb(var(--gold-400) / <alpha-value>)",
        "primary-foreground": "rgb(5 11 29 / <alpha-value>)",
        secondary: "rgb(var(--phantix-800) / <alpha-value>)",
        "secondary-foreground": "rgb(var(--slate-200) / <alpha-value>)",
        destructive: "rgb(var(--severity-critical) / <alpha-value>)",
        "destructive-foreground": "rgb(255 255 255 / <alpha-value>)",
        phantix: {
          950: "rgb(var(--phantix-950) / <alpha-value>)",
          900: "rgb(var(--phantix-900) / <alpha-value>)",
          850: "rgb(var(--phantix-850) / <alpha-value>)",
          800: "rgb(var(--phantix-800) / <alpha-value>)",
          700: "rgb(var(--phantix-700) / <alpha-value>)",
          600: "rgb(var(--phantix-600) / <alpha-value>)",
          500: "rgb(var(--phantix-500) / <alpha-value>)",
          400: "rgb(var(--phantix-400) / <alpha-value>)",
          300: "rgb(var(--phantix-300) / <alpha-value>)",
          200: "rgb(var(--phantix-200) / <alpha-value>)",
          100: "rgb(var(--phantix-100) / <alpha-value>)",
        },
        gold: {
          300: "rgb(var(--gold-300) / <alpha-value>)",
          400: "rgb(var(--gold-400) / <alpha-value>)",
          500: "rgb(var(--gold-500) / <alpha-value>)",
          600: "rgb(var(--gold-600) / <alpha-value>)",
        },
        severity: {
          critical: "rgb(var(--severity-critical) / <alpha-value>)",
          high: "rgb(var(--severity-high) / <alpha-value>)",
          medium: "rgb(var(--severity-medium) / <alpha-value>)",
          low: "rgb(var(--severity-low) / <alpha-value>)",
          info: "rgb(var(--severity-info) / <alpha-value>)",
        },
        slate: {
          50: "rgb(var(--slate-50) / <alpha-value>)",
          100: "rgb(var(--slate-100) / <alpha-value>)",
          200: "rgb(var(--slate-200) / <alpha-value>)",
          300: "rgb(var(--slate-300) / <alpha-value>)",
          400: "rgb(var(--slate-400) / <alpha-value>)",
          500: "rgb(var(--slate-500) / <alpha-value>)",
          600: "rgb(var(--slate-600) / <alpha-value>)",
          700: "rgb(var(--slate-700) / <alpha-value>)",
          800: "rgb(var(--slate-800) / <alpha-value>)",
          900: "rgb(var(--slate-900) / <alpha-value>)",
          950: "rgb(var(--slate-950) / <alpha-value>)",
        },
        white: "rgb(var(--color-white) / <alpha-value>)",
        black: "rgb(var(--color-black) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Geist Variable'", "Inter", "system-ui", "sans-serif"],
        sans: ["'Geist Variable'", "Inter", "system-ui", "sans-serif"],
        mono: ["'Geist Mono Variable'", "'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Flat dev-tool look: no soft glows. Keys kept so existing usages
        // resolve to crisp 1px accent rings instead of blurred halos.
        glow: "0 0 0 1px rgba(232, 181, 77, 0.25)",
        "glow-blue": "0 0 0 1px rgba(63, 63, 70, 0.9)",
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.5)",
      },
      backgroundSize: {
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "collapse-down": { from: { height: "0" }, to: { height: "var(--radix-collapsible-content-height)" } },
        "collapse-up": { from: { height: "var(--radix-collapsible-content-height)" }, to: { height: "0" } },
        "collapsible-down": { from: { height: "0" }, to: { height: "var(--radix-collapsible-content-height)" } },
        "collapsible-up": { from: { height: "var(--radix-collapsible-content-height)" }, to: { height: "0" } },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapse-down": "collapse-down 0.2s ease-out",
        "collapse-up": "collapse-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-out",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 2.2s linear infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "spin-slow": "spin-slow 14s linear infinite",
        ticker: "ticker 36s linear infinite",
      },
    },
  },
  plugins: [typography],
};
