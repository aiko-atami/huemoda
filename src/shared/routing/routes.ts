import { createRoute } from "@effector/router";

export const routes = {
  editor: createRoute({ path: "/" }),
  lutConverter: createRoute({ path: "/lut-converter" }),
};
