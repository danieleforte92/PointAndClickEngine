import type { AssetDocument } from "@pointclick/contracts";

export const AUDIO_CHANNELS = ["music", "ambience", "sfx", "voice"] as const;
export type AudioChannel = (typeof AUDIO_CHANNELS)[number];

export interface AudioCue {
  id: string;
  channel: AudioChannel;
  source: string;
  loop?: boolean;
  volume?: number;
  captionKey?: string;
}

export interface AudioAssetResolution {
  cue: AudioCue | null;
  issue: string | null;
}

/** Resolve a runtime `sound.key` against the project asset index. */
export function resolveAudioAssetCue(
  key: string,
  assets: Readonly<Record<string, AssetDocument>>
): AudioAssetResolution {
  const asset = assets[key];
  if (!asset) {
    return { cue: null, issue: `Audio cue "${key}" references a missing asset.` };
  }
  if (asset.kind !== "audio") {
    return { cue: null, issue: `Audio cue "${key}" references a non-audio asset.` };
  }
  return {
    cue: {
      id: asset.id,
      channel: asset.channel,
      source: asset.path,
      ...(asset.loop !== undefined ? { loop: asset.loop } : {}),
      ...(asset.volume !== undefined ? { volume: asset.volume } : {}),
      ...(asset.captionKey ? { captionKey: asset.captionKey } : {})
    },
    issue: null
  };
}

export interface CaptionLocale {
  locale: string;
  strings: Readonly<Record<string, string>>;
}

export interface AudioCaption {
  cueId: string;
  text: string;
  locale: string;
}

export interface AudioHandle {
  stop(): void;
  setVolume(volume: number): void;
}

export interface AudioBackend {
  play(cue: AudioCue, volume: number): AudioHandle;
}

export interface AudioMixerSnapshot {
  volumes: Readonly<Record<AudioChannel, number>>;
  active: Readonly<Record<AudioChannel, readonly string[]>>;
}

const DEFAULT_VOLUMES: Record<AudioChannel, number> = {
  music: 0.8,
  ambience: 0.7,
  sfx: 1,
  voice: 1
};

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) throw new RangeError("Audio volume must be finite.");
  return Math.max(0, Math.min(1, volume));
}

function emptyActive(): Record<AudioChannel, string[]> {
  return { music: [], ambience: [], sfx: [], voice: [] };
}

export function resolveCaption(
  cue: AudioCue,
  requestedLocale: string,
  projectLocale: string,
  locales: Readonly<Record<string, CaptionLocale>>
): AudioCaption | null {
  if (!cue.captionKey) return null;
  const requested = locales[requestedLocale];
  const project = locales[projectLocale];
  const text = requested?.strings[cue.captionKey] ?? project?.strings[cue.captionKey];
  if (!text) return null;
  return {
    cueId: cue.id,
    text,
    locale: requested?.strings[cue.captionKey] ? requestedLocale : projectLocale
  };
}

export class AudioMixer {
  private readonly volumes: Record<AudioChannel, number> = { ...DEFAULT_VOLUMES };
  private readonly active = emptyActive();
  private readonly handles = new Map<string, AudioHandle>();

  constructor(
    private readonly backend: AudioBackend,
    private readonly captions: Readonly<Record<string, CaptionLocale>> = {}
  ) {}

  setVolume(channel: AudioChannel, volume: number): number {
    const normalized = clampVolume(volume);
    this.volumes[channel] = normalized;
    for (const cue of this.active[channel]) {
      this.handles.get(cue)?.setVolume(normalized);
    }
    return normalized;
  }

  getVolume(channel: AudioChannel): number {
    return this.volumes[channel];
  }

  play(
    cue: AudioCue,
    options: { requestedLocale?: string; projectLocale?: string } = {}
  ): AudioCaption | null {
    const channelVolume = this.volumes[cue.channel];
    const handle = this.backend.play(cue, clampVolume(channelVolume * (cue.volume ?? 1)));
    this.handles.set(cue.id, handle);
    if (!this.active[cue.channel].includes(cue.id)) this.active[cue.channel].push(cue.id);
    return resolveCaption(
      cue,
      options.requestedLocale ?? options.projectLocale ?? "en",
      options.projectLocale ?? "en",
      this.captions
    );
  }

  stop(cueId: string): void {
    this.handles.get(cueId)?.stop();
    this.handles.delete(cueId);
    for (const channel of AUDIO_CHANNELS) {
      const index = this.active[channel].indexOf(cueId);
      if (index >= 0) this.active[channel].splice(index, 1);
    }
  }

  stopChannel(channel: AudioChannel): void {
    for (const cueId of [...this.active[channel]]) this.stop(cueId);
  }

  snapshot(): AudioMixerSnapshot {
    return {
      volumes: { ...this.volumes },
      active: {
        music: [...this.active.music],
        ambience: [...this.active.ambience],
        sfx: [...this.active.sfx],
        voice: [...this.active.voice]
      }
    };
  }
}

export function createSilentAudioBackend(): AudioBackend {
  return {
    play: () => ({
      stop() {},
      setVolume() {}
    })
  };
}
