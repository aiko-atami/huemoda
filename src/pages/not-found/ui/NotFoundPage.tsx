import { RouteFallback } from "../../../shared/ui";
import { css } from "styled-system/css";

const titleClass = css({
  margin: "0 0 4px",
  color: "text",
  fontSize: "18px",
  fontWeight: "700",
});

export function NotFoundPage() {
  return (
    <RouteFallback aria-label="Page not found">
      <h1 className={titleClass}>Page not found</h1>
      <p>Choose Photo Lab or LUT Converter from the navigation.</p>
    </RouteFallback>
  );
}
