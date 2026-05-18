import { cva } from "styled-system/css";

export const buttonRecipe = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    border: "1px solid transparent",
    borderRadius: "DEFAULT",
    fontWeight: "700",
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
    _disabled: {
      cursor: "not-allowed",
      opacity: "0.48",
    },
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "primary",
      outlineOffset: "2px",
    },
  },
  variants: {
    variant: {
      primary: {
        background: "primary",
        color: "primary.on",
        _hover: {
          _enabled: { background: "primary.strong" },
        },
      },
      secondary: {
        background: "surface.high",
        borderColor: "outline",
        color: "text",
        _hover: {
          _enabled: { background: "surface.highest", borderColor: "outline.strong" },
        },
      },
      ghost: {
        background: "transparent",
        borderColor: "outline",
        color: "text.muted",
        _hover: {
          _enabled: { background: "surface.highest", borderColor: "outline.strong" },
        },
      },
      danger: {
        background: "transparent",
        borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
        color: "danger",
        _hover: {
          _enabled: {
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            borderColor: "danger",
          },
        },
      },
    },
    size: {
      sm: {
        minHeight: "34px",
        padding: "6px 10px",
        fontSize: "12px",
      },
      md: {
        minHeight: "38px",
        padding: "8px 12px",
        fontSize: "13px",
      },
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "md",
  },
});
