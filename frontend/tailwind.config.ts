import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        "neutral-primary": "#fafafa",
        "neutral-secondary": "#a3a3a3",
        "brand-gold": "#fbbf24",
        "brand-gold-deep": "#d97706",
        "brand-gold-wash": "rgba(251, 191, 36, 0.1)",
        "glass-border": "rgba(255, 255, 255, 0.08)",
        "ambient-glow": "rgba(120, 53, 15, 0.2)",
        success: { DEFAULT: "#22c55e", light: "#4ade80", dark: "#16a34a" },
        warning: { DEFAULT: "#f59e0b", light: "#fbbf24", dark: "#d97706" },
        error: { DEFAULT: "#ef4444", light: "#f87171", dark: "#dc2626" },
        info: { DEFAULT: "#3b82f6", light: "#60a5fa", dark: "#2563eb" },
        brand: {
          black: "#000000",
          navy: "#14213D",
          yellow: "#FCA311",
          lightGray: "#E5E5E5",
          white: "#FFFFFF",
        },
      },
      borderRadius: {
        pill: "9999px",
        panel: "24px",
        card: "1.5rem",
        button: "9999px",
        input: "0.75rem",
      },
      spacing: {
        "header-height": "64px",
        "section-gap": "8rem",
        "card-padding": "1.5rem",
        "element-gap": "1rem",
        "container-max": "1280px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["monospace"],
      },
      fontSize: {
        display: ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "500" }],
        heading: ["2.25rem", { lineHeight: "1.2", fontWeight: "500" }],
        body: ["0.875rem", { lineHeight: "1.6", fontWeight: "300" }],
        code: ["0.75rem", { lineHeight: "1.6" }],
        label: ["0.625rem", { lineHeight: "1.6", letterSpacing: "0.1em", fontWeight: "500" }],
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "fade-in-blur-up": {
          from: { opacity: "0", transform: "translateY(24px)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        "orb-drift-1": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(30px, -20px) scale(1.05)" },
          "50%": { transform: "translate(-15px, 15px) scale(0.95)" },
          "75%": { transform: "translate(20px, 10px) scale(1.02)" },
        },
        "orb-drift-2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(-25px, 20px) scale(1.08)" },
          "66%": { transform: "translate(20px, -15px) scale(0.92)" },
        },
        "orb-drift-3": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "40%": { transform: "translate(15px, 25px) scale(1.04)" },
          "80%": { transform: "translate(-20px, -10px) scale(0.96)" },
        },
        flow: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "timeline-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.05)" },
        },
        "rise-in": {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.94)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s ease-out infinite",
        float: "float 6s ease-in-out infinite",
        "fade-in-blur-up": "fade-in-blur-up 1s cubic-bezier(0.15, 0.83, 0.66, 1) both",
        "orb-drift-1": "orb-drift-1 18s ease-in-out infinite",
        "orb-drift-2": "orb-drift-2 22s ease-in-out infinite",
        "orb-drift-3": "orb-drift-3 25s ease-in-out infinite",
        flow: "flow 2.4s linear infinite",
        "pulse-glow": "pulse-glow 2.6s ease-in-out infinite",
        "timeline-pulse": "timeline-pulse 2s ease-in-out infinite",
        "rise-in": "rise-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
}

export default config
