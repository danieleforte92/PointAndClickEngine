import type { Page } from "@playwright/test";
import path from "node:path";
import type { AssetDocument, FlowDocument, ItemDocument } from "@pointclick/contracts";
import {
  loadProjectFromDirectory,
  loadProjectHistory,
  validateProjectBundle,
  validateProjectFiles
} from "../../packages/project-io/src/index";

interface EditorMockOptions {
  embeddedPreviewBaseUrl?: string;
}

export async function installEditorMock(page: Page, options: EditorMockOptions = {}) {
  const projectDirectory = path.resolve("apps/starter-game/project");
  const loaded = await loadProjectFromDirectory(projectDirectory);
  const bundle = loaded.bundle;
  const scenes = Object.values(bundle.scenes);
  const layeredScene = scenes.find((scene) => scene.type === "layered-2d") ?? null;
  const assets: AssetDocument[] = [
    ...Object.values(bundle.assets),
    {
      id: "mock-cabin-art",
      kind: "image",
      path: "assets/mock-cabin-art.svg",
      schemaVersion: 1,
      source: "imported"
    },
    {
      channel: "sfx",
      id: "mock-audio-cue",
      kind: "audio",
      path: "assets/mock-audio-cue.ogg",
      schemaVersion: 1,
      source: "imported",
      volume: 0.8
    }
  ];
  const animationPacks = Object.values(bundle.animationPacks);
  const promptPacks = Object.values(bundle.promptPacks);
  const styleBibles = Object.values(bundle.styleBibles);
  const workflowTemplates = Object.values(bundle.workflowTemplates);
  const generationRecipes = Object.values(bundle.generationRecipes);
  const existingFlows = Object.values(bundle.flows);
  const existingItems = Object.values(bundle.items);
  const locales = Object.values(bundle.locales);
  const history = await loadProjectHistory(projectDirectory);
  const diagnostics = [
    ...validateProjectBundle(bundle),
    ...(await validateProjectFiles({ directory: projectDirectory, bundle }))
  ];
  const sceneId = layeredScene?.id ?? bundle.manifest.initialSceneId;
  const items: ItemDocument[] = existingItems.length ? existingItems : [
    { id: "mock-item", labelKey: "item.mock", name: "Mock item", schemaVersion: 1 }
  ];
  const flows: FlowDocument[] = existingFlows.length ? existingFlows : [{
    id: "mock-complete-flow",
    name: "Complete graph fixture",
    nodes: [
      { id: "line", type: "line", speakerId: "narrator", textKey: "flow.mock.line", next: "set-flag" },
      { id: "set-flag", type: "set-flag", key: "mock-ready", value: true, next: "change-scene" },
      { id: "change-scene", type: "change-scene", targetSceneId: sceneId, next: "choice" },
      { id: "choice", type: "choice", promptKey: "flow.mock.choice", choices: [
        { id: "inspect", labelKey: "flow.mock.inspect", next: "condition" },
        { id: "skip", labelKey: "flow.mock.skip", next: "wait" }
      ] },
      { id: "condition", type: "condition", when: { type: "flag-equals", key: "mock-ready", value: true }, ifTrue: "sub-flow", ifFalse: "inventory" },
      { id: "sub-flow", type: "sub-flow", flowId: "mock-complete-flow", next: "inventory" },
      { id: "inventory", type: "inventory", action: "add", itemId: "mock-item", next: "wait" },
      { id: "wait", type: "wait", durationMs: 250, next: "cue" },
      { id: "cue", type: "cue", cue: { type: "sound", key: "mock-audio-cue" }, next: "end" },
      { id: "end", type: "end" }
    ],
    schemaVersion: 1,
    startNodeId: "line"
  }];
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
    ({ snapshot: editorSnapshot, generatedPromptPackJob, embeddedPreviewBaseUrl }) => {
      const imageGenerationListeners: Array<(event: unknown) => void> = [];
      const runtimeSnapshot = {
        activeFlowId: null,
        activeNodeId: null,
        audio: [],
        dialogueKey: null,
        events: ["character/moved"],
        flags: {},
        inventory: [],
        path: [],
        player: { x: 32, y: 48 },
        sceneId: editorSnapshot.activeSceneId,
        sequence: 1
      };
      const runtimeAction = {
        point: { x: 32, y: 48 },
        sequence: 0,
        type: "move-player" as const
      };
      window.pointClick = {
        applyAssetCandidate: async () => {
          const testWindow = window as typeof window & { __pointClickAppliedCandidateCount?: number };
          testWindow.__pointClickAppliedCandidateCount = (testWindow.__pointClickAppliedCandidateCount ?? 0) + 1;
          return { assetId: "mock-applied-candidate", assetPath: "assets/mock-candidate.svg", snapshot: editorSnapshot };
        },
        applyCommand: async () => editorSnapshot,
        cancelImageGeneration: async () => undefined,
        clearRecovery: async () => undefined,
        closePreviewSession: async () => undefined,
        createBlankProject: async () => editorSnapshot,
        createProjectFromStarter: async () => editorSnapshot,
        createPreviewSession: async (request) => {
          const testWindow = window as typeof window & {
            __pointClickPreviewSceneBackground?: string;
            __pointClickPreviewSceneId?: string;
          };
          testWindow.__pointClickPreviewSceneId = request.sceneId;
          const previewScene = request.sceneId ? request.bundle.scenes[request.sceneId] : undefined;
          testWindow.__pointClickPreviewSceneBackground = previewScene?.type === "layered-2d"
            ? previewScene.background
            : undefined;
          const embeddedUrl = embeddedPreviewBaseUrl
            ? new URL(embeddedPreviewBaseUrl)
            : new URL("about:blank");
          if (request.sceneId && embeddedUrl.protocol !== "about:") {
            embeddedUrl.searchParams.set("scene", request.sceneId);
          }
          return {
            browserUrl: embeddedUrl.toString(),
            embeddedUrl: embeddedUrl.toString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            id: "mock-preview-session"
          };
        },
        discardAssetCandidate: async () => undefined,
        exportWebBuild: async () => null,
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
        onImageGenerationEvent: (listener) => {
          imageGenerationListeners.push(listener as (event: unknown) => void);
          return () => {
            const index = imageGenerationListeners.indexOf(listener as (event: unknown) => void);
            if (index >= 0) imageGenerationListeners.splice(index, 1);
          };
        },
        installWorkflowPreset: async () => editorSnapshot,
        loadProject: async () => editorSnapshot,
        loadRecovery: async () => null,
        openPreview: async () => undefined,
        openPreviewInBrowser: async () => {
          const testWindow = window as typeof window & { __pointClickBrowserPreviewCount?: number };
          testWindow.__pointClickBrowserPreviewCount = (testWindow.__pointClickBrowserPreviewCount ?? 0) + 1;
        },
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
        readPreviewTelemetry: async () => ({
          actions: [runtimeAction],
          browserActions: [runtimeAction],
          browserSnapshots: [runtimeSnapshot],
          snapshots: [runtimeSnapshot]
        }),
        saveRecovery: async () => undefined,
        startImageGeneration: async (request) => {
          const testWindow = window as typeof window & {
            __pointClickLastImageRequest?: Record<string, unknown>;
          };
          testWindow.__pointClickLastImageRequest = {
            allowRemoteProvider: request.allowRemoteProvider,
            providerId: request.providerId,
            targetId: request.targetId
          };
          const queuedJob = {
            candidateIds: [],
            completed: 0,
            id: "mock-image-job",
            requested: request.batchSize ?? 1,
            status: "queued" as const
          };
          window.setTimeout(() => {
            const candidate = {
              hasAlphaPixels: false,
              height: request.height,
              id: "mock-candidate",
              mimeType: "image/svg+xml",
              model: "mock-image-v1",
              previewDataUrl: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#173442"/><circle cx="160" cy="90" r="55" fill="#d9a561"/></svg>')}`,
              provider: request.providerId === "comfyui" ? "comfyui-local" : request.providerId,
              providerJobId: "mock-provider-job",
              seed: request.seed ?? 42,
              targetId: request.targetId,
              warnings: [],
              width: request.width
            };
            const candidateJob = { ...queuedJob, candidateIds: [candidate.id], completed: 1, status: "running" as const };
            for (const listener of imageGenerationListeners) listener({ type: "candidate", candidate, job: candidateJob });
            for (const listener of imageGenerationListeners) listener({ type: "completed", job: { ...candidateJob, status: "completed" as const } });
          }, 0);
          return queuedJob;
        }
      };
    },
    {
      snapshot,
      generatedPromptPackJob: promptPackJob,
      embeddedPreviewBaseUrl: options.embeddedPreviewBaseUrl ?? null
    }
  );
}
