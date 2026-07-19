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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // AutoFix Swarm brand colors - Modern Dark Palette
        brand: {
          black: "#000000",
          navy: "#14213D",
          yellow: "#FCA311",
          lightGray: "#E5E5E5",
          white: "#FFFFFF",
        },
        // Severity/status colors
        success: {
          DEFAULT: "hsl(158, 64%, 52%)", // #10b981 Green
          light: "hsl(158, 64%, 62%)",
          dark: "hsl(158, 64%, 42%)",
        },
        warning: {
          DEFAULT: "hsl(38, 92%, 50%)", // #f59e0b Amber
          light: "hsl(38, 92%, 60%)",
          dark: "hsl(38, 92%, 40%)",
        },
        error: {
          DEFAULT: "hsl(0, 72%, 51%)", // #dc2626 Red
          light: "hsl(0, 72%, 61%)",
          dark: "hsl(0, 72%, 41%)",
        },
        info: {
          DEFAULT: "hsl(193, 29%, 21%)", // #24434A Teal
          light: "hsl(193, 29%, 31%)",
          dark: "hsl(193, 29%, 11%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in-from-top 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
