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
    bounds: RectSchema,
    depth: Type.Number(),
    visibleWhen: Type.Optional(ConditionExpressionSchema),
    interactSpot: Type.Optional(Vector2Schema),
    lookSpot: Type.Optional(Vector2Schema),
    actions: HotspotActionsSchema
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
    playerStart: Vector2Schema,
    walkArea: Polygon2Schema,
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
export const AssetSourceSchema = Type.Union([Type.Literal("imported")]);

export const AssetDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    kind: AssetKindSchema,
    path: ProjectPath,
    source: AssetSourceSchema
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
      Type.Literal("animation-reference")
    ]),
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
  promptPacks: Record<string, PromptPackDocument>;
}
