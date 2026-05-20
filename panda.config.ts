import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: false,
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  importMap: "styled-system",

  conditions: {
    extend: {
      // Base UI data attribute conditions
      dataChecked: "&[data-checked]",
      dataUnchecked: "&[data-unchecked]",
      dataDisabled: "&[data-disabled], &:disabled",
      dataHighlighted: "&[data-highlighted]",
      dataSelected: "&[data-selected]",
      dataPlaceholder: "&[data-placeholder]",
      // Group variants (parent has the data attribute)
      groupDataChecked: "[data-checked] &",
      groupDataDisabled: "[data-disabled] &, :disabled &",
    },
  },

  theme: {
    tokens: {},
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
          DEFAULT: { value: "var(--radius)" },
          sm: { value: "var(--radius-sm)" },
          md: { value: "var(--radius-md)" },
          lg: { value: "var(--radius-lg)" },
          full: { value: "9999px" },
        },
        fonts: {
          app: { value: "var(--font-sans)" },
        },
      },

      textStyles: {
        "display-lg": {
          value: {
            fontFamily: "var(--font-sans)",
            fontSize: "48px",
            fontWeight: "700",
            lineHeight: "56px",
            letterSpacing: "-0.02em",
          },
        },
        "headline-md": {
          value: {
            fontFamily: "var(--font-sans)",
            fontSize: "24px",
            fontWeight: "600",
            lineHeight: "32px",
            letterSpacing: "-0.01em",
          },
        },
        "headline-sm": {
          value: {
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            fontWeight: "600",
            lineHeight: "24px",
          },
        },
        "body-lg": {
          value: {
            fontFamily: "var(--font-sans)",
            fontSize: "16px",
            fontWeight: "400",
            lineHeight: "24px",
          },
        },
        "body-md": {
          value: {
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: "400",
            lineHeight: "20px",
          },
        },
        "label-md": {
          value: {
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: "500",
            lineHeight: "16px",
            letterSpacing: "0.01em",
          },
        },
        "label-sm": {
          value: {
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: "600",
            lineHeight: "14px",
            letterSpacing: "0.02em",
          },
        },
      },
    },
  },
});
