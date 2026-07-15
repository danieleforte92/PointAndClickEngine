import type {
  Layered2DScene,
  PromptPackGenerationTarget,
  WorkflowTemplateDocument
} from "@pointclick/contracts";
import { Settings2 } from "lucide-react";
import type { RefObject } from "react";
import type {
  PromptProviderDescriptor,
  PromptProviderId,
  PromptProviderJob
} from "../../../prompt-pack-studio";
import type {
  ImageGenerationCandidate,
  ImageGenerationProviderId,
  ImageGenerationQueueJob
} from "../../../image-generation";
import type { AiStudioStep, GeneratedAssetHandoff } from "./ai-studio-model";

export interface AiStudioStepsProps {
  aiNextAction: string;
  aiRecipeReady: boolean;
  aiWorkflowReady: boolean;
  comfyUiGenerationStatus: string;
  currentStep: AiStudioStep;
  gameplayEmphasisPresetIds: string[];
  gameplayEmphasisPresets: ReadonlyArray<{ id: string; label: string }>;
  imageGenerationBatchSize: 1 | 2 | 3 | 4;
  imageGenerationCandidates: ImageGenerationCandidate[];
  imageGenerationJob: ImageGenerationQueueJob | null;
  imageGenerationState: "idle" | "running";
  imageGenerationTargets: PromptPackGenerationTarget[];
  imageProviderBoundary: ProviderBoundaryStatus;
  imageProviderConfigReturnFocusRef: RefObject<HTMLButtonElement | null>;
  imageProviderId: ImageGenerationProviderId;
  imageProviderOptions: ReadonlyArray<{
    detail: string;
    label: string;
    value: ImageGenerationProviderId;
  }>;
  lastGeneratedImageAsset: GeneratedAssetHandoff | null;
  layeredScenes: Layered2DScene[];
  moodPresetId: string;
  moodPresets: ReadonlyArray<{ id: string; label: string }>;
  onApplyImageCandidate: (candidate: ImageGenerationCandidate) => void | Promise<void>;
  onCancelImageGeneration: () => void | Promise<void>;
  onChangeGameplayEmphasis: (presetId: string) => void;
  onChangeImageProvider: (providerId: ImageGenerationProviderId) => void;
  onChangeImageGenerationBatchSize: (batchSize: 1 | 2 | 3 | 4) => void;
  onChangeMoodPreset: (presetId: string) => void;
  onChangePalettePreset: (presetId: string) => void;
  onChangePromptPackBrief: (brief: string) => void;
  onChangePromptPackScene: (sceneId: string) => void;
  onChangePromptProvider: (providerId: PromptProviderId) => void;
  onChangeSettingPreset: (presetId: string) => void;
  onChangeVisualStylePreset: (presetId: string) => void;
  onDiscardImageCandidate: (candidateId: string) => void | Promise<void>;
  onGenerateImageAsset: () => void | Promise<void>;
  onGeneratePromptPack: () => void | Promise<void>;
  onOpenAiAdvancedSection: () => void;
  onOpenImageProviderConfig: (opener: HTMLButtonElement) => void;
  onOpenPromptProviderConfig: (opener: HTMLButtonElement) => void;
  promptProviderConfigReturnFocusRef: RefObject<HTMLButtonElement | null>;
  onSaveApprovedPromptPack: () => void | Promise<void>;
  onSaveSelectedGenerationRecipe: () => void | Promise<void>;
  onSelectGenerationTarget: (targetId: string) => void;
  onSelectImageCandidate: (candidateId: string) => void;
  onStepChange: (step: AiStudioStep) => void;
  palettePresetId: string;
  palettePresets: ReadonlyArray<{ id: string; label: string }>;
  projectAvailable: boolean;
  promptPackCandidate: PromptProviderJob["candidates"][number] | null;
  promptPackGenerationState: "idle" | "running";
  promptPackBrief: string;
  promptPackSceneId: string;
  promptProviderBoundary: ProviderBoundaryStatus;
  promptProviderDescriptors: ReadonlyArray<Pick<PromptProviderDescriptor, "id" | "label">>;
  promptProviderId: PromptProviderId;
  selectedEffectiveGenerationTarget: PromptPackGenerationTarget | null;
  selectedGenerationDimensions: { height: number; width: number };
  selectedGenerationTarget: PromptPackGenerationTarget | null;
  selectedImageProvider: Pick<AiImageProvider, "detail" | "label">;
  selectedImageWorkflowFamily: string;
  selectedImageCandidateId: string | null;
  selectedWorkflowTemplate: Pick<WorkflowTemplateDocument, "id"> | null;
  selectedPromptProvider: Pick<PromptProviderDescriptor, "label">;
  status: string;
  settingPresetId: string;
  settingPresets: ReadonlyArray<{ id: string; label: string }>;
  visualStylePresetId: string;
  visualStylePresets: ReadonlyArray<{ id: string; label: string }>;
}

export interface ProviderBoundaryStatus {
  detail: string;
  label: string;
  tone: "good" | "warn" | "error" | "muted";
}

interface AiImageProvider {
  detail: string;
  label: string;
}

export function AiStudioSteps({
  aiNextAction,
  aiRecipeReady,
  aiWorkflowReady,
  comfyUiGenerationStatus,
  currentStep,
  gameplayEmphasisPresetIds,
  gameplayEmphasisPresets,
  imageGenerationBatchSize,
  imageGenerationCandidates,
  imageGenerationJob,
  imageGenerationState,
  imageGenerationTargets,
  imageProviderBoundary,
  imageProviderConfigReturnFocusRef,
  imageProviderId,
  imageProviderOptions,
  lastGeneratedImageAsset,
  layeredScenes,
  moodPresetId,
  moodPresets,
  onApplyImageCandidate,
  onCancelImageGeneration,
  onChangeGameplayEmphasis,
  onChangeImageProvider,
  onChangeImageGenerationBatchSize,
  onChangeMoodPreset,
  onChangePalettePreset,
  onChangePromptPackBrief,
  onChangePromptPackScene,
  onChangePromptProvider,
  onChangeSettingPreset,
  onChangeVisualStylePreset,
  onDiscardImageCandidate,
  onGenerateImageAsset,
  onGeneratePromptPack,
  onOpenAiAdvancedSection,
  onOpenImageProviderConfig,
  onOpenPromptProviderConfig,
  promptProviderConfigReturnFocusRef,
  onSaveApprovedPromptPack,
  onSaveSelectedGenerationRecipe,
  onSelectGenerationTarget,
  onSelectImageCandidate,
  onStepChange,
  palettePresetId,
  palettePresets,
  projectAvailable,
  promptPackCandidate,
  promptPackGenerationState,
  promptPackBrief,
  promptPackSceneId,
  promptProviderBoundary,
  promptProviderDescriptors,
  promptProviderId,
  selectedEffectiveGenerationTarget,
  selectedGenerationDimensions,
  selectedGenerationTarget,
  selectedImageProvider,
  selectedImageWorkflowFamily,
  selectedImageCandidateId,
  selectedWorkflowTemplate,
  selectedPromptProvider,
  status,
  settingPresetId,
  settingPresets,
  visualStylePresetId,
  visualStylePresets
}: AiStudioStepsProps) {
  return (
    <>
      {currentStep === "brief" ? (
        <section className="overview-card ai-guided-step" aria-labelledby="ai-brief-title">
          <div className="ai-guided-step-heading">
            <div>
              <span className="overview-label">01 / Brief</span>
              <h3 id="ai-brief-title">Give the scene a clear visual point of view.</h3>
            </div>
            <span className="prompt-chip">{selectedPromptProvider.label}</span>
          </div>
          <div className="ai-guided-grid">
            <label className="prompt-studio-field">
              Scene
              <select
                disabled={!projectAvailable || layeredScenes.length === 0}
                value={promptPackSceneId}
                onChange={(event) => onChangePromptPackScene(event.target.value)}
              >
                {layeredScenes.map((scene) => (
                  <option key={`guided-scene-${scene.id}`} value={scene.id}>
                    {scene.name} ({scene.id})
                  </option>
                ))}
              </select>
            </label>
            <div className="prompt-studio-field provider-selector-field">
              <span>Prompt provider</span>
              <div className="provider-selector-row">
                <select
                  aria-label="Prompt provider"
                  value={promptProviderId}
                  onChange={(event) => onChangePromptProvider(event.target.value as PromptProviderId)}
                >
                  {promptProviderDescriptors.map((provider) => (
                    <option key={`guided-prompt-provider-${provider.id}`} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
                <button
                  ref={promptProviderConfigReturnFocusRef}
                  aria-label="Configure prompt provider"
                  className="icon-action provider-settings-button"
                  title="Configure prompt provider"
                  type="button"
                  onClick={(event) => onOpenPromptProviderConfig(event.currentTarget)}
                >
                  <Settings2 size={16} />
                </button>
              </div>
              <span className={`provider-boundary-status ${promptProviderBoundary.tone}`}>
                <span className="capability-badge compact">{promptProviderBoundary.label}</span>
                {promptProviderBoundary.detail}
              </span>
            </div>
            <label className="prompt-studio-field">
              Visual style
              <select value={visualStylePresetId} onChange={(event) => onChangeVisualStylePreset(event.target.value)}>
                {visualStylePresets.map((preset) => (
                  <option key={`guided-style-${preset.id}`} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="prompt-studio-field">
              Mood
              <select value={moodPresetId} onChange={(event) => onChangeMoodPreset(event.target.value)}>
                {moodPresets.map((preset) => (
                  <option key={`guided-mood-${preset.id}`} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="prompt-studio-field">
              Setting
              <select value={settingPresetId} onChange={(event) => onChangeSettingPreset(event.target.value)}>
                {settingPresets.map((preset) => (
                  <option key={`guided-setting-${preset.id}`} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="prompt-studio-field">
              Palette
              <select value={palettePresetId} onChange={(event) => onChangePalettePreset(event.target.value)}>
                {palettePresets.map((preset) => (
                  <option key={`guided-palette-${preset.id}`} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="prompt-studio-field ai-guided-wide-field">
              Art brief
              <textarea value={promptPackBrief} onChange={(event) => onChangePromptPackBrief(event.target.value)} />
            </label>
            <fieldset className="prompt-studio-field ai-guided-wide-field ai-guided-checklist">
              <legend>Gameplay emphasis</legend>
              <div>
                {gameplayEmphasisPresets.map((preset) => (
                  <label key={`guided-gameplay-${preset.id}`}>
                    <input
                      checked={gameplayEmphasisPresetIds.includes(preset.id)}
                      type="checkbox"
                      onChange={() => onChangeGameplayEmphasis(preset.id)}
                    />
                    <span>{preset.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="ai-guided-footer">
            <p className="ai-guided-status" aria-live="polite">
              {status}
            </p>
            <button
              className="play-action"
              disabled={!projectAvailable || !promptPackSceneId || promptPackGenerationState === "running"}
              type="button"
              onClick={() => {
                onStepChange("context");
                void onGeneratePromptPack();
              }}
            >
              {promptPackGenerationState === "running" ? "Generatingâ€¦" : "Generate Targets"}
            </button>
          </div>
        </section>
      ) : null}

      {currentStep === "context" ? (
        <section className="overview-card ai-guided-step" aria-labelledby="ai-context-title">
          <div className="ai-guided-step-heading">
            <div>
              <span className="overview-label">02 / Context</span>
              <h3 id="ai-context-title">Choose the game piece and inspect its project context.</h3>
            </div>
            <span className="prompt-chip">{imageGenerationTargets.length} target(s)</span>
          </div>
          {imageGenerationTargets.length ? (
            <div className="ai-target-list">
              {imageGenerationTargets.map((target) => (
                <button
                  className={selectedGenerationTarget?.id === target.id ? "selected" : ""}
                  key={`guided-target-${target.id}`}
                  type="button"
                  onClick={() => onSelectGenerationTarget(target.id)}
                >
                  <span>{target.intendedUse}</span>
                  <strong>{target.id}</strong>
                  <small>
                    {target.width ?? selectedGenerationDimensions.width} Ã— {target.height ?? selectedGenerationDimensions.height}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="ai-guided-empty" aria-live="polite">
              {promptPackGenerationState === "running"
                ? "Generating target suggestionsâ€¦"
                : "No targets yet. Generate a prompt pack from the Brief step."}
            </div>
          )}
          <div className="ai-guided-footer">
            <p className="ai-guided-status" aria-live="polite">
              {promptPackCandidate?.summary ?? aiNextAction}
            </p>
            <div className="ai-guided-actions">
              <button className="secondary-action" type="button" onClick={() => onStepChange("brief")}>
                Back to Brief
              </button>
              <button
                className="play-action"
                disabled={!selectedEffectiveGenerationTarget}
                type="button"
                onClick={() => onStepChange("recipe")}
              >
                Continue to Recipe
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {currentStep === "recipe" ? (
        <section className="overview-card ai-guided-step" aria-labelledby="ai-recipe-title">
          <div className="ai-guided-step-heading">
            <div>
              <span className="overview-label">03 / Recipe</span>
              <h3 id="ai-recipe-title">Lock the provider workflow and reproducible inputs.</h3>
            </div>
            <span className={`capability-badge ${aiRecipeReady ? "good" : "warn"}`}>
              {aiRecipeReady ? "Recipe saved" : "Recipe required"}
            </span>
          </div>
          <div className="ai-guided-summary-grid">
            <div><span>Target</span><strong>{selectedEffectiveGenerationTarget?.id ?? "Choose a target"}</strong></div>
            <div><span>Family</span><strong>{selectedImageWorkflowFamily}</strong></div>
            <div><span>Workflow</span><strong>{selectedWorkflowTemplate?.id ?? "Not installed"}</strong></div>
            <div><span>Output</span><strong>{selectedGenerationDimensions.width} Ã— {selectedGenerationDimensions.height}</strong></div>
          </div>
          <p className="ai-guided-callout" aria-live="polite">
            {aiRecipeReady
              ? "The recipe is stored with the project and can be reused for deterministic iterations."
              : aiWorkflowReady
                ? "Save this workflow and target combination as a reusable recipe."
                : "Install or select a compatible workflow in Advanced before saving the recipe."}
          </p>
          <div className="ai-guided-footer">
            <p className="ai-guided-status" aria-live="polite">{status}</p>
            <div className="ai-guided-actions">
              <button className="secondary-action" type="button" onClick={() => onStepChange("context")}>
                Back to Context
              </button>
              {!aiRecipeReady ? (
                <button
                  className="secondary-action"
                  disabled={!selectedWorkflowTemplate || !selectedEffectiveGenerationTarget}
                  type="button"
                  onClick={() => void onSaveSelectedGenerationRecipe()}
                >
                  Save Recipe
                </button>
              ) : null}
              <button
                className="play-action"
                disabled={!aiRecipeReady}
                type="button"
                onClick={() => onStepChange("generate")}
              >
                Continue to Generate
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {currentStep === "generate" ? (
        <section className="overview-card ai-guided-step" aria-labelledby="ai-generate-title">
          <div className="ai-guided-step-heading">
            <div>
              <span className="overview-label">04 / Generate</span>
              <h3 id="ai-generate-title">Create candidates without changing the project.</h3>
            </div>
            <span className={`capability-badge ${aiRecipeReady ? "good" : "warn"}`}>
              {aiRecipeReady ? "Ready" : "Advanced setup needed"}
            </span>
          </div>
          <div className="provider-selector-panel">
            <div className="prompt-studio-field provider-selector-field">
              <span>Image provider</span>
              <div className="provider-selector-row">
                <select
                  aria-label="Image provider"
                  value={imageProviderId}
                  onChange={(event) => onChangeImageProvider(event.target.value as ImageGenerationProviderId)}
                >
                  {imageProviderOptions.map((provider) => (
                    <option key={`guided-image-provider-${provider.value}`} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
                <button
                  ref={imageProviderConfigReturnFocusRef}
                  aria-label="Configure image provider"
                  className="icon-action provider-settings-button"
                  title="Configure image provider"
                  type="button"
                  onClick={(event) => onOpenImageProviderConfig(event.currentTarget)}
                >
                  <Settings2 size={16} />
                </button>
              </div>
              <span className={`provider-boundary-status ${imageProviderBoundary.tone}`}>
                <span className="capability-badge compact">{imageProviderBoundary.label}</span>
                {imageProviderBoundary.detail}
              </span>
            </div>
            <p className="target-customization-note image-provider-note">{selectedImageProvider.detail}</p>
          </div>
          <div className="ai-guided-summary-grid">
            <div><span>Target</span><strong>{selectedEffectiveGenerationTarget?.id ?? "Choose a target"}</strong></div>
            <div><span>Provider</span><strong>{selectedImageProvider.label}</strong></div>
            <div><span>Workflow</span><strong>{selectedWorkflowTemplate?.id ?? "Not installed"}</strong></div>
            <div><span>Output</span><strong>{selectedGenerationDimensions.width} Ã— {selectedGenerationDimensions.height}</strong></div>
          </div>
          <label className="prompt-studio-field ai-batch-field">
            Candidate batch
            <select
              value={imageGenerationBatchSize}
              onChange={(event) => onChangeImageGenerationBatchSize(Number(event.target.value) as 1 | 2 | 3 | 4)}
            >
              {[1, 2, 3, 4].map((count) => (
                <option key={`image-batch-${count}`} value={count}>
                  {count} candidate{count === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <p className="ai-guided-callout" aria-live="polite">
            {aiRecipeReady
              ? "Generated outputs stay in a temporary review queue until you explicitly apply one."
              : "Install a compatible workflow and save a recipe in Advanced before queueing the asset."}
          </p>
          <div className="ai-guided-footer">
            <p className="ai-guided-status" aria-live="polite">
              {comfyUiGenerationStatus}
            </p>
            <div className="ai-guided-actions">
              <button className="secondary-action" type="button" onClick={() => onStepChange("recipe")}>
                Back to Recipe
              </button>
              <button
                className="play-action"
                disabled={!selectedEffectiveGenerationTarget || imageGenerationState === "running"}
                type="button"
                onClick={() => {
                  if (!aiRecipeReady) {
                    onOpenAiAdvancedSection();
                    return;
                  }
                  void onGenerateImageAsset();
                }}
              >
                {!aiRecipeReady
                  ? "Open Advanced Setup"
                  : imageGenerationState === "running"
                    ? "Generatingâ€¦"
                    : "Generate Candidates"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {currentStep === "review" ? (
        <section className="overview-card ai-guided-step" aria-labelledby="ai-review-title">
          <div className="ai-guided-step-heading">
            <div>
              <span className="overview-label">05 / Review & Apply</span>
              <h3 id="ai-review-title">Approve the draft before it changes the project.</h3>
            </div>
            <span className="capability-badge good">Human approval required</span>
          </div>
          {promptPackCandidate ? (
            <div className="ai-review-summary">
              <div>
                <span>Candidate</span>
                <strong>{promptPackCandidate.promptPack.id}</strong>
                <p>{promptPackCandidate.summary}</p>
              </div>
              <div>
                <span>Prompt</span>
                <strong>Scene background</strong>
                <p>{promptPackCandidate.promptPack.outputs.sceneBackgroundPrompt}</p>
              </div>
              <div>
                <span>Provenance</span>
                <strong>{promptPackCandidate.promptPack.provenance.provider}</strong>
                <p>{promptPackCandidate.promptPack.provenance.model} Â· {promptPackCandidate.promptPack.provenance.inputHash}</p>
              </div>
            </div>
          ) : (
            <div className="ai-guided-empty">
              Generate a prompt pack or asset first. Nothing has been written to the project.
            </div>
          )}
          {imageGenerationCandidates.length ? (
            <div className="ai-candidate-grid" aria-label="Temporary image candidates">
              {imageGenerationCandidates.map((candidate) => (
                <article
                  className={selectedImageCandidateId === candidate.id ? "ai-candidate-card selected" : "ai-candidate-card"}
                  key={candidate.id}
                  onClick={() => onSelectImageCandidate(candidate.id)}
                >
                  <img src={candidate.previewDataUrl} alt={`Candidate for ${candidate.targetId}`} />
                  <div className="ai-candidate-card-body">
                    <span className="overview-label">Temporary candidate</span>
                    <strong>{candidate.targetId} Â· seed {candidate.seed}</strong>
                    <p>{candidate.provider} Â· {candidate.model} Â· {candidate.width} Ã— {candidate.height}</p>
                    <p>
                      {candidate.latencyMs === undefined ? "Latency unavailable" : `${candidate.latencyMs} ms`}
                      {" Â· "}
                      {candidate.costUsd === undefined ? "Cost unavailable" : `$${candidate.costUsd.toFixed(4)}`}
                    </p>
                    {candidate.warnings.map((warning) => (
                      <p className="ai-candidate-warning" key={warning}>{warning}</p>
                    ))}
                    <div className="ai-candidate-actions">
                      <button
                        className="secondary-action compact-action"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onDiscardImageCandidate(candidate.id);
                        }}
                      >
                        Discard
                      </button>
                      <button
                        className="play-action compact-action"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onApplyImageCandidate(candidate);
                        }}
                      >
                        Apply to Project
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="ai-guided-empty" aria-live="polite">
              {imageGenerationState === "running"
                ? `Generating ${imageGenerationJob?.requested ?? imageGenerationBatchSize} candidate(s)â€¦`
                : "No temporary image candidates. Return to Generate to create a batch."}
            </div>
          )}
          {lastGeneratedImageAsset ? (
            <p className="ai-guided-callout" aria-live="polite">
              Generated asset {lastGeneratedImageAsset.assetId} is ready for inspection.
            </p>
          ) : null}
          <div className="ai-guided-footer">
            <p className="ai-guided-status" aria-live="polite">
              {status}
            </p>
            <div className="ai-guided-actions">
              <button className="secondary-action" type="button" onClick={() => onStepChange("context")}>
                Edit Context
              </button>
              {imageGenerationState === "running" ? (
                <button className="secondary-action" type="button" onClick={() => void onCancelImageGeneration()}>
                  Cancel Generation
                </button>
              ) : null}
              <button className="secondary-action" type="button" onClick={onOpenAiAdvancedSection}>
                Open Advanced
              </button>
              <button
                className="play-action"
                disabled={!promptPackCandidate}
                type="button"
                onClick={() => void onSaveApprovedPromptPack()}
              >
                Save Approved Pack
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
