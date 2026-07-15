import type { PropsWithChildren } from "react";

export function ShellWorkspace({ children }: PropsWithChildren) {
  return <div className="shell-feature-workspace" data-feature="shell">{children}</div>;
}
