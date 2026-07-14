import { describe, expect, it, vi } from "vitest";
import { AudioMixer, resolveAudioAssetCue, type AudioHandle, type AudioCue } from "./index";

function cue(id: string, channel: AudioCue["channel"]): AudioCue {
  return { id, channel, source: `${id}.ogg`, captionKey: `${id}.caption` };
}

describe("audio mixer", () => {
  it("keeps channel volumes and active tracks independent", () => {
    const handles: AudioHandle[] = [];
    const backend = {
      play: vi.fn((_cue: AudioCue, _volume: number) => {
        const handle = { stop: vi.fn(), setVolume: vi.fn() };
        handles.push(handle);
        return handle;
      })
    };
    const mixer = new AudioMixer(backend, {
      en: { locale: "en", strings: { "voice.caption": "Hello" } }
    });

    mixer.setVolume("music", 0.25);
    const caption = mixer.play(cue("voice", "voice"), {
      requestedLocale: "it",
      projectLocale: "en"
    });
    mixer.play({ id: "wind", channel: "ambience", source: "wind.ogg" });

    expect(caption?.text).toBe("Hello");
    expect(mixer.getVolume("music")).toBe(0.25);
    expect(mixer.snapshot().active.voice).toEqual(["voice"]);
    expect(mixer.snapshot().active.ambience).toEqual(["wind"]);
    expect(handles[0]?.setVolume).not.toHaveBeenCalled();
    mixer.stopChannel("voice");
    expect(handles[0]?.stop).toHaveBeenCalledOnce();
  });

  it("falls back to the project locale for captions", () => {
    const mixer = new AudioMixer(
      { play: () => ({ stop() {}, setVolume() {} }) },
      { en: { locale: "en", strings: { "sfx.caption": "Door" } } }
    );
    expect(mixer.play(cue("sfx", "sfx"), { requestedLocale: "it", projectLocale: "en" })).toMatchObject({
      locale: "en",
      text: "Door"
    });
  });
});

describe("audio asset resolution", () => {
  it("maps sound keys to typed audio assets and rejects image assets", () => {
    const audio = resolveAudioAssetCue("door", {
      door: {
        schemaVersion: 1,
        id: "door",
        kind: "audio",
        path: "assets/door.ogg",
        source: "imported",
        channel: "sfx",
        volume: 0.75
      }
    });
    expect(audio.cue).toMatchObject({ id: "door", channel: "sfx", volume: 0.75 });

    expect(
      resolveAudioAssetCue("door", {
        door: {
          schemaVersion: 1,
          id: "door",
          kind: "image",
          path: "assets/door.png",
          source: "imported"
        }
      }).issue
    ).toContain("non-audio");
  });
});
