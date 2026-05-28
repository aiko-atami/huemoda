import { createRouter } from "@effector/router";
import { createRouteView, createRoutesView } from "@effector/router-react";
import { routes } from "../shared/routing";
import { EditorPage } from "../pages/editor";
import { LutConverterPage } from "../pages/lut-converter";

export const router = createRouter({
  routes: [routes.editor, routes.lutConverter],
});

const EditorView = createRouteView({
  route: routes.editor,
  view: EditorPage,
});

const LutConverterView = createRouteView({
  route: routes.lutConverter,
  view: LutConverterPage,
});

export const AppRoutes = createRoutesView({
  routes: [EditorView, LutConverterView],
});
