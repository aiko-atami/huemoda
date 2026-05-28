import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "effector-react";
import { fork, allSettled } from "effector";
import { historyAdapter } from "@effector/router";
import { createBrowserHistory } from "history";
import { router } from "./app/router";
import { App } from "./app/App";
import "./app/model";
import "./app/styles/index.css";

async function render() {
  const rootElement = document.getElementById("root");

  if (rootElement === null) {
    throw new Error("Root element not found");
  }

  const scope = fork();

  await allSettled(router.setHistory, {
    scope,
    params: historyAdapter(createBrowserHistory()),
  });

  createRoot(rootElement).render(
    <StrictMode>
      <Provider value={scope}>
        <App />
      </Provider>
    </StrictMode>,
  );
}

void render();
