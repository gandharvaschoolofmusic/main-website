import { AudioPresets, Track, type AudioCaptureOptions, type Room } from "livekit-client";
import type { AudioMode } from "./audio-engine";

export type MicrophoneSettings = { mode: AudioMode; deviceId: string };

export function microphoneOptions({ mode, deviceId }: MicrophoneSettings): AudioCaptureOptions {
  const speech = mode === "TALKING";
  return {
    // An ideal default also preserves the other constraints when the SDK restarts capture.
    deviceId: deviceId ? { exact: deviceId } : { ideal: "default" },
    echoCancellation: speech,
    noiseSuppression: speech,
    autoGainControl: speech,
    channelCount: { ideal: speech ? 1 : 2 },
    sampleRate: { ideal: 48000 },
  };
}

export function microphoneTrack(room: Room) {
  return room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
}

// Negotiate a music-capable sender once. Capture can then change between mono
// speech and stereo music without invalidating the remote participant's subscription.
const publishOptions = {
  audioPreset: AudioPresets.musicHighQualityStereo,
  forceStereo: true,
  dtx: false,
  red: true,
};

export async function enableLessonMicrophone(
  room: Room, settings: MicrophoneSettings, signal: AbortSignal, applied = settings,
): Promise<MicrophoneSettings> {
  let selected = settings;
  let retriedBusyDevice = false;
  for (;;) {
    signal.throwIfAborted();
    if (room.state !== "connected") throw new Error("Wait for the lesson to connect, then turn on your microphone.");
    try {
      const track = microphoneTrack(room);
      if (track && (track.mediaStreamTrack.readyState === "ended" || selected !== applied)) {
        await track.restartTrack(microphoneOptions(selected));
        signal.throwIfAborted();
      }
      const publication = await room.localParticipant.setMicrophoneEnabled(
        true, microphoneOptions(selected), publishOptions,
      );
      if (!publication?.audioTrack || publication.audioTrack.mediaStreamTrack.readyState !== "live") {
        throw new Error("Microphone did not start. Choose a microphone or turn it on again.");
      }
      return selected;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (selected.deviceId && (name === "OverconstrainedError" || name === "NotFoundError")) {
        selected = { ...selected, deviceId: "" };
      } else if (!retriedBusyDevice && (name === "NotReadableError" || name === "TrackStartError")) {
        retriedBusyDevice = true;
        await new Promise(resolve => setTimeout(resolve, 400));
      } else {
        throw error;
      }
    }
  }
}

export async function restartLessonMicrophone(
  room: Room, previous: MicrophoneSettings, next: MicrophoneSettings,
) {
  const track = microphoneTrack(room);
  if (!track) throw new Error("Turn on your microphone to start capturing audio.");
  try {
    await track.restartTrack(microphoneOptions(next));
  } catch (error) {
    // Some browser drivers release the old input before opening the replacement.
    // Recover the previous input, or expose a real muted state for an explicit retry.
    if (room.state === "connected") {
      try {
        await track.restartTrack(microphoneOptions(previous));
      } catch {
        await track.mute();
      }
    }
    throw error;
  }
}
