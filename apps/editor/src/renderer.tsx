import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorApp } from "./ui/editor-app";
import "@pointclick/ui-theme/studio.css";
import "./ui/editor-entry.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>
);
