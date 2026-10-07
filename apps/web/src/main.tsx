import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// After a deploy, the offline cache first serves the old app while the new one installs; once
// it takes over, reload so an open page never runs old code against the new API.
registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
