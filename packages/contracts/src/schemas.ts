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
    scenes: Type.Array(
      Type.Object(
        {
          id: Id,
          path: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    flows: Type.Array(
      Type.Object(
        {
          id: Id,
          path: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    ),
    items: Type.Array(
      Type.Object(
        {
          id: Id,
          path: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
      )
    ),
    assets: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: Id,
            path: Type.String({ minLength: 1 })
          },
          { additionalProperties: false }
        )
      )
    ),
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
    pickupFlowId: Type.Optional(Id)
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

export type Vector2 = Static<typeof Vector2Schema>;
export type Rect = Static<typeof RectSchema>;
export type Polygon2 = Static<typeof Polygon2Schema>;
export type Verb = Static<typeof VerbSchema>;
export type ProjectManifest = Static<typeof ProjectManifestSchema>;
export type SceneShape = Static<typeof SceneShapeSchema>;
export type CursorValue = Static<typeof HotspotCursorSchema>;
export type HotspotUseItemFlow = Static<typeof HotspotUseItemFlowSchema>;
export type HotspotActions = Static<typeof HotspotActionsSchema>;
export type Hotspot = Static<typeof HotspotSchema>;
export type ScenePickup = Static<typeof ScenePickupSchema>;
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

export interface ProjectBundle {
  manifest: ProjectManifest;
  scenes: Record<string, SceneDocument>;
  flows: Record<string, FlowDocument>;
  locales: Record<string, LocaleDocument>;
  items: Record<string, ItemDocument>;
  assets: Record<string, AssetDocument>;
}
