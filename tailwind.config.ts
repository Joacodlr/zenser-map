import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Zenser brand palette. `ink` (navy) and `teal` (accent) are remapped to
        // Zenser's navy + green so the whole app re-themes from these two tokens.
        ink: "#0c2233", // Zenser navy
        slatebg: "#f5f7fa",
        // Accent kept under the "teal" key so existing usages rebrand automatically;
        // values are now Zenser green (deep = readable on white for text/buttons).
        teal: { DEFAULT: "#00c77e", soft: "#79f0c0", deep: "#0b7a54" },
        // Explicit brand tokens for logo / headline accents.
        zen: {
          green: "#00e08c", // vivid brand green (logo, highlights)
          "green-deep": "#0b7a54", // readable green for text on white
          navy: "#0c2233", // logo box / dark text
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
