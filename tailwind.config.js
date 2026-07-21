/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        phantix: {
          950: "#050B1D",
          900: "#0D1B3D",
          850: "#10214A",
          800: "#16265C",
          700: "#1E3373",
          600: "#27428F",
          500: "#3355B5",
          400: "#5A7BD6",
          300: "#8FA6E6",
          200: "#C2CFF3",
          100: "#E3EAFB",
        },
        gold: {
          300: "#F3CD7E",
          400: "#E8B54D",
          500: "#D4A24E",
          600: "#B9862F",
        },
        severity: {
          critical: "#F43F5E",
          high: "#FB923C",
          medium: "#FACC15",
          low: "#38BDF8",
          info: "#94A3B8",
        },
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
        "grid-faint":
          "linear-gradient(rgba(143,166,230,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(143,166,230,0.05) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(51,85,181,0.25), transparent)",
      },
      backgroundSize: {
        grid: "44px 44px",
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
