import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: false,
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  importMap: "styled-system",

  conditions: {
    extend: {
      // Base UI Radio data attribute conditions
      dataChecked: "&[data-checked]",
      groupDataChecked: "[data-checked] &",
      dataDisabled: "&[data-disabled], &:disabled",
      dataHighlighted: "&[data-highlighted]",
    },
  },

  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: { value: "var(--background)" },
          surface: {
            DEFAULT: { value: "var(--surface)" },
            low: { value: "var(--surface-low)" },
            high: { value: "var(--surface-high)" },
            highest: { value: "var(--surface-highest)" },
            bright: { value: "var(--surface-bright)" },
          },
          text: {
            DEFAULT: { value: "var(--text)" },
            muted: { value: "var(--text-muted)" },
            dim: { value: "var(--text-dim)" },
          },
          outline: {
            DEFAULT: { value: "var(--outline)" },
            strong: { value: "var(--outline-strong)" },
          },
          primary: {
            DEFAULT: { value: "var(--primary)" },
            strong: { value: "var(--primary-strong)" },
            on: { value: "var(--on-primary)" },
          },
          secondary: { value: "var(--secondary)" },
          danger: { value: "var(--danger)" },
        },
        radii: {
          app: {
            sm: { value: "var(--radius-sm)" },
            DEFAULT: { value: "var(--radius)" },
            md: { value: "var(--radius-md)" },
            lg: { value: "var(--radius-lg)" },
          },
        },
        fonts: {
          app: { value: "var(--font-sans)" },
        },
      },
    },
  },
});
