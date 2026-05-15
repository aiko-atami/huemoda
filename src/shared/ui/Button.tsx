import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

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
      className={["button", `button--${variant}`, `button--${size}`, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {icon === undefined ? null : <span className="button__icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
