import { createRouter } from "@effector/router";
import { createLazyRouteView, createRoutesView } from "@effector/router-react";
import { routes } from "../shared/routing";
import { RouteLoading } from "../shared/ui";
import { NotFoundPage } from "../pages/not-found";

export const router = createRouter({
  routes: [routes.editor, routes.lutConverter],
});

const EditorView = createLazyRouteView({
  route: routes.editor,
  view: () => import("../pages/editor").then((module) => ({ default: module.EditorPage })),
  fallback: RouteLoading,
});

const LutConverterView = createLazyRouteView({
  route: routes.lutConverter,
  view: () =>
    import("../pages/lut-converter").then((module) => ({ default: module.LutConverterPage })),
  fallback: RouteLoading,
});

export const AppRoutes = createRoutesView({
  routes: [EditorView, LutConverterView],
  otherwise: NotFoundPage,
});
