import type { Page } from "@playwright/test";
import path from "node:path";
import {
  loadProjectFromDirectory,
  loadProjectHistory,
  validateProjectBundle,
  validateProjectFiles
} from "../../packages/project-io/src/index";

export async function installEditorMock(page: Page) {
  const projectDirectory = path.resolve("apps/starter-game/project");
  const loaded = await loadProjectFromDirectory(projectDirectory);
  const bundle = loaded.bundle;
  const scenes = Object.values(bundle.scenes);
  const layeredScene = scenes.find((scene) => scene.type === "layered-2d") ?? null;
  const assets = [
    ...Object.values(bundle.assets),
    {
      id: "mock-cabin-art",
      kind: "image",
      path: "assets/mock-cabin-art.svg",
      schemaVersion: 1,
      source: "imported"
    }
  ];
  const animationPacks = Object.values(bundle.animationPacks);
  const promptPacks = Object.values(bundle.promptPacks);
  const styleBibles = Object.values(bundle.styleBibles);
  const workflowTemplates = Object.values(bundle.workflowTemplates);
  const generationRecipes = Object.values(bundle.generationRecipes);
  const flows = Object.values(bundle.flows);
  const items = Object.values(bundle.items);
  const locales = Object.values(bundle.locales);
  const history = await loadProjectHistory(projectDirectory);
  const diagnostics = [
    ...validateProjectBundle(bundle),
    ...(await validateProjectFiles({ directory: projectDirectory, bundle }))
  ];
  const sceneId = layeredScene?.id ?? bundle.manifest.initialSceneId;
  const promptPackJob = {
    id: "mock-editor-ai-test",
    provider: "mock",
    status: "completed",
    candidates: [
      {
        promptPack: {
          schemaVersion: 1,
          id: "mock-new-scene-art",
          name: "New Scene Mock Prompt Pack",
          sceneId,
          artBrief: "A readable adventure scene for the editor UX test.",
          context: {
            projectTitle: bundle.manifest.title,
            sceneId,
            sceneName: layeredScene?.name ?? "Scene",
            sceneSize: layeredScene?.size ?? { width: 1280, height: 720 },
            artBrief: "A readable adventure scene for the editor UX test.",
            locale: bundle.manifest.defaultLocale,
            labels: {},
            hotspots: [],
            actors: [],
            pickups: [],
            items: []
          },
          outputs: {
            sceneBackgroundPrompt: "Readable scene background for the editor UX test.",
            propPrompts: [],
            characterReferencePrompts: [],
            animationNotes: [],
            negativePrompt: "",
            styleNotes: [],
            generationTargets: [
              {
                id: `${sceneId}-background`,
                backgroundMode: "opaque-scene",
                expectedAlpha: false,
                intendedUse: "scene-background",
                marginPercent: 0,
                safetyNegativePrompt: "text, logo, watermark",
                sourceEntityId: sceneId,
                sourceEntityKind: "scene",
                width: layeredScene?.size.width ?? 1280,
                height: layeredScene?.size.height ?? 720,
                transparent: false
              }
            ]
          },
          suggestedActors: [],
          provenance: {
            provider: "mock",
            model: "creator-alpha-mock-v1",
            generatedAt: "2026-01-01T00:00:00.000Z",
            inputHash: "editor-ai-test",
            jobId: "mock-editor-ai-test",
            seed: "editor-ai-test"
          }
        },
        summary: "1 target(s), 0 prop prompt(s), 0 character prompt(s)."
      }
    ]
  };

  const snapshot = {
    activeActorId: layeredScene?.actors[0]?.id ?? null,
    activeAssetId: assets[0]?.id ?? null,
    activeFlowId: flows[0]?.id ?? null,
    activeHotspotId: layeredScene?.hotspots[0]?.id ?? null,
    activeItemId: items[0]?.id ?? null,
    activeLocale: locales[0]?.locale ?? null,
    activePickupId: layeredScene?.pickups[0]?.id ?? null,
    activeSceneId: layeredScene?.id ?? bundle.manifest.initialSceneId,
    assetCount: assets.length,
    assets,
    animationPackCount: animationPacks.length,
    animationPacks,
    directory: "starter-game/project",
    diagnostics,
    flowCount: flows.length,
    flows,
    itemCount: items.length,
    items,
    localeCount: locales.length,
    locales,
    manifest: bundle.manifest,
    promptPackCount: promptPacks.length,
    promptPacks,
    sceneCount: scenes.length,
    scenes,
    selectedAsset: assets[0] ?? null,
    selectedActor: layeredScene?.actors[0] ?? null,
    selectedAnimationPack: animationPacks[0] ?? null,
    selectedFlow: flows[0] ?? null,
    selectedHotspot: layeredScene?.hotspots[0] ?? null,
    selectedItem: items[0] ?? null,
    selectedLocale: locales[0] ?? null,
    selectedPickup: layeredScene?.pickups[0] ?? null,
    selectedScene: layeredScene,
    styleBibleCount: styleBibles.length,
    styleBibles,
    workflowTemplateCount: workflowTemplates.length,
    workflowTemplates,
    generationRecipeCount: generationRecipes.length,
    generationRecipes,
    historyRecords: history.records.slice(-12).reverse(),
    historyRecordCount: history.records.length
  };

  await page.addInitScript(
    ({ snapshot: editorSnapshot, generatedPromptPackJob }) => {
      window.pointClick = {
        applyCommand: async () => editorSnapshot,
        clearRecovery: async () => undefined,
        createBlankProject: async () => editorSnapshot,
        createProjectFromStarter: async () => editorSnapshot,
        importAssetFiles: async () => ({ assetIds: [], snapshot: editorSnapshot }),
        importAssets: async () => editorSnapshot,
        generatePromptPack: async (request) => {
          const testWindow = window as typeof window & {
            __pointClickLastPromptPackRequest?: Record<string, unknown>;
          };
          testWindow.__pointClickLastPromptPackRequest = {
            allowRemoteProvider: request.allowRemoteProvider,
            lmStudioBaseUrl: request.lmStudioBaseUrl,
            lmStudioModel: request.lmStudioModel,
            openAiBaseUrl: request.openAiBaseUrl,
            openAiModel: request.openAiModel,
            providerId: request.providerId
          };
          return generatedPromptPackJob;
        },
        generateAuthoringSuggestions: async () => [],
        generateImageAsset: async (request) => {
          const testWindow = window as typeof window & {
            __pointClickLastImageRequest?: Record<string, unknown>;
          };
          testWindow.__pointClickLastImageRequest = {
            allowRemoteProvider: request.allowRemoteProvider,
            providerId: request.providerId,
            targetId: request.targetId
          };
          return {
            status: "failed",
            message: "Image generation is intentionally mocked in this browser test."
          };
        },
        installWorkflowPreset: async () => editorSnapshot,
        loadProject: async () => editorSnapshot,
        loadRecovery: async () => null,
        openPreview: async () => undefined,
        openInBrowser: async () => undefined,
        pickProject: async () => editorSnapshot,
        saveProcessedImageAsset: async () => ({ assetIds: [], snapshot: editorSnapshot }),
        resolveAssetUrl: async () =>
          `data:image/svg+xml,${encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#173442"/><path d="M0 400 220 250 390 380 570 190 960 430V540H0Z" fill="#28566a"/><path d="M270 370V250h250v120" fill="#d9a561"/><path d="m245 250 140-105 140 105Z" fill="#7c4b3d"/><rect x="350" y="290" width="70" height="80" rx="4" fill="#173442"/><rect x="465" y="280" width="34" height="34" fill="#c4e2e0"/><circle cx="790" cy="110" r="42" fill="#d9a561" opacity=".8"/></svg>'
          )}`,
        runValidation: async () => ({
          ranAt: new Date().toISOString(),
          summary: { errorCount: 0, warningCount: 0, infoCount: 0 },
          diagnostics: []
        }),
        saveRecovery: async () => undefined
      };
    },
    { snapshot, generatedPromptPackJob: promptPackJob }
  );
}
