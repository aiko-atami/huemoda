import { Link } from "@effector/router-react";
import { useIsOpened } from "@effector/router-react";
import type { Route } from "@effector/router";
import { Palette, Grid3X3 } from "lucide-react";
import { routes } from "../../../shared/routing";
import { css, cx } from "styled-system/css";

const navClass = css({
  display: "flex",
  alignItems: "center",
  gap: "0",
  height: "40px",
  paddingInline: "12px",
  borderBottom: "1px solid",
  borderColor: "outline",
  background: "rgba(15, 12, 27, 0.96)",
  backdropFilter: "blur(12px)",
  zIndex: "10",
});

const brandClass = css({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginRight: "16px",
  color: "secondary",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  userSelect: "none",
});

const linkGroupClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2px",
  height: "100%",
});

const linkClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  height: "100%",
  padding: "0 10px",
  border: "0",
  borderBottom: "2px solid transparent",
  background: "transparent",
  color: "text.dim",
  fontSize: "12px",
  fontWeight: "600",
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "color 140ms ease, border-color 140ms ease",
  _hover: {
    color: "text.muted",
  },
});

const linkActiveClass = css({
  color: "text !important",
  borderBottomColor: "primary !important",
});

function NavLink({
  route,
  icon,
  children,
}: {
  route: Route<void>;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isActive = useIsOpened(route);

  return (
    <Link to={route} className={cx(linkClass, isActive ? linkActiveClass : undefined)}>
      {icon}
      {children}
    </Link>
  );
}

export function NavBar() {
  return (
    <nav className={navClass} aria-label="Main navigation">
      <span className={brandClass}>HueModa</span>

      <div className={linkGroupClass}>
        <NavLink route={routes.editor} icon={<Palette size={14} />}>
          Photo Lab
        </NavLink>
        <NavLink route={routes.lutConverter} icon={<Grid3X3 size={14} />}>
          LUT Converter
        </NavLink>
      </div>
    </nav>
  );
}
