import { cva } from "styled-system/css";

export const uploadButtonRecipe = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "34px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: "DEFAULT",
    cursor: "pointer",
    fontWeight: "700",
    transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
    "& input": {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
    },
    _focusWithin: {
      outline: "2px solid",
      outlineColor: "primary",
      outlineOffset: "2px",
    },
    "&:has(input:disabled)": {
      cursor: "not-allowed",
      opacity: "0.48",
    },
    "&[data-dragging]": {
      borderColor: "primary",
      background: "surface.highest",
      color: "primary",
    },
  },
  variants: {
    variant: {
      compact: {
        padding: "6px 10px",
        borderColor: "outline",
        background: "surface.high",
        color: "text",
        fontSize: "12px",
        "@media (max-width: 560px)": {
          flex: "1 1 auto",
        },
      },
      empty: {
        display: "grid",
        width: "min(360px, 100%)",
        minHeight: "164px",
        alignContent: "center",
        justifyItems: "center",
        padding: "24px",
        borderStyle: "dashed",
        borderColor: "outline.strong",
        borderRadius: "lg",
        background: "rgba(27, 22, 45, 0.9)",
        color: "text",
        pointerEvents: "auto",
        "& span": {
          marginTop: "10px",
          fontSize: "16px",
        },
      },
    },
  },
  defaultVariants: {
    variant: "compact",
  },
});
