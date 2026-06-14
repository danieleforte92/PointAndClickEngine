import type { Layered2DScene } from "@pointclick/contracts";
import { PixiSceneRenderer } from "@pointclick/renderer-2d";
import { AdventureEngine, type RuntimeFrame } from "@pointclick/runtime";
import { sampleBundle } from "@pointclick/sample-game";
import { useEffect, useMemo, useRef, useState } from "react";

export function PlayerApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiSceneRenderer | null>(null);
  const engine = useMemo(() => new AdventureEngine(sampleBundle), []);
  const [frame, setFrame] = useState<RuntimeFrame>(() => engine.start());
  const scene = engine.currentScene as Layered2DScene;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const renderer = new PixiSceneRenderer(scene, {
      onWalk: (position) => {
        const nextFrame = engine.walkTo(position.x, position.y);
        renderer.renderPlayer(nextFrame.state.player);
        setFrame(nextFrame);
      },
      onHotspot: (hotspotId) => {
        const nextFrame = engine.activateHotspot(hotspotId);
        renderer.renderPlayer(nextFrame.state.player);
        setFrame(nextFrame);
      }
    });
    rendererRef.current = renderer;
    renderer.renderPlayer(engine.state.player);

    void renderer.mount(host).then(() => {
      if (!disposed) renderer.renderPlayer(engine.state.player);
    });

    return () => {
      disposed = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [engine, scene]);

  const advanceDialogue = () => {
    const nextFrame = engine.advanceDialogue();
    rendererRef.current?.renderPlayer(nextFrame.state.player);
    setFrame(nextFrame);
  };

  return (
    <main className="player-shell">
      <header className="game-header">
        <div>
          <p className="eyebrow">Foundation playable</p>
          <h1>The Isle of Echoes</h1>
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
      </footer>

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
