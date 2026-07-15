export type ShellPanel = "navigation" | "inspector";

export interface ShellController {
  resize(width: number, delta: number, minimum?: number, maximum?: number): number;
  panelLabel(panel: ShellPanel): string;
}

export function createShellController(): ShellController {
  return {
    resize: (width, delta, minimum = 220, maximum = 520) => Math.min(maximum, Math.max(minimum, width + delta)),
    panelLabel: (panel) => (panel === "navigation" ? "Project map" : "Inspector")
  };
}
