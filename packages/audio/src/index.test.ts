import { describe, expect, it, vi } from "vitest";
import { AudioMixer, type AudioHandle, type AudioCue } from "./index";

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
