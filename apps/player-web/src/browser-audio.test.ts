import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserAudioBackend } from "./browser-audio.js";

class FakeAudio {
  static instances: FakeAudio[] = [];

  readonly source: string;
  currentTime = 4;
  loop = false;
  paused = false;
  volume = 1;

  constructor(source: string) {
    this.source = source;
    FakeAudio.instances.push(this);
  }

  play() {
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

describe("browser audio backend", () => {
  afterEach(() => {
    FakeAudio.instances = [];
    vi.unstubAllGlobals();
  });

  it("plays, updates and stops a resolved audio source", () => {
    vi.stubGlobal("Audio", FakeAudio);
    const handle = createBrowserAudioBackend("https://studio.test/assets/").play(
      {
        id: "harbour-wind",
        channel: "ambience",
        source: "audio/harbour-wind.ogg",
        loop: true,
      },
      0.42,
    );

    expect(FakeAudio.instances).toHaveLength(1);
    const audio = FakeAudio.instances[0]!;
    expect(audio.source).toBe(
      "https://studio.test/assets/audio/harbour-wind.ogg",
    );
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(0.42);

    handle.setVolume(0.25);
    expect(audio.volume).toBe(0.25);

    handle.stop();
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
  });
});
