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

export type PlayerSurfaceMode = "play" | "showcase" | "capture";

export type PlayerPresentation = {
  mode: PlayerSurfaceMode;
  showDemoGuide: boolean;
  showDiagnostics: boolean;
  showHeader: boolean;
  showSurfaceToggle: boolean;
};

function presentationFor(mode: PlayerSurfaceMode): PlayerPresentation {
  return {
    mode,
    showDemoGuide: mode === "showcase",
    showDiagnostics: import.meta.env.DEV && mode !== "play",
    showHeader: mode !== "play",
    showSurfaceToggle: mode !== "play"
  };
}

function readSurfaceMode(): PlayerSurfaceMode {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "capture") return "capture";
  if (mode === "showcase" || mode === "guide") return "showcase";
  return "play";
}

function writeSurfaceMode(mode: PlayerSurfaceMode) {
  const url = new URL(window.location.href);
  if (mode === "play") url.searchParams.delete("mode");
  else url.searchParams.set("mode", mode);

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
      initialSceneId: sceneId,
    },
  };
}

async function loadPreviewBundle(): Promise<ProjectBundle> {
  const bundleUrl = new URLSearchParams(window.location.search).get(
    "bundleUrl",
  );
  if (!bundleUrl) {
    return applySceneOverride(sampleBundle);
  }

  const response = await fetch(bundleUrl);
  if (!response.ok) {
    throw new Error("Preview bundle could not be loaded.");
  }

  return applySceneOverride((await response.json()) as ProjectBundle);
}

function buildDemoSteps(
  frame: RuntimeFrame,
  engine: AdventureEngine,
): DemoStep[] {
  const inspectedDoor = engine.events.some(
    (event) =>
      event.type === "hotspot/interacted" &&
      event.hotspotId === "tavern-entrance" &&
      event.verb === "look",
  );
  const collectedHook =
    frame.state.collectedPickups.includes("dock-hook") ||
    frame.state.inventory.includes("rusty-hook");
  const usedHook = frame.state.flags["tavern.hook-used"] === true;

  return [
    {
      id: "inspect-door",
      label: "Inspect the tavern door",
      description: "Switch to Look, then click the amber tavern entrance.",
      done: inspectedDoor,
    },
    {
      id: "collect-hook",
      label: "Collect the rusty hook",
      description:
        "Switch to Use, click the dock hook, then select it in the inventory bar.",
      done: collectedHook,
    },
    {
      id: "use-hook",
      label: "Use the hook on the door",
      description:
        "With Rusty Hook selected, click the tavern entrance again to trigger the state change.",
      done: usedHook,
    },
  ];
}

function nextDemoHint(steps: DemoStep[]): string {
  const nextStep = steps.find((step) => !step.done);
  if (!nextStep) {
    return "Demo loop complete. Capture the final dialogue and footer state for the finish.";
  }

  return nextStep.description;
}

function localize(
  bundle: ProjectBundle,
  labelKey: string,
  fallback: string,
): string {
  return (
    bundle.locales[bundle.manifest.defaultLocale]?.strings[labelKey] ?? fallback
  );
}

function humanizeIdentifier(value: string): string {
  return value
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function speakerLabel(bundle: ProjectBundle, speakerId: string): string {
  return localize(
    bundle,
    `speaker.${speakerId}`,
    humanizeIdentifier(speakerId),
  );
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

function buildStorySignals(
  frame: RuntimeFrame,
  engine: AdventureEngine,
): StorySignal[] {
  const inspectedDoor = engine.events.some(
    (event) =>
      event.type === "hotspot/interacted" &&
      event.hotspotId === "tavern-entrance" &&
      event.verb === "look",
  );
  const collectedHook =
    frame.state.collectedPickups.includes("dock-hook") ||
    frame.state.inventory.includes("rusty-hook");
  const openedLatch = frame.state.flags["tavern.hook-used"] === true;

  return [
    {
      id: "door-inspected",
      label: "Door inspected",
      detail: "The first look interaction has fired.",
      done: inspectedDoor,
    },
    {
      id: "hook-collected",
      label: "Hook collected",
      detail: "The sample inventory now contains the rusty hook.",
      done: collectedHook,
    },
    {
      id: "latch-opened",
      label: "Latch opened",
      detail: "The item-use flow updated world state.",
      done: openedLatch,
    },
  ];
}

function formatEvent(
  event: AdventureEngine["events"][number],
  bundle: ProjectBundle,
  scene: Layered2DScene,
): string {
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
    case "scene/changed":
      return `scene changed: ${bundle.scenes[event.sceneId]?.name ?? event.sceneId}`;
    case "hotspot/interacted": {
      const hotspot = scene.hotspots.find(
        (entry) => entry.id === event.hotspotId,
      );
      return `hotspot ${event.verb}: ${localize(bundle, hotspot?.labelKey ?? "", hotspot?.id ?? event.hotspotId)}`;
    }
    case "actor/interacted": {
      const actor = scene.actors.find((entry) => entry.id === event.actorId);
      return `actor ${event.verb}: ${localize(bundle, actor?.labelKey ?? "", actor?.id ?? event.actorId)}`;
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
  const [surfaceMode, setSurfaceMode] = useState<PlayerSurfaceMode>(() =>
    readSurfaceMode(),
  );
  const assetBaseUrl =
    new URLSearchParams(window.location.search).get("assetBaseUrl") ??
    undefined;
  const engine = useMemo(
    () => (bundle ? new AdventureEngine(bundle) : null),
    [bundle],
  );
  const [frame, setFrame] = useState<RuntimeFrame | null>(null);
  const scene = engine?.currentScene as Layered2DScene | undefined;
  const rendererReady = frame !== null;
  const presentation = presentationFor(surfaceMode);
  const captureMode = surfaceMode === "capture";
  const inventoryItems =
    frame?.state.inventory
      .map((itemId) => bundle?.items[itemId])
      .filter((item) => item !== undefined) ?? [];
  const demoSteps = frame && engine ? buildDemoSteps(frame, engine) : [];
  const completedDemoSteps = demoSteps.filter((step) => step.done).length;
  const demoHint =
    demoSteps.length > 0
      ? nextDemoHint(demoSteps)
      : "Preparing the current demo loop…";
  const playHint = "Choose a verb, then click the scene.";
  const surfaceHint = presentation.showDemoGuide || captureMode ? demoHint : playHint;
  const storySignals = frame && engine ? buildStorySignals(frame, engine) : [];
  const recentEvents =
    bundle && engine && scene
      ? engine.events
          .slice(-4)
          .reverse()
          .map((event) => formatEvent(event, bundle, scene))
      : [];
  const selectedItemLabel =
    bundle && frame?.state.selectedItemId
      ? localize(
          bundle,
          bundle.items[frame.state.selectedItemId]?.labelKey ?? "",
          bundle.items[frame.state.selectedItemId]?.name ??
            frame.state.selectedItemId,
        )
      : "None";
  const latestEventLabel = recentEvents[0] ?? "ready";
  const captionText =
    frame?.presentationCues
      .map((cue) => (cue.key ? localize(bundle ?? sampleBundle, cue.key, cue.key) : cue.value))
      .filter((value): value is string => Boolean(value))
      .at(-1) ?? null;
  useEffect(() => {
    let cancelled = false;

    void loadPreviewBundle()
      .then((nextBundle) => {
        if (cancelled) return;
        setBundle(nextBundle);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Preview bundle could not be loaded.",
        );
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
    if (!host || !bundle || !engine || !scene || !rendererReady) return;

    let disposed = false;
    let movementAnimationFrame: number | null = null;
    const activeBundle = bundle;
    const activeEngine = engine;
    const publishFrame = (nextFrame: RuntimeFrame) => {
      frameRef.current = nextFrame;
      rendererRef.current?.renderPlayer(
        nextFrame.pathProgress?.position ?? nextFrame.state.player,
      );
      rendererRef.current?.renderCollectedPickups(
        nextFrame.state.collectedPickups,
      );
      rendererRef.current?.renderVisibleActors(
        activeEngine.visibleActors().map((actor) => actor.id),
      );
      setFrame(nextFrame);
    };
    const publishAndAnimate = (initialFrame: RuntimeFrame) => {
      if (movementAnimationFrame !== null) {
        cancelAnimationFrame(movementAnimationFrame);
        movementAnimationFrame = null;
      }
      publishFrame(initialFrame);
      if (!activeEngine.isMoving) return;

      const advance = () => {
        movementAnimationFrame = null;
        if (disposed || !activeEngine.isMoving) return;
        publishFrame(activeEngine.tickMovement(4));
        if (activeEngine.isMoving) {
          movementAnimationFrame = requestAnimationFrame(advance);
        }
      };
      movementAnimationFrame = requestAnimationFrame(advance);
    };
    const renderer = new PixiSceneRenderer(
      scene,
      {
        onWalk: (position) => {
          const currentFrame = frameRef.current;
          if (!currentFrame) return;

          const nextFrame =
            currentFrame.state.activeVerb === "walk"
              ? activeEngine.walkTo(position.x, position.y)
              : {
                  ...activeEngine.selectVerb("walk"),
                  feedback: "Switched to Walk.",
                };
          publishAndAnimate(nextFrame);
        },
        onActor: (actorId) => {
          const nextFrame = activeEngine.interactActor(actorId);
          publishAndAnimate(nextFrame);
        },
        onHotspot: (hotspotId) => {
          const nextFrame = activeEngine.interactHotspot(hotspotId);
          publishAndAnimate(nextFrame);
        },
        onPickup: (pickupId) => {
          const nextFrame = activeEngine.interactPickup(pickupId);
          publishAndAnimate(nextFrame);
        },
      },
      {
        animationPacks: activeBundle.animationPacks,
        assets: activeBundle.assets,
        ...(assetBaseUrl ? { assetBaseUrl } : {})
      },
    );
    rendererRef.current = renderer;

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => renderer.resizeToHost(host));
    resizeObserver?.observe(host);

    void renderer.mount(host).then(() => {
      const nextFrame = frameRef.current;
      if (!disposed && nextFrame) {
        renderer.resizeToHost(host);
        renderer.renderPlayer(nextFrame.state.player);
        renderer.renderCollectedPickups(nextFrame.state.collectedPickups);
        renderer.renderVisibleActors(activeEngine.visibleActors().map((actor) => actor.id));
      }
    });

    return () => {
      disposed = true;
      if (movementAnimationFrame !== null) {
        cancelAnimationFrame(movementAnimationFrame);
      }
      resizeObserver?.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [assetBaseUrl, bundle, engine, rendererReady, scene]);

  useEffect(() => {
    if (!frame || !engine) return;
    rendererRef.current?.renderPlayer(frame.state.player);
    rendererRef.current?.renderCollectedPickups(frame.state.collectedPickups);
    rendererRef.current?.renderVisibleActors(engine.visibleActors().map((actor) => actor.id));
  }, [engine, frame]);

  const advanceDialogue = () => {
    if (!engine) return;
    const nextFrame = engine.advanceDialogue();
    if (!nextFrame) return;

    frameRef.current = nextFrame;
    rendererRef.current?.renderPlayer(nextFrame.state.player);
    rendererRef.current?.renderCollectedPickups(
      nextFrame.state.collectedPickups,
    );
    rendererRef.current?.renderVisibleActors(engine.visibleActors().map((actor) => actor.id));
    setFrame(nextFrame);
  };

  const selectVerb = (verb: "walk" | "look" | "use" | "talk") => {
    if (!engine) return;

    const nextFrame = engine.selectVerb(verb);
    frameRef.current = nextFrame;
    setFrame(nextFrame);
  };

  const toggleItem = (itemId: string) => {
    if (!engine) return;

    const nextFrame = engine.toggleSelectedItem(itemId);
    frameRef.current = nextFrame;
    setFrame(nextFrame);
  };

  const changeSurfaceMode = (mode: PlayerSurfaceMode) => {
    setSurfaceMode(mode);
    writeSurfaceMode(mode);
  };

  const changeLocale = (locale: string) => {
    if (!engine) return;
    const nextFrame = engine.setLocale(locale);
    frameRef.current = nextFrame;
    setFrame(nextFrame);
  };

  const chooseDialogue = (choiceId: string) => {
    if (!engine) return;
    const nextFrame = engine.chooseDialogue(choiceId);
    frameRef.current = nextFrame;
    setFrame(nextFrame);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target) || !engine)
        return;

      if (event.key === " " || event.key === "Enter") {
        if (!frameRef.current?.dialogue) return;
        event.preventDefault();
        const nextFrame = engine.advanceDialogue();
        frameRef.current = nextFrame;
        rendererRef.current?.renderPlayer(nextFrame.state.player);
        rendererRef.current?.renderCollectedPickups(
          nextFrame.state.collectedPickups,
        );
        rendererRef.current?.renderVisibleActors(engine.visibleActors().map((actor) => actor.id));
        setFrame(nextFrame);
        return;
      }

      const directionByKey = {
        ArrowUp: { x: 0, y: -48 },
        ArrowDown: { x: 0, y: 48 },
        ArrowLeft: { x: -48, y: 0 },
        ArrowRight: { x: 48, y: 0 }
      } as const;
      const direction = directionByKey[event.key as keyof typeof directionByKey];
      if (direction) {
        event.preventDefault();
        const current = frameRef.current;
        if (!current) return;
        const planned = engine.walkTo(
          current.state.player.x + direction.x,
          current.state.player.y + direction.y,
        );
        const nextFrame = engine.isMoving ? engine.completeMovement() : planned;
        frameRef.current = nextFrame;
        rendererRef.current?.renderPlayer(nextFrame.state.player);
        setFrame(nextFrame);
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        const nextMode = surfaceMode === "capture" ? "showcase" : "capture";
        setSurfaceMode(nextMode);
        writeSurfaceMode(nextMode);
        return;
      }

      const verbByKey = {
        "1": "walk",
        "2": "look",
        "3": "use",
        "4": "talk",
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
          <div className="hint" aria-live="polite">{loadError}</div>
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
          <div className="hint" aria-live="polite">Preparing the selected project…</div>
        </section>
      </main>
    );
  }

  return (
    <main className={`player-shell ${surfaceMode}-mode`}>
      <a className="skip-link" href="#game-stage">
        Skip to game scene
      </a>
      {presentation.showHeader ? (
        <header className="game-header">
          <div>
            <p className="eyebrow">Foundation playable</p>
            <h1>{bundle.manifest.title}</h1>
          </div>
          {presentation.showSurfaceToggle ? (
            <div
              className="status-panel"
              aria-label="Player surface mode"
              role="group"
            >
              <div className="status">
                <span>Scene</span>
                <strong>{scene.name}</strong>
              </div>
              <label className="locale-picker">
                <span>Locale</span>
                <select
                  aria-label="Game locale"
                  value={engine.locale}
                  onChange={(event) => changeLocale(event.target.value)}
                >
                  {Object.keys(bundle.locales).map((locale) => (
                    <option key={locale} value={locale}>
                      {locale}
                    </option>
                  ))}
                </select>
              </label>
              <div className="surface-mode-toggle">
                <button
                  aria-pressed={surfaceMode === "showcase"}
                  className={surfaceMode === "showcase" ? "active" : ""}
                  type="button"
                  onClick={() => changeSurfaceMode("showcase")}
                >
                  Showcase
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
          ) : null}
        </header>
      ) : null}

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
      ) : presentation.showDemoGuide ? (
        <>
          <section className="demo-brief" aria-label="Sample demo checklist">
            <div className="demo-brief-copy">
              <p className="eyebrow">Demo-first sample</p>
              <h2>Record the full point-and-click loop in one take.</h2>
              <p className="demo-summary">
                This sample is small on purpose: scene, hotspot, inventory, item
                use, flow, and state update are all visible in under 30 seconds.
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
              <article
                className={step.done ? "demo-step done" : "demo-step"}
                key={step.id}
              >
                <span className="demo-step-index">0{index + 1}</span>
                <div>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </div>
                <strong>{step.done ? "Done" : "Next"}</strong>
              </article>
            ))}
          </section>

          <section
            className="demo-state-strip"
            aria-label="Current story state"
          >
            <div className="story-signals">
              {storySignals.map((signal) => (
                <article
                  className={signal.done ? "story-signal done" : "story-signal"}
                  key={signal.id}
                >
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
      ) : null}

      <section
        id="game-stage"
        className="stage-frame"
        aria-label="Game scene"
        tabIndex={-1}
      >
        <div className="stage-grain" />
        <div ref={hostRef} className="stage-host" />
        <div className="hint" aria-live="polite">
          {surfaceHint}
        </div>
        {captionText ? (
          <div className="captions" aria-live="polite" aria-label="Captions">
            {captionText}
          </div>
        ) : null}
      </section>

      <section className="verb-bar" aria-label="Interaction verbs">
        {(["walk", "look", "use", "talk"] as const).map((verb) => (
          <button
            aria-keyshortcuts={
              verb === "walk"
                ? "1"
                : verb === "look"
                  ? "2"
                  : verb === "use"
                    ? "3"
                    : "4"
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
                className={
                  frame.state.selectedItemId === item.id ? "selected" : ""
                }
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
              >
                {bundle.locales[bundle.manifest.defaultLocale]?.strings[
                  item.labelKey
                ] ?? item.name}
              </button>
            ))
          )}
        </div>
      </section>

      {presentation.showDiagnostics ? <footer className="game-footer">
        <div className="event-readout">
          <span>Event trace</span>
          <strong>{latestEventLabel}</strong>
        </div>
        <div className="event-readout">
          <span>Position</span>
          <strong>
            {Math.round(frame.state.player.x)},{" "}
            {Math.round(frame.state.player.y)}
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
        <div className="event-readout">
          <span>Path</span>
          <strong>
            {frame.pathProgress
              ? `${Math.round(frame.pathProgress.ratio * 100)}%`
              : "idle"}
          </strong>
        </div>
      </footer> : null}

      {frame.feedback ? (
        <div className="feedback-banner" aria-live="polite">
          {frame.feedback}
        </div>
      ) : null}

      {frame.dialogue && frame.choices.length === 0 ? (
        <button
          aria-live="polite"
          className="dialogue-card"
          type="button"
          onClick={advanceDialogue}
        >
          <span className="speaker">
            {speakerLabel(bundle, frame.dialogue.speakerId)}
          </span>
          <span className="line">{frame.dialogue.text}</span>
          <span className="continue">Continue</span>
        </button>
      ) : null}
      {frame.promptKey ? (
        <section className="dialogue-choices" aria-label="Dialogue choices">
          <p>{localize(bundle, frame.promptKey, frame.promptKey)}</p>
          <div>
            {frame.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => chooseDialogue(choice.id)}
              >
                {localize(bundle, choice.labelKey, choice.labelKey)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
