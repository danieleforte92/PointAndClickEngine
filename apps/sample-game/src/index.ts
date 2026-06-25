import {
  assertDocument,
  type AnimationPackDocument,
  type AssetDocument,
  type FlowDocument,
  type ItemDocument,
  type LocaleDocument,
  type PromptPackDocument,
  type ProjectBundle,
  type ProjectManifest,
  type SceneDocument
} from "@pointclick/contracts";
import manifestJson from "../project/adventure.project.json";
import sceneJson from "../project/scenes/moonlit-dock.scene.json";
import lanternRoomSceneJson from "../project/scenes/new-scene.scene.json";
import lookFlowJson from "../project/flows/look-tavern-door.flow.json";
import talkFlowJson from "../project/flows/talk-tavern-door.flow.json";
import pickupFlowJson from "../project/flows/pickup-rusty-hook.flow.json";
import useHookFlowJson from "../project/flows/use-rusty-hook-on-door.flow.json";
import returnDockFlowJson from "../project/flows/return-to-dock.flow.json";
import itemJson from "../project/items/rusty-hook.item.json";
import localeJson from "../project/locales/en.json";
import promptPackJson from "../project/prompt-packs/moonlit-dock-art.prompt-pack.json";
import maraSpritesheetAssetJson from "../project/assets/mara-spritesheet.asset.json";
import maraAnimationPackJson from "../project/animation-packs/mara.animation-pack.json";

assertDocument<ProjectManifest>("project", manifestJson);
assertDocument<SceneDocument>("scene", sceneJson);
assertDocument<SceneDocument>("scene", lanternRoomSceneJson);
assertDocument<FlowDocument>("flow", lookFlowJson);
assertDocument<FlowDocument>("flow", talkFlowJson);
assertDocument<FlowDocument>("flow", pickupFlowJson);
assertDocument<FlowDocument>("flow", useHookFlowJson);
assertDocument<FlowDocument>("flow", returnDockFlowJson);
assertDocument<LocaleDocument>("locale", localeJson);
assertDocument<ItemDocument>("item", itemJson);
assertDocument<PromptPackDocument>("promptPack", promptPackJson);
assertDocument<AssetDocument>("asset", maraSpritesheetAssetJson);
assertDocument<AnimationPackDocument>("animationPack", maraAnimationPackJson);

export const sampleBundle: ProjectBundle = {
  manifest: manifestJson,
  scenes: {
    [sceneJson.id]: sceneJson,
    [lanternRoomSceneJson.id]: lanternRoomSceneJson
  },
  flows: {
    [lookFlowJson.id]: lookFlowJson,
    [talkFlowJson.id]: talkFlowJson,
    [pickupFlowJson.id]: pickupFlowJson,
    [useHookFlowJson.id]: useHookFlowJson,
    [returnDockFlowJson.id]: returnDockFlowJson
  },
  locales: {
    [localeJson.locale]: localeJson
  },
  items: {
    [itemJson.id]: itemJson
  },
  assets: {
    [maraSpritesheetAssetJson.id]: maraSpritesheetAssetJson
  },
  animationPacks: {
    [maraAnimationPackJson.id]: maraAnimationPackJson
  },
  promptPacks: {
    [promptPackJson.id]: promptPackJson
  }
};
