import { AudioPresets, LocalAudioTrack, Track, type AudioCaptureOptions, type Room } from "livekit-client";
import { cleanDeviceLabel, getCleanDeviceList } from "./media-devices";
import type { AudioMode } from "./audio-engine";

export type MicrophoneSettings = { mode: AudioMode; deviceId: string };

export function microphoneOptions({ mode, deviceId }: MicrophoneSettings): AudioCaptureOptions {
  const speech = mode === "TALKING";
  return {
    // An ideal default also preserves the other constraints when the SDK restarts capture.
    deviceId: deviceId ? { exact: deviceId } : { ideal: "default" },
    echoCancellation: true,
    noiseSuppression: speech,
    autoGainControl: speech,
    channelCount: { ideal: speech ? 1 : 2 },
    sampleRate: { ideal: 48000 },
  };
}

// The Windows default may be "Stereo Mix", even though the picker hides loopback inputs.
export async function resolveMicrophoneId(id: string) {
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const input = devices.find(device => device.kind === "audioinput" && device.deviceId === (id || "default"));
  if (!input?.label || cleanDeviceLabel(input.label, "audioinput") !== null) return id;
  const physical = getCleanDeviceList(devices, "audioinput").find(device => !device.isDefault);
  if (!physical) throw new Error("Select a physical microphone in your system sound settings.");
  return physical.deviceId;
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
  preview?: MediaStreamTrack | null,
): Promise<MicrophoneSettings> {
  let selected = settings;
  if (preview?.readyState === "live" && !preview.muted && preview.enabled && !microphoneTrack(room)) {
    const track = new LocalAudioTrack(preview, microphoneOptions(settings), false);
    try {
      await room.localParticipant.publishTrack(track, { ...publishOptions, source: Track.Source.Microphone });
      return settings;
    } catch {
      track.stop();
      signal.throwIfAborted();
    }
  } else {
    preview?.stop();
  }
  let retriedBusyDevice = false;
  for (;;) {
    signal.throwIfAborted();
    if (room.state !== "connected") throw new Error("Wait for the lesson to connect, then turn on your microphone.");
    try {
      const deviceId = await resolveMicrophoneId(selected.deviceId);
      signal.throwIfAborted();
      if (selected.deviceId !== deviceId) selected = { ...selected, deviceId };
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
