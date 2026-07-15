import type { ComponentProps } from "react";
import { NarrativeGraph } from "./narrative-graph";

export type NarrativeWorkspaceProps = ComponentProps<typeof NarrativeGraph>;

/** Exclusive Narrative view boundary; gateway access stays in controllers. */
export function NarrativeWorkspace(props: NarrativeWorkspaceProps) {
  return <NarrativeGraph {...props} />;
}
