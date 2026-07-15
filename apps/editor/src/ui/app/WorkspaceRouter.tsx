import type { PropsWithChildren } from "react";
import type { EditorNavigationTarget } from "../../editor-session";

/**
 * Typed router seam. Feature views receive navigation targets from the
 * composition root and never need to import another feature's internals.
 */
export function WorkspaceRouter({ children, target }: PropsWithChildren<{ target: EditorNavigationTarget }>) {
  void target;
  return <>{children}</>;
}
