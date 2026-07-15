import type { ComponentProps } from "react";
import { TestLab } from "./runtime-debug-view";

export type TestLabWorkspaceProps = ComponentProps<typeof TestLab>;

/** Runtime feedback view boundary. The player iframe remains behavior-neutral. */
export function TestLabWorkspace(props: TestLabWorkspaceProps) {
  return <TestLab {...props} />;
}
