import {
  assertDocument,
  type FlowDocument,
  type ItemDocument,
  type LocaleDocument,
  type ProjectBundle,
  type ProjectManifest,
  type SceneDocument
} from "@pointclick/contracts";
import manifestJson from "../project/adventure.project.json";
import sceneJson from "../project/scenes/moonlit-dock.scene.json";
import lookFlowJson from "../project/flows/look-tavern-door.flow.json";
import talkFlowJson from "../project/flows/talk-tavern-door.flow.json";
import pickupFlowJson from "../project/flows/pickup-rusty-hook.flow.json";
import useHookFlowJson from "../project/flows/use-rusty-hook-on-door.flow.json";
import itemJson from "../project/items/rusty-hook.item.json";
import localeJson from "../project/locales/en.json";

assertDocument<ProjectManifest>("project", manifestJson);
assertDocument<SceneDocument>("scene", sceneJson);
assertDocument<FlowDocument>("flow", lookFlowJson);
assertDocument<FlowDocument>("flow", talkFlowJson);
assertDocument<FlowDocument>("flow", pickupFlowJson);
assertDocument<FlowDocument>("flow", useHookFlowJson);
assertDocument<LocaleDocument>("locale", localeJson);
assertDocument<ItemDocument>("item", itemJson);

export const sampleBundle: ProjectBundle = {
  manifest: manifestJson,
  scenes: {
    [sceneJson.id]: sceneJson
  },
  flows: {
    [lookFlowJson.id]: lookFlowJson,
    [talkFlowJson.id]: talkFlowJson,
    [pickupFlowJson.id]: pickupFlowJson,
    [useHookFlowJson.id]: useHookFlowJson
  },
  locales: {
    [localeJson.locale]: localeJson
  },
  items: {
    [itemJson.id]: itemJson
  },
  assets: {}
};
