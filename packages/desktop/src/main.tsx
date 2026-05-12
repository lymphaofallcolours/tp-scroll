import { createRoot } from "react-dom/client";
import { StrictMode } from "react";

import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/reset.css";

import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
