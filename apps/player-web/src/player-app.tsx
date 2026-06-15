import type { Layered2DScene, ProjectBundle } from "@pointclick/contracts";
import { PixiSceneRenderer } from "@pointclick/renderer-2d";
import { AdventureEngine, type RuntimeFrame } from "@pointclick/runtime";
import { sampleBundle } from "@pointclick/sample-game";
import { useEffect, useMemo, useRef, useState } from "react";

function applySceneOverride(bundle: ProjectBundle): ProjectBundle {
  const sceneId = new URLSearchParams(window.location.search).get("scene");
  if (!sceneId || !bundle.scenes[sceneId]) {
    return bundle;
  }

  return {
    ...bundle,
    manifest: {
      ...bundle.manifest,
      initialSceneId: sceneId
    }
  };
}

async function loadPreviewBundle(): Promise<ProjectBundle> {
  const bundleUrl = new URLSearchParams(window.location.search).get("bundleUrl");
  if (!bundleUrl) {
    return applySceneOverride(sampleBundle);
  }

  const response = await fetch(bundleUrl);
  if (!response.ok) {
    throw new Error("Preview bundle could not be loaded.");
  }

  return applySceneOverride((await response.json()) as ProjectBundle);
}

export function PlayerApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiSceneRenderer | null>(null);
  const frameRef = useRef<RuntimeFrame | null>(null);
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const assetBaseUrl = new URLSearchParams(window.location.search).get("assetBaseUrl") ?? undefined;
  const engine = useMemo(() => (bundle ? new AdventureEngine(bundle) : null), [bundle]);
  const [frame, setFrame] = useState<RuntimeFrame | null>(null);
  const scene = engine?.currentScene as Layered2DScene | undefined;
  const rendererReady = frame !== null;
  const inventoryItems =
    frame?.state.inventory
      .map((itemId) => bundle?.items[itemId])
      .filter((item) => item !== undefined) ?? [];

  useEffect(() => {
    let cancelled = false;

    void loadPreviewBundle()
      .then((nextBundle) => {
        if (cancelled) return;
        setBundle(nextBundle);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Preview bundle could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    const nextFrame = engine.start();
    frameRef.current = nextFrame;
    setFrame(nextFrame);
  }, [engine]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !engine || !scene || !rendererReady) return;

    let disposed = false;
    const renderer = new PixiSceneRenderer(scene, {
      onWalk: (position) => {
        const currentFrame = frameRef.current;
        if (!currentFrame) return;

        const nextFrame =
          currentFrame.state.activeVerb === "walk"
            ? engine.walkTo(position.x, position.y)
            : {
                ...engine.selectVerb("walk"),
                feedback: "Switched to Walk."
              };
        frameRef.current = nextFrame;
        renderer.renderPlayer(nextFrame.state.player);
        renderer.renderCollectedPickups(nextFrame.state.collectedPickups);
        setFrame(nextFrame);
      },
      onHotspot: (hotspotId) => {
        const nextFrame = engine.interactHotspot(hotspotId);
        frameRef.current = nextFrame;
        renderer.renderPlayer(nextFrame.state.player);
        renderer.renderCollectedPickups(nextFrame.state.collectedPickups);
        setFrame(nextFrame);
      },
      onPickup: (pickupId) => {
        const nextFrame = engine.interactPickup(pickupId);
        frameRef.current = nextFrame;
        renderer.renderPlayer(nextFrame.state.player);
        renderer.renderCollectedPickups(nextFrame.state.collectedPickups);
        setFrame(nextFrame);
      }
    }, assetBaseUrl ? { assetBaseUrl } : {});
    rendererRef.current = renderer;

    void renderer.mount(host).then(() => {
      const nextFrame = frameRef.current;
      if (!disposed && nextFrame) {
        renderer.renderPlayer(nextFrame.state.player);
        renderer.renderCollectedPickups(nextFrame.state.collectedPickups);
      }
    });

    return () => {
      disposed = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [assetBaseUrl, engine, rendererReady, scene]);

  useEffect(() => {
    if (!frame) return;
    rendererRef.current?.renderPlayer(frame.state.player);
    rendererRef.current?.renderCollectedPickups(frame.state.collectedPickups);
  }, [frame]);

  if (loadError) {
    return (
      <main className="player-shell">
        <header className="game-header">
          <div>
            <p className="eyebrow">Preview unavailable</p>
            <h1>The Isle of Echoes</h1>
          </div>
        </header>
        <section className="stage-frame" aria-label="Game scene">
          <div className="hint">{loadError}</div>
        </section>
      </main>
    );
  }

  if (!bundle || !engine || !scene || !frame) {
    return (
      <main className="player-shell">
        <header className="game-header">
          <div>
            <p className="eyebrow">Loading preview</p>
            <h1>The Isle of Echoes</h1>
          </div>
        </header>
        <section className="stage-frame" aria-label="Game scene">
          <div className="hint">Preparing the selected project...</div>
        </section>
      </main>
    );
  }

  const advanceDialogue = () => {
    const nextFrame = engine.advanceDialogue();
    frameRef.current = nextFrame;
    rendererRef.current?.renderPlayer(nextFrame.state.player);
    rendererRef.current?.renderCollectedPickups(nextFrame.state.collectedPickups);
    setFrame(nextFrame);
  };

  const selectVerb = (verb: "walk" | "look" | "use" | "talk") => {
    const nextFrame = engine.selectVerb(verb);
    frameRef.current = nextFrame;
    setFrame(nextFrame);
  };

  const toggleItem = (itemId: string) => {
    const nextFrame = engine.toggleSelectedItem(itemId);
    frameRef.current = nextFrame;
    setFrame(nextFrame);
  };

  return (
    <main className="player-shell">
      <header className="game-header">
        <div>
          <p className="eyebrow">Foundation playable</p>
          <h1>{bundle.manifest.title}</h1>
        </div>
        <div className="status">
          <span>Scene</span>
          <strong>{scene.name}</strong>
        </div>
      </header>

      <section className="stage-frame" aria-label="Game scene">
        <div className="stage-grain" />
        <div ref={hostRef} className="stage-host" />
        <div className="hint">Click the dock to walk. Try the amber tavern door.</div>
      </section>

      <section className="verb-bar" aria-label="Interaction verbs">
        {(["walk", "look", "use", "talk"] as const).map((verb) => (
          <button
            className={frame.state.activeVerb === verb ? "active" : ""}
            key={verb}
            type="button"
            onClick={() => selectVerb(verb)}
          >
            {verb}
          </button>
        ))}
      </section>

      <section className="inventory-strip" aria-label="Inventory">
        <span>Inventory</span>
        <div className="inventory-items">
          {inventoryItems.length === 0 ? (
            <small>Empty</small>
          ) : (
            inventoryItems.map((item) => (
              <button
                className={frame.state.selectedItemId === item.id ? "selected" : ""}
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
              >
                {bundle.locales[bundle.manifest.defaultLocale]?.strings[item.labelKey] ?? item.name}
              </button>
            ))
          )}
        </div>
      </section>

      <footer className="game-footer">
        <div className="event-readout">
          <span>Event trace</span>
          <strong>{engine.events.at(-1)?.type ?? "ready"}</strong>
        </div>
        <div className="event-readout">
          <span>Position</span>
          <strong>
            {Math.round(frame.state.player.x)}, {Math.round(frame.state.player.y)}
          </strong>
        </div>
        <div className="event-readout">
          <span>Sequence</span>
          <strong>{frame.state.sequence}</strong>
        </div>
        <div className="event-readout">
          <span>Verb</span>
          <strong>{frame.state.activeVerb}</strong>
        </div>
        <div className="event-readout">
          <span>Selected item</span>
          <strong>{frame.state.selectedItemId ?? "none"}</strong>
        </div>
      </footer>

      {frame.feedback ? <div className="feedback-banner">{frame.feedback}</div> : null}

      {frame.dialogue ? (
        <button className="dialogue-card" type="button" onClick={advanceDialogue}>
          <span className="speaker">{frame.dialogue.speakerId}</span>
          <span className="line">{frame.dialogue.text}</span>
          <span className="continue">Continue</span>
        </button>
      ) : null}
    </main>
  );
}
