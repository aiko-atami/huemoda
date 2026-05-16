import { EditorPage } from "../pages/editor";
import { LutConverterPage } from "../pages/lut-converter";

export function App() {
  if (window.location.pathname === "/lut-converter") {
    return <LutConverterPage />;
  }

  return <EditorPage />;
}
