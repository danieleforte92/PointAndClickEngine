import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlayerApp } from "./player-app";
import "@pointclick/ui-theme/storyboard.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>
);
