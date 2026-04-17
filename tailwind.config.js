/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '"Noto Sans SC"',
          "system-ui",
          "sans-serif",
        ],
        display: ['"Outfit"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f4f6fb",
          100: "#e8ecf6",
          200: "#d5dceb",
          300: "#b3bfd9",
          400: "#8a9bc0",
          500: "#6b7da5",
          600: "#556489",
          700: "#46526f",
          800: "#3c465c",
          900: "#353c4d",
          950: "#22262f",
        },
        accent: {
          DEFAULT: "#6366f1",
          dim: "#4f46e5",
          glow: "#a5b4fc",
        },
        surface: {
          DEFAULT: "rgba(255,255,255,0.06)",
          strong: "rgba(255,255,255,0.1)",
        },
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent, rgb(15 17 24)), radial-gradient(circle at 50% 0%, rgba(99,102,241,0.15), transparent 55%)",
        mesh:
          "radial-gradient(at 40% 20%, rgba(99,102,241,0.25) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(34,211,238,0.12) 0px, transparent 45%), radial-gradient(at 10% 50%, rgba(244,114,182,0.1) 0px, transparent 45%)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
        lift: "0 24px 48px -12px rgba(0,0,0,0.45)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out forwards",
        pulseSlow: "pulseSlow 4s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.85" },
        },
      },
    },
  },
  plugins: [],
};
