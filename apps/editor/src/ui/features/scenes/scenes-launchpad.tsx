import { SceneTree, type SceneTreeProps } from "./scene-tree";
import { SceneViewport, type SceneViewportProps } from "./scene-viewport";
import {
  ScenesWorkspace,
  type ScenesWorkspaceModel
} from "./scenes-workspace";

type ActionKeys<T> = {
  [Key in keyof T]-?: T[Key] extends (...args: never[]) => unknown ? Key : never;
}[keyof T];

type ModelPart<T> = Omit<T, ActionKeys<T>>;
type ActionsPart<T> = Pick<T, ActionKeys<T>>;

export interface ScenesLaunchpadModel {
  viewport: ModelPart<SceneViewportProps>;
  workspace: ScenesWorkspaceModel;
}

export interface ScenesLaunchpadActions {
  viewport: ActionsPart<SceneViewportProps>;
}

export interface ScenesLaunchpadProps {
  actions: ScenesLaunchpadActions;
  model: ScenesLaunchpadModel;
}

export interface SceneTreeLaunchpadProps {
  actions: ActionsPart<SceneTreeProps>;
  model: ModelPart<SceneTreeProps>;
}

/** Scene navigator boundary for the parallel Scenes workstream. */
export function SceneTreeLaunchpad({ actions, model }: SceneTreeLaunchpadProps) {
  return <SceneTree {...model} {...actions} />;
}

/** Scene viewport boundary for the parallel Scenes workstream. */
export function ScenesLaunchpad({ actions, model }: ScenesLaunchpadProps) {
  return (
    <ScenesWorkspace model={model.workspace}>
      <SceneViewport {...model.viewport} {...actions.viewport} />
    </ScenesWorkspace>
  );
}
