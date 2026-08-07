/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(232, 181, 77, 0.35)",
        "glow-blue": "0 0 40px -10px rgba(51, 85, 181, 0.5)",
        card: "0 8px 30px -12px rgba(2, 6, 23, 0.6)",
      },
      backgroundImage: {
        "radial-fade":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(51,85,181,0.25), transparent)",
      },
      backgroundSize: {
      },
      keyframes: {
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
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 2.2s linear infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "spin-slow": "spin-slow 14s linear infinite",
        ticker: "ticker 36s linear infinite",
      },
    },
  },
  plugins: [],
};
