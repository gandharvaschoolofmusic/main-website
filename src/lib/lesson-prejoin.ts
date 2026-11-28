import type { AudioMode } from "./audio-engine";

export function needsInstrumentHeadphones({ audioMode, isAudioMuted, companion, headphonesAcknowledged }: {
  audioMode: AudioMode;
  isAudioMuted: boolean;
  companion: boolean;
  headphonesAcknowledged: boolean;
}): boolean {
  return audioMode === "PLAYING" && !isAudioMuted && !companion && !headphonesAcknowledged;
}
