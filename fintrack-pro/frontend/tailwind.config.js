/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12213A",
          light: "#1B3153",
          dark: "#0B1526",
        },
        paper: "#F5F7FA",
        emerald: {
          DEFAULT: "#1E7A5F",
          light: "#2E9C7A",
          dark: "#15563F",
        },
        coral: {
          DEFAULT: "#E4572E",
          light: "#F17A54",
        },
        gold: "#C9A227",
        slate: {
          text: "#4A5568",
        },
      },
      fontFamily: {
        display: ["'Source Serif 4'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        ledger: "0 1px 0 rgba(18,33,58,0.08)",
        card: "0 1px 2px rgba(18,33,58,0.04), 0 8px 24px -12px rgba(18,33,58,0.12)",
        "card-hover": "0 4px 10px rgba(18,33,58,0.06), 0 16px 32px -12px rgba(18,33,58,0.18)",
        glow: "0 0 0 1px rgba(46,156,122,0.15), 0 8px 30px -8px rgba(30,122,95,0.35)",
      },
      backgroundImage: {
        "ink-radial":
          "radial-gradient(120% 140% at 100% 0%, rgba(46,156,122,0.35) 0%, rgba(18,33,58,0) 45%), radial-gradient(120% 140% at 0% 100%, rgba(201,162,39,0.18) 0%, rgba(18,33,58,0) 45%)",
        "paper-fade": "radial-gradient(120% 120% at 50% -10%, rgba(30,122,95,0.06) 0%, rgba(245,247,250,0) 55%)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out both",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
