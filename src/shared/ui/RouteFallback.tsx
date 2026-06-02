import type { ReactNode } from "react";
import { css } from "styled-system/css";

const routeFallbackClass = css({
  display: "grid",
  minHeight: "calc(100dvh - 40px)",
  placeItems: "center",
  padding: "24px",
  color: "text.dim",
});

const routeFallbackPanelClass = css({
  maxWidth: "360px",
  padding: "16px",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "lg",
  background: "surface",
  textAlign: "center",
});

export function RouteFallback({
  "aria-label": ariaLabel,
  children,
}: {
  "aria-label": string;
  children?: ReactNode;
}) {
  return (
    <main aria-label={ariaLabel} className={routeFallbackClass}>
      {children === undefined ? null : (
        <section className={routeFallbackPanelClass}>{children}</section>
      )}
    </main>
  );
}
