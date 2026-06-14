import type { Layered2DScene, Vector2 } from "@pointclick/contracts";
import { Application, Container, Graphics } from "pixi.js";

export interface SceneInteractionHandlers {
  onWalk(position: Vector2): void;
  onHotspot(hotspotId: string): void;
}

function colorNumber(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

export class PixiSceneRenderer {
  private readonly app = new Application();
  private readonly player = new Container();
  private pendingPlayerPosition: Vector2 = { x: 0, y: 0 };
  private mounted = false;

  constructor(
    private readonly scene: Layered2DScene,
    private readonly handlers: SceneInteractionHandlers
  ) {}

  async mount(host: HTMLElement): Promise<void> {
    await this.app.init({
      width: this.scene.size.width,
      height: this.scene.size.height,
      backgroundColor: colorNumber(this.scene.background),
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2)
    });

    this.app.canvas.className = "game-canvas";
    host.replaceChildren(this.app.canvas);

    const walkSurface = new Graphics()
      .rect(0, 0, this.scene.size.width, this.scene.size.height)
      .fill({ color: colorNumber(this.scene.background), alpha: 0.001 });
    walkSurface.eventMode = "static";
    walkSurface.cursor = "crosshair";
    walkSurface.on("pointertap", (event) => {
      this.handlers.onWalk({ x: event.global.x, y: event.global.y });
    });
    this.app.stage.addChild(walkSurface);

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

    const shadow = new Graphics().ellipse(0, 38, 30, 10).fill({ color: 0x071019, alpha: 0.45 });
    const body = new Graphics().roundRect(-16, -32, 32, 66, 14).fill(0xd98b52);
    const coat = new Graphics().poly([-22, 30, 0, -5, 22, 30]).fill(0x263a55);
    const head = new Graphics().circle(0, -47, 15).fill(0xe7b47d);
    const hair = new Graphics().arc(0, -49, 16, Math.PI, Math.PI * 2).stroke({
      color: 0x251c28,
      width: 9
    });
    this.player.addChild(shadow, body, coat, head, hair);
    this.player.zIndex = 50;
    this.player.position.set(this.pendingPlayerPosition.x, this.pendingPlayerPosition.y);
    this.app.stage.addChild(this.player);
    this.app.stage.sortableChildren = true;
    this.mounted = true;
  }

  renderPlayer(position: Vector2): void {
    this.pendingPlayerPosition = { ...position };
    if (!this.mounted) return;
    this.player.position.set(position.x, position.y);
  }

  destroy(): void {
    if (!this.mounted) return;
    this.app.destroy(true, { children: true });
    this.mounted = false;
  }
}
