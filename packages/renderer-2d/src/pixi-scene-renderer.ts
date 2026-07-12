import type {
  AnimationPackDocument,
  AssetDocument,
  Layered2DScene,
  SceneActor,
  SceneLayer,
  ScenePickup,
  Vector2
} from "@pointclick/contracts";
import { AnimatedSprite, Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";

export interface SceneInteractionHandlers {
  onWalk(position: Vector2): void;
  onActor(actorId: string): void;
  onHotspot(hotspotId: string): void;
  onPickup(pickupId: string): void;
}

export interface SceneRenderOptions {
  animationPacks?: Record<string, AnimationPackDocument>;
  assets?: Record<string, AssetDocument>;
  assetBaseUrl?: string;
}

function colorNumber(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export class PixiSceneRenderer {
  private readonly app = new Application();
  private readonly actorTargets = new Map<string, Container>();
  private readonly player = new Container();
  private readonly pickupTargets = new Map<string, Container>();
  private playerAnimatedSprite: AnimatedSprite | null = null;
  private playerClipTextures = new Map<string, Texture[]>();
  private playerCurrentClipId: string | null = null;
  private playerAnimationFrame: number | null = null;
  private playerFacing: 1 | -1 = 1;
  private playerPosition: Vector2 = { x: 0, y: 0 };
  private pendingPlayerPosition: Vector2 = { x: 0, y: 0 };
  private mounted = false;
  private initialized = false;
  private destroyed = false;
  private host: HTMLElement | null = null;
  private viewportScale = { x: 1, y: 1 };

  constructor(
    private readonly scene: Layered2DScene,
    private readonly handlers: SceneInteractionHandlers,
    private readonly options: SceneRenderOptions = {}
  ) {
    this.pendingPlayerPosition = { ...scene.playerStart };
    this.playerPosition = { ...scene.playerStart };
  }

  async mount(host: HTMLElement): Promise<void> {
    if (this.destroyed) return;
    this.host = host;
    if (isHexColor(this.scene.background)) {
      host.style.background = this.scene.background;
      host.style.backgroundImage = "";
    } else {
      const assetUrl = new URL(this.scene.background, this.options.assetBaseUrl ?? window.location.href).toString();
      host.style.background = "#111820";
      host.style.backgroundImage = `url("${assetUrl}")`;
      host.style.backgroundPosition = "center";
      host.style.backgroundRepeat = "no-repeat";
      host.style.backgroundSize = "100% 100%";
    }

    await this.app.init({
      width: this.scene.size.width,
      height: this.scene.size.height,
      backgroundColor: isHexColor(this.scene.background) ? colorNumber(this.scene.background) : 0x111820,
      backgroundAlpha: isHexColor(this.scene.background) ? 1 : 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2)
    });
    this.initialized = true;
    if (this.destroyed) {
      this.disposeApplication();
      return;
    }

    this.app.canvas.className = "game-canvas";
    this.app.stage.sortableChildren = true;

    const walkSurface = new Graphics()
      .rect(0, 0, this.scene.size.width, this.scene.size.height)
      .fill({ color: 0xffffff, alpha: 0.001 });
    walkSurface.eventMode = "static";
    walkSurface.cursor = "crosshair";
    walkSurface.on("pointertap", (event) => {
      this.handlers.onWalk({
        x: event.global.x / this.viewportScale.x,
        y: event.global.y / this.viewportScale.y
      });
    });
    this.app.stage.addChild(walkSurface);

    for (const layer of [...(this.scene.layers ?? [])].sort((a, b) => a.depth - b.depth)) {
      const sprite = await this.createLayerSprite(layer);
      if (this.destroyed) {
        this.disposeApplication();
        return;
      }
      if (sprite) {
        this.app.stage.addChild(sprite);
      }
    }

    for (const shape of [...this.scene.shapes].sort((a, b) => a.depth - b.depth)) {
      const graphic = new Graphics();
      if (shape.shape === "rect") {
        graphic.rect(shape.bounds.x, shape.bounds.y, shape.bounds.width, shape.bounds.height);
      } else {
        graphic.ellipse(
          shape.bounds.x + shape.bounds.width / 2,
          shape.bounds.y + shape.bounds.height / 2,
          shape.bounds.width / 2,
          shape.bounds.height / 2
        );
      }
      graphic.fill(colorNumber(shape.fill));
      graphic.zIndex = shape.depth;
      this.app.stage.addChild(graphic);
    }

    for (const hotspot of this.scene.hotspots) {
      const target = new Graphics()
        .roundRect(
          hotspot.bounds.x,
          hotspot.bounds.y,
          hotspot.bounds.width,
          hotspot.bounds.height,
          8
        )
        .fill({ color: 0xffcc66, alpha: 0.001 });
      target.zIndex = 100;
      target.eventMode = "static";
      target.cursor = "pointer";
      target.on("pointertap", (event) => {
        event.stopPropagation();
        this.handlers.onHotspot(hotspot.id);
      });
      this.app.stage.addChild(target);
    }

    for (const actor of this.scene.actors) {
      const target = await this.createActorTarget(actor);
      if (this.destroyed) {
        this.disposeApplication();
        return;
      }
      this.actorTargets.set(actor.id, target);
      this.app.stage.addChild(target);
    }

    for (const pickup of this.scene.pickups) {
      const target = await this.createPickupTarget(pickup);
      if (this.destroyed) {
        this.disposeApplication();
        return;
      }
      this.pickupTargets.set(pickup.id, target);
      this.app.stage.addChild(target);
    }

    await this.createPlayerVisual();
    if (this.destroyed) {
      this.disposeApplication();
      return;
    }
    this.player.zIndex = 50;
    this.playerPosition = { ...this.pendingPlayerPosition };
    this.applyPlayerTransform(this.pendingPlayerPosition);
    this.app.stage.addChild(this.player);

    // Do not expose an interactive canvas until every hit target and the
    // player visual have been installed. This also makes an interrupted
    // StrictMode mount invisible instead of leaving a half-built renderer in
    // the host while its async asset work is still running.
    host.replaceChildren(this.app.canvas);
    this.resizeToHost(host);
    this.mounted = true;
  }

  renderCollectedPickups(collectedPickupIds: string[]): void {
    const collected = new Set(collectedPickupIds);
    for (const [pickupId, target] of this.pickupTargets) {
      const visible = !collected.has(pickupId);
      target.visible = visible;
      target.eventMode = visible ? "static" : "none";
    }
  }

  renderVisibleActors(visibleActorIds: string[]): void {
    const visibleActors = new Set(visibleActorIds);
    for (const [actorId, target] of this.actorTargets) {
      const visible = visibleActors.has(actorId);
      target.visible = visible;
      target.eventMode = visible ? "static" : "none";
    }
  }

  renderPlayer(position: Vector2): void {
    this.pendingPlayerPosition = { ...position };
    if (!this.mounted) return;
    this.animatePlayerTo(position);
  }

  resizeToHost(host = this.host): void {
    if (!host || !this.initialized || !this.app.canvas) return;

    const bounds = host.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);
    this.app.renderer.resize(width, height);
    this.viewportScale = {
      x: width / this.scene.size.width,
      y: height / this.scene.size.height
    };
    this.app.stage.scale.set(this.viewportScale.x, this.viewportScale.y);
    this.app.canvas.style.width = `${width}px`;
    this.app.canvas.style.height = `${height}px`;
    this.app.canvas.style.maxWidth = "100%";
    this.app.canvas.style.maxHeight = "100%";
  }

  destroy(): void {
    this.destroyed = true;
    if (this.playerAnimationFrame !== null) {
      cancelAnimationFrame(this.playerAnimationFrame);
      this.playerAnimationFrame = null;
    }
    this.disposeApplication();
  }

  private disposeApplication(): void {
    if (!this.initialized) return;
    this.app.destroy(true, { children: true });
    this.initialized = false;
    this.mounted = false;
    this.host = null;
  }

  private async createPlayerVisual(): Promise<void> {
    this.player.removeChildren();

    const asset = this.scene.player?.assetId ? this.options.assets?.[this.scene.player.assetId] : null;
    const animationPack = this.scene.player?.animationPackId
      ? this.options.animationPacks?.[this.scene.player.animationPackId]
      : null;
    if (animationPack) {
      const animated = await this.createAnimatedSprite(animationPack, "idle", 128);
      if (animated) {
        this.playerAnimatedSprite = animated;
        this.playerCurrentClipId = "idle";
        this.player.addChild(animated);
        return;
      }
    }

    if (asset) {
      try {
        const assetUrl = new URL(asset.path, this.options.assetBaseUrl ?? window.location.href).toString();
        const texture = await Assets.load(assetUrl);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        sprite.height = 128;
        sprite.width = (texture.width / texture.height) * sprite.height;
        this.player.addChild(sprite);
        return;
      } catch {
        // Fall through to the generated marker so the player remains visible while authoring.
      }
    }

    const shadow = new Graphics().ellipse(0, 38, 30, 10).fill({ color: 0x071019, alpha: 0.45 });
    const body = new Graphics().roundRect(-16, -32, 32, 66, 14).fill(0xd98b52);
    const coat = new Graphics().poly([-22, 30, 0, -5, 22, 30]).fill(0x263a55);
    const head = new Graphics().circle(0, -47, 15).fill(0xe7b47d);
    const hair = new Graphics().arc(0, -49, 16, Math.PI, Math.PI * 2).stroke({
      color: 0x251c28,
      width: 9
    });
    this.player.addChild(shadow, body, coat, head, hair);
  }

  private animatePlayerTo(target: Vector2): void {
    if (this.playerAnimationFrame !== null) {
      cancelAnimationFrame(this.playerAnimationFrame);
      this.playerAnimationFrame = null;
    }

    const start = { ...this.playerPosition };
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    if (distance < 1) {
      this.playerPosition = { ...target };
      this.applyPlayerTransform(target);
      return;
    }

    this.playerFacing = target.x < start.x ? -1 : 1;
    this.playPlayerClip("walk");
    const walkSpeed = this.scene.player?.walkSpeed ?? 320;
    const duration = Math.max(120, Math.min(2400, (distance / walkSpeed) * 1000));
    const startedAt = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const position = {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased
      };
      this.playerPosition = position;
      this.applyPlayerTransform(position);

      if (t < 1) {
        this.playerAnimationFrame = requestAnimationFrame(step);
      } else {
        this.playPlayerClip("idle");
        this.playerAnimationFrame = null;
      }
    };

    this.playerAnimationFrame = requestAnimationFrame(step);
  }

  private applyPlayerTransform(position: Vector2): void {
    const scale = this.playerScaleAt(position);
    this.player.position.set(position.x, position.y);
    this.player.scale.set(scale * this.playerFacing, scale);
  }

  private playerScaleAt(position: Vector2): number {
    const ys = this.scene.walkArea.points.map((point) => point.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const far = this.scene.player?.scaleFar ?? 0.62;
    const near = this.scene.player?.scaleNear ?? 1.08;
    if (maxY <= minY) return near;

    const t = Math.max(0, Math.min(1, (position.y - minY) / (maxY - minY)));
    return far + (near - far) * t;
  }

  private async createLayerSprite(layer: SceneLayer): Promise<Sprite | null> {
    if (layer.visible === false) return null;
    const asset = this.options.assets?.[layer.assetId];
    if (!asset) return null;

    try {
      const assetUrl = new URL(asset.path, this.options.assetBaseUrl ?? window.location.href).toString();
      const texture = await Assets.load(assetUrl);
      const bounds = layer.bounds ?? {
        x: 0,
        y: 0,
        width: this.scene.size.width,
        height: this.scene.size.height
      };
      const sprite = new Sprite(texture);
      sprite.x = bounds.x;
      sprite.y = bounds.y;
      sprite.width = bounds.width;
      sprite.height = bounds.height;
      sprite.alpha = layer.opacity ?? 1;
      sprite.zIndex = layer.depth;
      sprite.eventMode = "none";
      return sprite;
    } catch {
      return null;
    }
  }

  private async createActorTarget(actor: SceneActor): Promise<Container> {
    const container = new Container();
    container.position.set(actor.bounds.x, actor.bounds.y);
    container.zIndex = actor.depth;
    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointertap", (event) => {
      event.stopPropagation();
      this.handlers.onActor(actor.id);
    });

    const animationPack = actor.animationPackId ? this.options.animationPacks?.[actor.animationPackId] : null;
    if (animationPack) {
      const animated = await this.createAnimatedSprite(animationPack, "idle", actor.bounds.height);
      if (animated) {
        animated.width = actor.bounds.width;
        animated.height = actor.bounds.height;
        container.addChild(animated);
      } else {
        container.addChild(this.createActorDebugShape(actor));
      }
    } else if (actor.assetId) {
      const asset = this.options.assets?.[actor.assetId];
      if (asset) {
        const assetUrl = new URL(asset.path, this.options.assetBaseUrl ?? window.location.href).toString();
        try {
          const texture = await Assets.load(assetUrl);
          const sprite = new Sprite(texture);
          sprite.width = actor.bounds.width;
          sprite.height = actor.bounds.height;
          container.addChild(sprite);
        } catch {
          container.addChild(this.createActorDebugShape(actor));
        }
      } else {
        container.addChild(this.createActorDebugShape(actor));
      }
    } else {
      container.addChild(this.createActorDebugShape(actor));
    }

    const hitArea = new Graphics()
      .rect(0, 0, actor.bounds.width, actor.bounds.height)
      .fill({ color: 0xffffff, alpha: 0.001 });
    container.addChild(hitArea);

    return container;
  }

  private createActorDebugShape(actor: SceneActor): Graphics {
    return new Graphics()
      .roundRect(0, 0, actor.bounds.width, actor.bounds.height, 8)
      .fill({ color: 0x66d9ef, alpha: actor.role === "decoration" ? 0.08 : 0.18 })
      .stroke({ color: 0x66d9ef, alpha: 0.72, width: 2 });
  }

  private async createPickupTarget(pickup: ScenePickup): Promise<Container> {
    const container = new Container();
    container.x = pickup.bounds.x;
    container.y = pickup.bounds.y;
    container.zIndex = 90;
    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointertap", (event) => {
      event.stopPropagation();
      this.handlers.onPickup(pickup.id);
    });

    if (pickup.assetId) {
      const asset = this.options.assets?.[pickup.assetId];
      if (asset) {
        const assetUrl = new URL(asset.path, this.options.assetBaseUrl ?? window.location.href).toString();
        try {
          const texture = await Assets.load(assetUrl);
          const sprite = new Sprite(texture);
          sprite.width = pickup.bounds.width;
          sprite.height = pickup.bounds.height;
          container.addChild(sprite);
        } catch {
          container.addChild(this.createPickupDebugShape(pickup));
        }
      } else {
        container.addChild(this.createPickupDebugShape(pickup));
      }
    } else {
      container.addChild(this.createPickupDebugShape(pickup));
    }

    const hitArea = new Graphics()
      .rect(0, 0, pickup.bounds.width, pickup.bounds.height)
      .fill({ color: 0xffffff, alpha: 0.001 });
    container.addChild(hitArea);

    return container;
  }

  private createPickupDebugShape(pickup: ScenePickup): Graphics {
    return new Graphics()
      .roundRect(0, 0, pickup.bounds.width, pickup.bounds.height, 8)
      .fill({ color: 0x9bd8b6, alpha: 0.18 });
  }

  private async createAnimatedSprite(
    animationPack: AnimationPackDocument,
    preferredClipId: string,
    targetHeight: number
  ): Promise<AnimatedSprite | null> {
    const asset = this.options.assets?.[animationPack.assetId];
    if (!asset) return null;

    try {
      const assetUrl = new URL(asset.path, this.options.assetBaseUrl ?? window.location.href).toString();
      const sheetTexture = await Assets.load<Texture>(assetUrl);
      const texturesByClip = new Map<string, Texture[]>();
      for (const candidate of animationPack.clips) {
        texturesByClip.set(
          candidate.id,
          candidate.frames.map((frameIndex) => {
            const column = frameIndex % animationPack.grid.columns;
            const row = Math.floor(frameIndex / animationPack.grid.columns);
            return new Texture({
              source: sheetTexture.source,
              frame: new Rectangle(
                column * animationPack.frame.width,
                row * animationPack.frame.height,
                animationPack.frame.width,
                animationPack.frame.height
              )
            });
          })
        );
      }
      const clip =
        animationPack.clips.find((candidate) => candidate.id === preferredClipId) ??
        animationPack.clips[0];
      if (!clip) return null;
      const textures = texturesByClip.get(clip.id);
      if (!textures) return null;
      if (animationPack.id === this.scene.player?.animationPackId) {
        this.playerClipTextures = texturesByClip;
      }
      const sprite = new AnimatedSprite(textures);
      sprite.anchor.set(
        animationPack.footOrigin.x / animationPack.frame.width,
        animationPack.footOrigin.y / animationPack.frame.height
      );
      sprite.animationSpeed = clip.fps / 60;
      sprite.loop = clip.loop;
      sprite.height = targetHeight;
      sprite.width = (animationPack.frame.width / animationPack.frame.height) * sprite.height;
      sprite.play();
      return sprite;
    } catch {
      return null;
    }
  }

  private playPlayerClip(clipId: string): void {
    const animationPack = this.scene.player?.animationPackId
      ? this.options.animationPacks?.[this.scene.player.animationPackId]
      : null;
    if (!this.playerAnimatedSprite || !animationPack || this.playerCurrentClipId === clipId) return;

    const clip =
      animationPack.clips.find((candidate) => candidate.id === clipId) ??
      animationPack.clips.find((candidate) => candidate.id === "idle") ??
      animationPack.clips[0];
    if (!clip) return;

    const nextTextures = this.playerClipTextures.get(clip.id);
    if (!nextTextures) return;

    this.playerAnimatedSprite.textures = nextTextures;
    this.playerAnimatedSprite.animationSpeed = clip.fps / 60;
    this.playerAnimatedSprite.loop = clip.loop;
    this.playerAnimatedSprite.gotoAndPlay(0);
    this.playerCurrentClipId = clip.id;
  }
}
