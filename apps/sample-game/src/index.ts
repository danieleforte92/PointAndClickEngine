import {
  assertDocument,
  type FlowDocument,
  type LocaleDocument,
  type ProjectBundle,
  type ProjectManifest,
  type SceneDocument
} from "@pointclick/contracts";
import manifestJson from "../project/adventure.project.json";
import sceneJson from "../project/scenes/moonlit-dock.scene.json";
import flowJson from "../project/flows/inspect-tavern-door.flow.json";
import localeJson from "../project/locales/en.json";

assertDocument<ProjectManifest>("project", manifestJson);
assertDocument<SceneDocument>("scene", sceneJson);
assertDocument<FlowDocument>("flow", flowJson);
assertDocument<LocaleDocument>("locale", localeJson);

export const sampleBundle: ProjectBundle = {
  manifest: manifestJson,
  scenes: {
    [sceneJson.id]: sceneJson
  },
  flows: {
    [flowJson.id]: flowJson
  },
  locales: {
    [localeJson.locale]: localeJson
  }
};

