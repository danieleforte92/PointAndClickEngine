import type { AudioBackend } from "@pointclick/audio";

export function createBrowserAudioBackend(assetBaseUrl?: string): AudioBackend {
  return {
    play(cue, volume) {
      const audio = new Audio(
        new URL(cue.source, assetBaseUrl ?? window.location.href).toString(),
      );
      audio.loop = cue.loop ?? false;
      audio.volume = volume;
      void audio.play().catch((error: unknown) => {
        console.warn(`Audio cue "${cue.id}" could not start`, error);
      });

      return {
        stop() {
          audio.pause();
          audio.currentTime = 0;
        },
        setVolume(nextVolume) {
          audio.volume = nextVolume;
        },
      };
    },
  };
}
