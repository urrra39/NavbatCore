import type { Config } from "tailwindcss";

/**
 * Liquid Glass design tokens.
 *
 * The palette is tuned for backdrop-blur friendly translucency: low-saturation
 * base hues with high-luminance accent gradients so frosted layers don't
 * collapse into mud when stacked.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          0: "rgba(255,255,255,0.04)",
          50: "rgba(255,255,255,0.08)",
          100: "rgba(255,255,255,0.14)",
          200: "rgba(255,255,255,0.22)",
          300: "rgba(255,255,255,0.32)",
          ring: "rgba(255,255,255,0.45)",
          stroke: "rgba(255,255,255,0.18)",
        },
        navbat: {
          ink: "#070914",
          deep: "#0b1024",
          aqua: "#3ad6ff",
          violet: "#8b5cf6",
          mint: "#5eead4",
          coral: "#ff8fa3",
          amber: "#ffd166",
        },
      },
      backdropBlur: {
        xs: "2px",
        "4xl": "72px",
      },
      boxShadow: {
        glass:
          "0 10px 30px -12px rgba(7, 9, 20, 0.55), inset 0 1px 0 0 rgba(255,255,255,0.18)",
        "glass-lg":
          "0 30px 80px -24px rgba(7, 9, 20, 0.65), inset 0 1px 0 0 rgba(255,255,255,0.22)",
      },
      keyframes: {
        "frost-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) rotate(0deg)" },
          "50%": { transform: "translate3d(2%, -3%, 0) rotate(8deg)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(58,214,255,0.45)" },
          "70%": { boxShadow: "0 0 0 18px rgba(58,214,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(58,214,255,0)" },
        },
      },
      animation: {
        "frost-drift": "frost-drift 14s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"],
      },
    },
  },
  plugins: [],
};

export default config;
