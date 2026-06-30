import { type Static, Type } from "@sinclair/typebox";

const Id = Type.String({ minLength: 1, pattern: "^[a-z0-9][a-z0-9-]*$" });
const HexColor = Type.String({ pattern: "^#[0-9a-fA-F]{6}$" });
const ProjectPath = Type.String({ minLength: 1, pattern: "^(?!/)(?![A-Za-z]:)(?!.*\\.\\.).+$" });
export const HotspotCursorSchema = Type.Union([
  Type.Literal("look"),
  Type.Literal("talk"),
  Type.Literal("use"),
  Type.Literal("enter")
]);
export const VerbSchema = Type.Union([
  Type.Literal("walk"),
  Type.Literal("look"),
  Type.Literal("use"),
  Type.Literal("talk")
]);

export const Vector2Schema = Type.Object(
  {
    x: Type.Number(),
    y: Type.Number()
  },
  { additionalProperties: false }
);

export const RectSchema = Type.Object(
  {
    x: Type.Number(),
    y: Type.Number(),
    width: Type.Number({ exclusiveMinimum: 0 }),
    height: Type.Number({ exclusiveMinimum: 0 })
  },
  { additionalProperties: false }
);

export const Polygon2Schema = Type.Object(
  {
    points: Type.Array(Vector2Schema, { minItems: 3 })
  },
  { additionalProperties: false }
);

export const FlagValueSchema = Type.Union([Type.String(), Type.Number(), Type.Boolean()]);

export const ConditionExpressionSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal("flag-equals"),
      key: Type.String({ minLength: 1 }),
      value: FlagValueSchema
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      type: Type.Literal("item-in-inventory"),
      itemId: Id
    },
    { additionalProperties: false }
  )
]);

const ManifestDocumentReferenceSchema = Type.Object(
  {
    id: Id,
    path: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

export const ProjectManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    title: Type.String({ minLength: 1 }),
    initialSceneId: Id,
    defaultLocale: Type.String({ minLength: 2 }),
    viewport: Type.Object(
      {
        width: Type.Integer({ minimum: 320 }),
        height: Type.Integer({ minimum: 180 })
      },
      { additionalProperties: false }
    ),
    scenes: Type.Array(ManifestDocumentReferenceSchema, { minItems: 1 }),
    flows: Type.Array(ManifestDocumentReferenceSchema),
    items: Type.Array(ManifestDocumentReferenceSchema),
    assets: Type.Optional(Type.Array(ManifestDocumentReferenceSchema)),
    promptPacks: Type.Optional(Type.Array(ManifestDocumentReferenceSchema)),
    animationPacks: Type.Optional(Type.Array(ManifestDocumentReferenceSchema)),
    styleBibles: Type.Optional(Type.Array(ManifestDocumentReferenceSchema)),
    workflowTemplates: Type.Optional(Type.Array(ManifestDocumentReferenceSchema)),
    generationRecipes: Type.Optional(Type.Array(ManifestDocumentReferenceSchema)),
    locales: Type.Array(
      Type.Object(
        {
          locale: Type.String({ minLength: 2 }),
          path: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    )
  },
  { additionalProperties: false }
);

export const SceneShapeSchema = Type.Object(
  {
    id: Id,
    shape: Type.Union([Type.Literal("rect"), Type.Literal("ellipse")]),
    bounds: RectSchema,
    fill: HexColor,
    depth: Type.Number()
  },
  { additionalProperties: false }
);

export const HotspotUseItemFlowSchema = Type.Object(
  {
    itemId: Id,
    flowId: Id
  },
  { additionalProperties: false }
);

export const HotspotActionsSchema = Type.Object(
  {
    lookFlowId: Type.Optional(Id),
    talkFlowId: Type.Optional(Id),
    useFlowId: Type.Optional(Id),
    useItemFlows: Type.Array(HotspotUseItemFlowSchema, { default: [] })
  },
  { additionalProperties: false }
);

export const HotspotSchema = Type.Object(
  {
    id: Id,
    labelKey: Type.String({ minLength: 1 }),
    bounds: RectSchema,
    actions: HotspotActionsSchema,
    interactSpot: Type.Optional(Vector2Schema),
    lookSpot: Type.Optional(Vector2Schema),
    cursor: Type.Optional(HotspotCursorSchema)
  },
  { additionalProperties: false }
);

export const ScenePickupSchema = Type.Object(
  {
    id: Id,
    itemId: Id,
    labelKey: Type.String({ minLength: 1 }),
    assetId: Type.Optional(Id),
    bounds: RectSchema,
    interactSpot: Type.Optional(Vector2Schema),
    lookSpot: Type.Optional(Vector2Schema),
    pickupFlowId: Type.Optional(Id)
  },
  { additionalProperties: false }
);

export const SceneActorRoleSchema = Type.Union([
  Type.Literal("prop"),
  Type.Literal("pickup"),
  Type.Literal("npc"),
  Type.Literal("exit"),
  Type.Literal("decoration")
]);

export const SceneActorSchema = Type.Object(
  {
    id: Id,
    role: SceneActorRoleSchema,
    labelKey: Type.String({ minLength: 1 }),
    assetId: Type.Optional(Id),
    animationPackId: Type.Optional(Id),
    bounds: RectSchema,
    depth: Type.Number(),
    visibleWhen: Type.Optional(ConditionExpressionSchema),
    interactSpot: Type.Optional(Vector2Schema),
    lookSpot: Type.Optional(Vector2Schema),
    actions: HotspotActionsSchema
  },
  { additionalProperties: false }
);

export const ScenePlayerConfigSchema = Type.Object(
  {
    assetId: Type.Optional(Id),
    animationPackId: Type.Optional(Id),
    scaleFar: Type.Optional(Type.Number({ minimum: 0.05 })),
    scaleNear: Type.Optional(Type.Number({ minimum: 0.05 })),
    walkSpeed: Type.Optional(Type.Number({ minimum: 1 }))
  },
  { additionalProperties: false }
);

export const SceneLayerSchema = Type.Object(
  {
    id: Id,
    name: Type.String({ minLength: 1 }),
    assetId: Id,
    depth: Type.Number(),
    opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    visible: Type.Optional(Type.Boolean()),
    locked: Type.Optional(Type.Boolean()),
    bounds: Type.Optional(RectSchema)
  },
  { additionalProperties: false }
);

export const SceneGenerationGuideRoleSchema = Type.Union([
  Type.Literal("background"),
  Type.Literal("foreground"),
  Type.Literal("layer"),
  Type.Literal("prop"),
  Type.Literal("pickup"),
  Type.Literal("actor"),
  Type.Literal("npc"),
  Type.Literal("player"),
  Type.Literal("hotspot"),
  Type.Literal("context"),
  Type.Literal("mask")
]);

export const SceneGenerationGuideSourceSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("scene"),
      Type.Literal("background"),
      Type.Literal("player"),
      Type.Literal("layer"),
      Type.Literal("actor"),
      Type.Literal("pickup"),
      Type.Literal("hotspot")
    ]),
    id: Type.Optional(Id)
  },
  { additionalProperties: false }
);

export const SceneGenerationGuideShapeSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal("rect"),
      bounds: RectSchema
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      type: Type.Literal("ellipse"),
      bounds: RectSchema
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      type: Type.Literal("polygon"),
      points: Type.Array(Vector2Schema, { minItems: 3 })
    },
    { additionalProperties: false }
  )
]);

export const SceneGenerationGuideSchema = Type.Object(
  {
    id: Id,
    name: Type.String({ minLength: 1 }),
    role: SceneGenerationGuideRoleSchema,
    tags: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    source: Type.Optional(SceneGenerationGuideSourceSchema),
    shape: SceneGenerationGuideShapeSchema,
    visible: Type.Optional(Type.Boolean()),
    locked: Type.Optional(Type.Boolean()),
    color: Type.Optional(HexColor)
  },
  { additionalProperties: false }
);

export const Layered2DSceneSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    type: Type.Literal("layered-2d"),
    size: Type.Object(
      {
        width: Type.Integer({ minimum: 320 }),
        height: Type.Integer({ minimum: 180 })
      },
      { additionalProperties: false }
    ),
    background: Type.String({ minLength: 1 }),
    layers: Type.Optional(Type.Array(SceneLayerSchema)),
    player: Type.Optional(ScenePlayerConfigSchema),
    playerStart: Vector2Schema,
    walkArea: Polygon2Schema,
    generationGuides: Type.Optional(Type.Array(SceneGenerationGuideSchema)),
    actors: Type.Array(SceneActorSchema),
    pickups: Type.Array(ScenePickupSchema),
    shapes: Type.Array(SceneShapeSchema),
    hotspots: Type.Array(HotspotSchema)
  },
  { additionalProperties: false }
);

export const Hybrid3DSceneSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    type: Type.Literal("hybrid-3d"),
    gltfAssetId: Id,
    playerStart: Type.Object(
      {
        x: Type.Number(),
        y: Type.Number(),
        z: Type.Number()
      },
      { additionalProperties: false }
    ),
    hotspots: Type.Array(HotspotSchema)
  },
  { additionalProperties: false }
);

export const SceneDocumentSchema = Type.Union([Layered2DSceneSchema, Hybrid3DSceneSchema]);

const FlowLineNodeSchema = Type.Object(
  {
    id: Id,
    type: Type.Literal("line"),
    speakerId: Id,
    textKey: Type.String({ minLength: 1 }),
    next: Id
  },
  { additionalProperties: false }
);

const FlowSetFlagNodeSchema = Type.Object(
  {
    id: Id,
    type: Type.Literal("set-flag"),
    key: Type.String({ minLength: 1 }),
    value: Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
    next: Id
  },
  { additionalProperties: false }
);

const FlowChangeSceneNodeSchema = Type.Object(
  {
    id: Id,
    type: Type.Literal("change-scene"),
    targetSceneId: Id,
    playerStart: Type.Optional(Vector2Schema),
    next: Id
  },
  { additionalProperties: false }
);

const FlowEndNodeSchema = Type.Object(
  {
    id: Id,
    type: Type.Literal("end")
  },
  { additionalProperties: false }
);

export const FlowNodeSchema = Type.Union([
  FlowLineNodeSchema,
  FlowSetFlagNodeSchema,
  FlowChangeSceneNodeSchema,
  FlowEndNodeSchema
]);

export const FlowDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    startNodeId: Id,
    nodes: Type.Array(FlowNodeSchema, { minItems: 1 })
  },
  { additionalProperties: false }
);

export const LocaleDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    locale: Type.String({ minLength: 2 }),
    strings: Type.Record(Type.String(), Type.String())
  },
  { additionalProperties: false }
);

export const ItemDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    labelKey: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

export const AssetKindSchema = Type.Union([Type.Literal("image")]);
export const AssetSourceSchema = Type.Union([
  Type.Literal("imported"),
  Type.Literal("generated"),
  Type.Literal("processed")
]);

export const WorkflowFamilySchema = Type.Union([
  Type.Literal("background_t2i_fast"),
  Type.Literal("background_img2img_layout"),
  Type.Literal("scene_inpaint_masked"),
  Type.Literal("prop_isolated_alpha_or_chroma"),
  Type.Literal("character_reference_sheet"),
  Type.Literal("sprite_sheet_reference"),
  Type.Literal("style_reference_generation"),
  Type.Literal("micro_animation_i2v")
]);

export const AssetGenerationMetadataSchema = Type.Object(
  {
    provider: Type.String({ minLength: 1 }),
    generatedAt: Type.Optional(Type.String({ format: "date-time" })),
    model: Type.Optional(Type.String({ minLength: 1 })),
    workflowId: Type.Optional(Id),
    workflowFamily: Type.Optional(WorkflowFamilySchema),
    recipeId: Type.Optional(Id),
    promptPackId: Type.Optional(Id),
    targetId: Type.Optional(Id),
    seed: Type.Optional(Type.Union([Type.String(), Type.Number()])),
    prompt: Type.Optional(
      Type.Object(
        {
          positive: Type.String({ minLength: 1 }),
          negative: Type.Optional(Type.String())
        },
        { additionalProperties: false }
      )
    ),
    dimensions: Type.Optional(
      Type.Object(
        {
          width: Type.Integer({ minimum: 1 }),
          height: Type.Integer({ minimum: 1 })
        },
        { additionalProperties: false }
      )
    ),
    parentAssetIds: Type.Optional(Type.Array(Id)),
    referenceAssetIds: Type.Optional(Type.Array(Id)),
    maskAssetId: Type.Optional(Id),
    guideIds: Type.Optional(Type.Array(Id)),
    warnings: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
  },
  { additionalProperties: false }
);

export const AssetDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    kind: AssetKindSchema,
    path: ProjectPath,
    source: AssetSourceSchema,
    generation: Type.Optional(AssetGenerationMetadataSchema)
  },
  { additionalProperties: false }
);

export const WorkflowInputKindSchema = Type.Union([
  Type.Literal("prompt"),
  Type.Literal("negative-prompt"),
  Type.Literal("seed"),
  Type.Literal("dimensions"),
  Type.Literal("checkpoint"),
  Type.Literal("reference-image"),
  Type.Literal("mask-image"),
  Type.Literal("output-prefix")
]);

export const WorkflowOutputModeSchema = Type.Union([
  Type.Literal("opaque-image"),
  Type.Literal("alpha-image"),
  Type.Literal("chroma-image"),
  Type.Literal("image-sequence"),
  Type.Literal("video")
]);

export const WorkflowTemplateBindingSchema = Type.Object(
  {
    input: WorkflowInputKindSchema,
    nodeId: Type.String({ minLength: 1 }),
    inputKey: Type.String({ minLength: 1 }),
    required: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);

export const WorkflowTemplateDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    family: WorkflowFamilySchema,
    workflowPath: ProjectPath,
    outputMode: WorkflowOutputModeSchema,
    hardwareProfile: Type.Optional(Type.String({ minLength: 1 })),
    supportedInputs: Type.Array(WorkflowInputKindSchema, { minItems: 1 }),
    bindings: Type.Array(WorkflowTemplateBindingSchema),
    output: Type.Object(
      {
        nodeId: Type.String({ minLength: 1 }),
        kind: WorkflowOutputModeSchema
      },
      { additionalProperties: false }
    ),
    notes: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
  },
  { additionalProperties: false }
);

export const StyleBibleDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    medium: Type.String({ minLength: 1 }),
    palette: Type.Array(Type.String({ minLength: 1 })),
    camera: Type.Optional(Type.String({ minLength: 1 })),
    linework: Type.Optional(Type.String({ minLength: 1 })),
    lighting: Type.Optional(Type.String({ minLength: 1 })),
    negativePrompt: Type.Optional(Type.String()),
    forbidden: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    referenceAssetIds: Type.Optional(Type.Array(Id)),
    loraTags: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
  },
  { additionalProperties: false }
);

export const AssetGenerationRecipeAssetTypeSchema = Type.Union([
  Type.Literal("background"),
  Type.Literal("prop"),
  Type.Literal("character"),
  Type.Literal("sprite-sheet"),
  Type.Literal("animation")
]);

export const AssetGenerationRecipeDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    sceneId: Type.Optional(Id),
    promptPackId: Type.Optional(Id),
    targetId: Type.Optional(Id),
    assetType: AssetGenerationRecipeAssetTypeSchema,
    workflowFamily: WorkflowFamilySchema,
    workflowId: Id,
    styleBibleId: Type.Optional(Id),
    resolution: Type.Object(
      {
        width: Type.Integer({ minimum: 1 }),
        height: Type.Integer({ minimum: 1 })
      },
      { additionalProperties: false }
    ),
    prompt: Type.Object(
      {
        positive: Type.String({ minLength: 1 }),
        negative: Type.Optional(Type.String())
      },
      { additionalProperties: false }
    ),
    inputs: Type.Optional(
      Type.Object(
        {
          referenceAssetIds: Type.Optional(Type.Array(Id)),
          maskAssetId: Type.Optional(Id),
          guideIds: Type.Optional(Type.Array(Id)),
          parentAssetIds: Type.Optional(Type.Array(Id))
        },
        { additionalProperties: false }
      )
    ),
    generation: Type.Object(
      {
        seed: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        steps: Type.Optional(Type.Integer({ minimum: 1 })),
        cfg: Type.Optional(Type.Number({ minimum: 0 })),
        sampler: Type.Optional(Type.String({ minLength: 1 })),
        scheduler: Type.Optional(Type.String({ minLength: 1 })),
        denoise: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
        model: Type.Optional(Type.String({ minLength: 1 }))
      },
      { additionalProperties: false }
    )
  },
  { additionalProperties: false }
);

export const AnimationPackClipSchema = Type.Object(
  {
    id: Id,
    frames: Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1 }),
    fps: Type.Number({ exclusiveMinimum: 0 }),
    loop: Type.Boolean()
  },
  { additionalProperties: false }
);

export const AnimationPackDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    assetId: Id,
    frame: Type.Object(
      {
        width: Type.Integer({ minimum: 1 }),
        height: Type.Integer({ minimum: 1 })
      },
      { additionalProperties: false }
    ),
    grid: Type.Object(
      {
        columns: Type.Integer({ minimum: 1 }),
        rows: Type.Integer({ minimum: 1 })
      },
      { additionalProperties: false }
    ),
    footOrigin: Vector2Schema,
    defaultFacing: Type.Union([Type.Literal("right"), Type.Literal("left")]),
    clips: Type.Array(AnimationPackClipSchema, { minItems: 1 })
  },
  { additionalProperties: false }
);

export const PromptPackContextSchema = Type.Object(
  {
    projectTitle: Type.String({ minLength: 1 }),
    sceneId: Id,
    sceneName: Type.String({ minLength: 1 }),
    sceneSize: Type.Object(
      {
        width: Type.Integer({ minimum: 320 }),
        height: Type.Integer({ minimum: 180 })
      },
      { additionalProperties: false }
    ),
    artBrief: Type.String(),
    locale: Type.String({ minLength: 2 }),
    labels: Type.Record(Type.String(), Type.String()),
    hotspots: Type.Array(
      Type.Object(
        {
          id: Id,
          labelKey: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    ),
    actors: Type.Array(
      Type.Object(
        {
          id: Id,
          role: SceneActorRoleSchema,
          labelKey: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    ),
    pickups: Type.Array(
      Type.Object(
        {
          id: Id,
          itemId: Id,
          labelKey: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    ),
    items: Type.Array(
      Type.Object(
        {
          id: Id,
          labelKey: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    )
  },
  { additionalProperties: false }
);

export const PromptPackGenerationTargetSchema = Type.Object(
  {
    id: Id,
    intendedUse: Type.Union([
      Type.Literal("scene-background"),
      Type.Literal("prop"),
      Type.Literal("character-reference"),
      Type.Literal("animation-reference"),
      Type.Literal("sprite-sheet")
    ]),
    sourceEntityKind: Type.Optional(
      Type.Union([
        Type.Literal("scene"),
        Type.Literal("actor"),
        Type.Literal("pickup"),
        Type.Literal("player"),
        Type.Literal("item")
      ])
    ),
    sourceEntityId: Type.Optional(Id),
    backgroundMode: Type.Optional(
      Type.Union([
        Type.Literal("opaque-scene"),
        Type.Literal("transparent-alpha"),
        Type.Literal("chroma-blue"),
        Type.Literal("chroma-green"),
        Type.Literal("reference-only")
      ])
    ),
    expectedAlpha: Type.Optional(Type.Boolean()),
    chromaColor: Type.Optional(Type.Union([Type.Literal("#00A2FF"), Type.Literal("#00FF00")])),
    marginPercent: Type.Optional(Type.Number({ minimum: 0, maximum: 50 })),
    safetyNegativePrompt: Type.Optional(Type.String()),
    customPositivePrompt: Type.Optional(Type.String()),
    customNegativePrompt: Type.Optional(Type.String()),
    referenceAssetId: Type.Optional(Id),
    maskAssetId: Type.Optional(Id),
    guideIds: Type.Optional(Type.Array(Id)),
    guideBounds: Type.Optional(RectSchema),
    guideShape: Type.Optional(Type.Union([Type.Literal("rect"), Type.Literal("ellipse")])),
    width: Type.Optional(Type.Integer({ minimum: 1 })),
    height: Type.Optional(Type.Integer({ minimum: 1 })),
    aspectRatio: Type.Optional(Type.String({ minLength: 1 })),
    transparent: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);

export const PromptPackOutputsSchema = Type.Object(
  {
    sceneBackgroundPrompt: Type.String({ minLength: 1 }),
    propPrompts: Type.Array(
      Type.Object(
        {
          id: Id,
          prompt: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    ),
    characterReferencePrompts: Type.Array(
      Type.Object(
        {
          id: Id,
          prompt: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    ),
    animationNotes: Type.Array(Type.String({ minLength: 1 })),
    negativePrompt: Type.String(),
    styleNotes: Type.Array(Type.String({ minLength: 1 })),
    generationTargets: Type.Array(PromptPackGenerationTargetSchema)
  },
  { additionalProperties: false }
);

export const PromptPackSuggestedActorSchema = Type.Object(
  {
    id: Id,
    role: SceneActorRoleSchema,
    label: Type.String({ minLength: 1 }),
    visualPrompt: Type.String({ minLength: 1 }),
    suggestedBounds: Type.Optional(RectSchema),
    suggestedInteractSpot: Type.Optional(Vector2Schema),
    suggestedLookSpot: Type.Optional(Vector2Schema)
  },
  { additionalProperties: false }
);

export const PromptPackProvenanceSchema = Type.Object(
  {
    provider: Type.String({ minLength: 1 }),
    model: Type.String({ minLength: 1 }),
    generatedAt: Type.String({ format: "date-time" }),
    inputHash: Type.Optional(Type.String({ minLength: 1 })),
    jobId: Type.Optional(Type.String({ minLength: 1 })),
    seed: Type.Optional(Type.Union([Type.String(), Type.Number()]))
  },
  { additionalProperties: false }
);

export const PromptPackDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    name: Type.String({ minLength: 1 }),
    sceneId: Id,
    artBrief: Type.String(),
    context: PromptPackContextSchema,
    outputs: PromptPackOutputsSchema,
    suggestedActors: Type.Array(PromptPackSuggestedActorSchema),
    provenance: PromptPackProvenanceSchema
  },
  { additionalProperties: false }
);

export type Vector2 = Static<typeof Vector2Schema>;
export type Rect = Static<typeof RectSchema>;
export type Polygon2 = Static<typeof Polygon2Schema>;
export type FlagValue = Static<typeof FlagValueSchema>;
export type ConditionExpression = Static<typeof ConditionExpressionSchema>;
export type Verb = Static<typeof VerbSchema>;
export type ProjectManifest = Static<typeof ProjectManifestSchema>;
export type SceneShape = Static<typeof SceneShapeSchema>;
export type CursorValue = Static<typeof HotspotCursorSchema>;
export type HotspotUseItemFlow = Static<typeof HotspotUseItemFlowSchema>;
export type HotspotActions = Static<typeof HotspotActionsSchema>;
export type Hotspot = Static<typeof HotspotSchema>;
export type ScenePickup = Static<typeof ScenePickupSchema>;
export type SceneActorRole = Static<typeof SceneActorRoleSchema>;
export type SceneActor = Static<typeof SceneActorSchema>;
export type ScenePlayerConfig = Static<typeof ScenePlayerConfigSchema>;
export type SceneLayer = Static<typeof SceneLayerSchema>;
export type SceneGenerationGuideRole = Static<typeof SceneGenerationGuideRoleSchema>;
export type SceneGenerationGuideSource = Static<typeof SceneGenerationGuideSourceSchema>;
export type SceneGenerationGuideShape = Static<typeof SceneGenerationGuideShapeSchema>;
export type SceneGenerationGuide = Static<typeof SceneGenerationGuideSchema>;
export type Layered2DScene = Static<typeof Layered2DSceneSchema>;
export type Hybrid3DScene = Static<typeof Hybrid3DSceneSchema>;
export type SceneDocument = Static<typeof SceneDocumentSchema>;
export type FlowNode = Static<typeof FlowNodeSchema>;
export type FlowDocument = Static<typeof FlowDocumentSchema>;
export type LocaleDocument = Static<typeof LocaleDocumentSchema>;
export type ItemDocument = Static<typeof ItemDocumentSchema>;
export type AssetDocument = Static<typeof AssetDocumentSchema>;
export type AssetKind = Static<typeof AssetKindSchema>;
export type AssetSource = Static<typeof AssetSourceSchema>;
export type AssetGenerationMetadata = Static<typeof AssetGenerationMetadataSchema>;
export type WorkflowFamily = Static<typeof WorkflowFamilySchema>;
export type WorkflowInputKind = Static<typeof WorkflowInputKindSchema>;
export type WorkflowOutputMode = Static<typeof WorkflowOutputModeSchema>;
export type WorkflowTemplateBinding = Static<typeof WorkflowTemplateBindingSchema>;
export type WorkflowTemplateDocument = Static<typeof WorkflowTemplateDocumentSchema>;
export type StyleBibleDocument = Static<typeof StyleBibleDocumentSchema>;
export type AssetGenerationRecipeAssetType = Static<typeof AssetGenerationRecipeAssetTypeSchema>;
export type AssetGenerationRecipeDocument = Static<typeof AssetGenerationRecipeDocumentSchema>;
export type AnimationPackClip = Static<typeof AnimationPackClipSchema>;
export type AnimationPackDocument = Static<typeof AnimationPackDocumentSchema>;
export type PromptPackContext = Static<typeof PromptPackContextSchema>;
export type PromptPackGenerationTarget = Static<typeof PromptPackGenerationTargetSchema>;
export type PromptPackOutputs = Static<typeof PromptPackOutputsSchema>;
export type PromptPackSuggestedActor = Static<typeof PromptPackSuggestedActorSchema>;
export type PromptPackProvenance = Static<typeof PromptPackProvenanceSchema>;
export type PromptPackDocument = Static<typeof PromptPackDocumentSchema>;

export interface ProjectBundle {
  manifest: ProjectManifest;
  scenes: Record<string, SceneDocument>;
  flows: Record<string, FlowDocument>;
  locales: Record<string, LocaleDocument>;
  items: Record<string, ItemDocument>;
  assets: Record<string, AssetDocument>;
  animationPacks: Record<string, AnimationPackDocument>;
  promptPacks: Record<string, PromptPackDocument>;
  styleBibles: Record<string, StyleBibleDocument>;
  workflowTemplates: Record<string, WorkflowTemplateDocument>;
  generationRecipes: Record<string, AssetGenerationRecipeDocument>;
}
