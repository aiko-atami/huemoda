import { RouterProvider } from "@effector/router-react";
import { router, AppRoutes } from "./router";
import { NavBar } from "../widgets/nav-bar";

export function App() {
  return (
    <RouterProvider router={router}>
      <NavBar />
      <AppRoutes />
    </RouterProvider>
  );
}
