import type { Layered2DScene, ProjectBundle } from "@pointclick/contracts";
import { PixiSceneRenderer } from "@pointclick/renderer-2d";
import { AdventureEngine, type RuntimeFrame } from "@pointclick/runtime";
import { sampleBundle } from "@pointclick/sample-game";
import { useEffect, useMemo, useRef, useState } from "react";

type DemoStep = {
  id: "inspect-door" | "collect-hook" | "use-hook";
  label: string;
  description: string;
  done: boolean;
};

type StorySignal = {
  id: "door-inspected" | "hook-collected" | "latch-opened";
  label: string;
  detail: string;
  done: boolean;
};

type PlayerSurfaceMode = "guide" | "capture";

function readSurfaceMode(): PlayerSurfaceMode {
  return new URLSearchParams(window.location.search).get("mode") === "capture" ? "capture" : "guide";
}

function writeSurfaceMode(mode: PlayerSurfaceMode) {
  const url = new URL(window.location.href);
  if (mode === "capture") {
    url.searchParams.set("mode", "capture");
  } else {
    url.searchParams.delete("mode");
  }

  window.history.replaceState({}, "", url);
}

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

function buildDemoSteps(frame: RuntimeFrame, engine: AdventureEngine): DemoStep[] {
  const inspectedDoor = engine.events.some(
    (event) =>
      event.type === "hotspot/interacted" &&
      event.hotspotId === "tavern-entrance" &&
      event.verb === "look"
  );
  const collectedHook =
    frame.state.collectedPickups.includes("dock-hook") || frame.state.inventory.includes("rusty-hook");
  const usedHook = frame.state.flags["tavern.hook-used"] === true;

  return [
    {
      id: "inspect-door",
      label: "Inspect the tavern door",
      description: "Switch to Look, then click the amber tavern entrance.",
      done: inspectedDoor
    },
    {
      id: "collect-hook",
      label: "Collect the rusty hook",
      description: "Switch to Use, click the dock hook, then select it in the inventory bar.",
      done: collectedHook
    },
    {
      id: "use-hook",
      label: "Use the hook on the door",
      description: "With Rusty Hook selected, click the tavern entrance again to trigger the state change.",
      done: usedHook
    }
  ];
}

function nextDemoHint(steps: DemoStep[]): string {
  const nextStep = steps.find((step) => !step.done);
  if (!nextStep) {
    return "Demo loop complete. Capture the final dialogue and footer state for the finish.";
  }

  return nextStep.description;
}

function localize(bundle: ProjectBundle, labelKey: string, fallback: string): string {
  return bundle.locales[bundle.manifest.defaultLocale]?.strings[labelKey] ?? fallback;
}

function humanizeIdentifier(value: string): string {
  return value
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function speakerLabel(bundle: ProjectBundle, speakerId: string): string {
  return localize(bundle, `speaker.${speakerId}`, humanizeIdentifier(speakerId));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function buildStorySignals(frame: RuntimeFrame, engine: AdventureEngine): StorySignal[] {
  const inspectedDoor = engine.events.some(
    (event) =>
      event.type === "hotspot/interacted" &&
      event.hotspotId === "tavern-entrance" &&
      event.verb === "look"
  );
  const collectedHook =
    frame.state.collectedPickups.includes("dock-hook") || frame.state.inventory.includes("rusty-hook");
  const openedLatch = frame.state.flags["tavern.hook-used"] === true;

  return [
    {
      id: "door-inspected",
      label: "Door inspected",
      detail: "The first look interaction has fired.",
      done: inspectedDoor
    },
    {
      id: "hook-collected",
      label: "Hook collected",
      detail: "The sample inventory now contains the rusty hook.",
      done: collectedHook
    },
    {
      id: "latch-opened",
      label: "Latch opened",
      detail: "The item-use flow updated world state.",
      done: openedLatch
    }
  ];
}

function formatEvent(event: AdventureEngine["events"][number], bundle: ProjectBundle, scene: Layered2DScene): string {
  switch (event.type) {
    case "game/started":
      return "game started";
    case "verb/selected":
      return `verb selected: ${event.verb}`;
    case "inventory/item-selected": {
      const item = bundle.items[event.itemId];
      return `inventory selected: ${localize(bundle, item?.labelKey ?? "", item?.name ?? event.itemId)}`;
    }
    case "inventory/selection-cleared":
      return "inventory selection cleared";
    case "pickup/collected": {
      const item = bundle.items[event.itemId];
      return `pickup collected: ${localize(bundle, item?.labelKey ?? "", item?.name ?? event.itemId)}`;
    }
    case "character/moved":
      return `character moved: ${Math.round(event.x)}, ${Math.round(event.y)}`;
    case "hotspot/interacted": {
      const hotspot = scene.hotspots.find((entry) => entry.id === event.hotspotId);
      return `hotspot ${event.verb}: ${localize(bundle, hotspot?.labelKey ?? "", hotspot?.id ?? event.hotspotId)}`;
    }
    case "flag/set":
      return `flag set: ${event.key} = ${String(event.value)}`;
    case "flow/started":
      return `flow started: ${event.flowId}`;
    case "flow/ended":
      return `flow ended: ${event.flowId}`;
    default:
      return "runtime event";
  }
}

export function PlayerApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiSceneRenderer | null>(null);
  const frameRef = useRef<RuntimeFrame | null>(null);
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [surfaceMode, setSurfaceMode] = useState<PlayerSurfaceMode>(() => readSurfaceMode());
  const assetBaseUrl = new URLSearchParams(window.location.search).get("assetBaseUrl") ?? undefined;
  const engine = useMemo(() => (bundle ? new AdventureEngine(bundle) : null), [bundle]);
  const [frame, setFrame] = useState<RuntimeFrame | null>(null);
  const scene = engine?.currentScene as Layered2DScene | undefined;
  const rendererReady = frame !== null;
  const inventoryItems =
    frame?.state.inventory
      .map((itemId) => bundle?.items[itemId])
      .filter((item) => item !== undefined) ?? [];
  const demoSteps = frame && engine ? buildDemoSteps(frame, engine) : [];
  const completedDemoSteps = demoSteps.filter((step) => step.done).length;
  const demoHint = demoSteps.length > 0 ? nextDemoHint(demoSteps) : "Preparing the current demo loop...";
  const storySignals = frame && engine ? buildStorySignals(frame, engine) : [];
  const recentEvents =
    bundle && engine && scene
      ? engine.events.slice(-4).reverse().map((event) => formatEvent(event, bundle, scene))
      : [];
  const selectedItemLabel = bundle && frame?.state.selectedItemId
    ? localize(
        bundle,
        bundle.items[frame.state.selectedItemId]?.labelKey ?? "",
        bundle.items[frame.state.selectedItemId]?.name ?? frame.state.selectedItemId
      )
    : "None";
  const latestEventLabel = recentEvents[0] ?? "ready";
  const captureMode = surfaceMode === "capture";

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

  const changeSurfaceMode = (mode: PlayerSurfaceMode) => {
    setSurfaceMode(mode);
    writeSurfaceMode(mode);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target) || !engine) return;

      if (event.key === " " || event.key === "Enter") {
        if (!frameRef.current?.dialogue) return;
        event.preventDefault();
        const nextFrame = engine.advanceDialogue();
        frameRef.current = nextFrame;
        rendererRef.current?.renderPlayer(nextFrame.state.player);
        rendererRef.current?.renderCollectedPickups(nextFrame.state.collectedPickups);
        setFrame(nextFrame);
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        const nextMode = surfaceMode === "capture" ? "guide" : "capture";
        setSurfaceMode(nextMode);
        writeSurfaceMode(nextMode);
        return;
      }

      const verbByKey = {
        "1": "walk",
        "2": "look",
        "3": "use",
        "4": "talk"
      } as const;
      const verb = verbByKey[event.key as keyof typeof verbByKey];
      if (!verb) return;

      event.preventDefault();
      const nextFrame = engine.selectVerb(verb);
      frameRef.current = nextFrame;
      setFrame(nextFrame);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine, surfaceMode]);

  return (
    <main className={captureMode ? "player-shell capture-mode" : "player-shell"}>
      <header className="game-header">
        <div>
          <p className="eyebrow">Foundation playable</p>
          <h1>{bundle.manifest.title}</h1>
        </div>
        <div className="status-panel">
          <div className="status">
            <span>Scene</span>
            <strong>{scene.name}</strong>
          </div>
          <div className="surface-mode-toggle" aria-label="Player surface mode" role="group">
            <button
              aria-pressed={surfaceMode === "guide"}
              className={surfaceMode === "guide" ? "active" : ""}
              type="button"
              onClick={() => changeSurfaceMode("guide")}
            >
              Guide
            </button>
            <button
              aria-keyshortcuts="c"
              aria-pressed={surfaceMode === "capture"}
              className={surfaceMode === "capture" ? "active" : ""}
              type="button"
              onClick={() => changeSurfaceMode("capture")}
            >
              Capture
            </button>
          </div>
        </div>
      </header>

      {captureMode ? (
        <section className="capture-strip" aria-label="Capture mode summary">
          <div className="capture-strip-copy">
            <span className="eyebrow">Capture mode</span>
            <strong>
              Loop progress {completedDemoSteps}/{demoSteps.length}
            </strong>
            <p>{demoHint}</p>
          </div>
          <div className="capture-strip-meta">
            <span>Latest event</span>
            <strong>{latestEventLabel}</strong>
          </div>
        </section>
      ) : (
        <>
          <section className="demo-brief" aria-label="Sample demo checklist">
            <div className="demo-brief-copy">
              <p className="eyebrow">Demo-first sample</p>
              <h2>Record the full point-and-click loop in one take.</h2>
              <p className="demo-summary">
                This sample is small on purpose: scene, hotspot, inventory, item use, flow, and
                state update are all visible in under 30 seconds.
              </p>
            </div>
            <div className="demo-progress">
              <span>Loop progress</span>
              <strong>
                {completedDemoSteps}/{demoSteps.length}
              </strong>
            </div>
          </section>

          <section className="demo-checklist" aria-label="Current sample loop">
            {demoSteps.map((step, index) => (
              <article className={step.done ? "demo-step done" : "demo-step"} key={step.id}>
                <span className="demo-step-index">0{index + 1}</span>
                <div>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </div>
                <strong>{step.done ? "Done" : "Next"}</strong>
              </article>
            ))}
          </section>

          <section className="demo-state-strip" aria-label="Current story state">
            <div className="story-signals">
              {storySignals.map((signal) => (
                <article className={signal.done ? "story-signal done" : "story-signal"} key={signal.id}>
                  <span>{signal.done ? "Ready" : "Pending"}</span>
                  <strong>{signal.label}</strong>
                  <p>{signal.detail}</p>
                </article>
              ))}
            </div>
            <aside className="event-feed" aria-label="Recent runtime events">
              <div className="event-feed-heading">
                <span className="eyebrow">Recent runtime events</span>
                <strong>{engine.events.length}</strong>
              </div>
              <ol>
                {recentEvents.map((eventLabel, index) => (
                  <li key={`${eventLabel}-${index}`}>{eventLabel}</li>
                ))}
              </ol>
            </aside>
          </section>
        </>
      )}

      <section className="stage-frame" aria-label="Game scene">
        <div className="stage-grain" />
        <div ref={hostRef} className="stage-host" />
        <div className="hint">{demoHint}</div>
      </section>

      <section className="verb-bar" aria-label="Interaction verbs">
        {(["walk", "look", "use", "talk"] as const).map((verb) => (
          <button
            aria-keyshortcuts={
              verb === "walk" ? "1" : verb === "look" ? "2" : verb === "use" ? "3" : "4"
            }
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
          <strong>{latestEventLabel}</strong>
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
          <strong>{selectedItemLabel}</strong>
        </div>
      </footer>

      {frame.feedback ? <div className="feedback-banner">{frame.feedback}</div> : null}

      {frame.dialogue ? (
        <button className="dialogue-card" type="button" onClick={advanceDialogue}>
          <span className="speaker">{speakerLabel(bundle, frame.dialogue.speakerId)}</span>
          <span className="line">{frame.dialogue.text}</span>
          <span className="continue">Continue</span>
        </button>
      ) : null}
    </main>
  );
}
