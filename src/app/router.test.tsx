import { historyAdapter } from "@effector/router";
import { allSettled, fork } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouterProvider } from "@effector/router-react";
import { routes } from "../shared/routing";
import { AppRoutes, router } from "./router";

async function forkWithPath(path: string) {
  const scope = fork();

  await allSettled(router.setHistory, {
    scope,
    params: historyAdapter(createMemoryHistory({ initialEntries: [path] })),
  });

  return scope;
}

describe("app router", () => {
  it("opens the editor route for /", async () => {
    const scope = await forkWithPath("/");

    expect(scope.getState(routes.editor.$isOpened)).toBe(true);
    expect(scope.getState(routes.lutConverter.$isOpened)).toBe(false);
  });

  it("opens the LUT converter route for /lut-converter", async () => {
    const scope = await forkWithPath("/lut-converter");

    expect(scope.getState(routes.editor.$isOpened)).toBe(false);
    expect(scope.getState(routes.lutConverter.$isOpened)).toBe(true);
  });

  it("renders the NotFound fallback for unknown paths", async () => {
    const scope = await forkWithPath("/unknown");

    const html = renderToString(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <AppRoutes />
        </RouterProvider>
      </Provider>,
    );

    expect(scope.getState(router.$activeRoutes)).toEqual([]);
    expect(html).toContain("Page not found");
  });

  it("exposes active state for navigation routes", async () => {
    const scope = await forkWithPath("/lut-converter");

    expect(scope.getState(routes.lutConverter.$isOpened)).toBe(true);
  });
});
