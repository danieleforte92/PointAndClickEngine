import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorApp } from "./ui/editor-app";
import "./ui/editor.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>
);

