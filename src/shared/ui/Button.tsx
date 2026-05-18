import type { ButtonHTMLAttributes, ReactNode } from "react";
import { css } from "styled-system/css";
import { buttonRecipe } from "./buttonRecipe";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const iconClass = css({
  display: "grid",
  placeItems: "center",
});

export function Button({
  children,
  className = "",
  icon,
  size = "md",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={[buttonRecipe({ variant, size }), className].filter(Boolean).join(" ")}
      {...props}
    >
      {icon === undefined ? null : <span className={iconClass}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
