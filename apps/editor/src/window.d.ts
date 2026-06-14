import type { PointClickEditorApi } from "./preload";

declare global {
  interface Window {
    pointClick: PointClickEditorApi;
  }
}

export {};
