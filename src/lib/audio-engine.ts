import {
  AudioPresets,
  createLocalAudioTrack,
  LocalAudioTrack,
  Room,
  Track,
  TrackPublishOptions,
} from "livekit-client";
import { logger } from "@/lib/logger";

export type AudioMode = "TALKING" | "PLAYING";

/**
 * WebRTC constraints for conversational speech.
 * Default browser processors enabled for echo cancellation and ambient noise suppression.
 */
export const TALKING_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: { ideal: 1 },
};

/**
 * WebRTC constraints for musical instrument performance.
 * Keeps acoustic echo cancellation active to prevent speaker-to-mic feedback loops,
 * while disabling noise suppression and auto-gain control to preserve pristine instrument harmonics and dynamic range.
 */
export const PLAYING_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true, // Crucial: prevents acoustic echo feedback loops when users use speakers
  noiseSuppression: false, // Disabled: preserves musical notes, harmonics, sustain, and guitar tones
  autoGainControl: false,  // Disabled: preserves full musical volume dynamics (pianissimo to fortissimo)
  channelCount: { ideal: 2 },
  sampleRate: { ideal: 48000 },
};

/**
 * LiveKit audio encoding presets corresponding to each audio mode.
 */
export function getAudioPublishOptions(mode: AudioMode): TrackPublishOptions {
  if (mode === "TALKING") {
    return {
      audioPreset: AudioPresets.speech,
      dtx: false, // Keep continuous transmission so quiet voices / soft notes aren't cut off
    };
  }

  return {
    audioPreset: AudioPresets.musicHighQualityStereo,
    dtx: false, // Do NOT gate decaying notes or reverb tails
    red: true, // Redundant Audio Data for packet loss recovery
  };
}

/**
 * Runtime audio mode switcher.
 *
 * Constraints are baked into MediaStreamTrack at creation. To switch mode:
 * 1. Find and unpublish the existing mic track.
 * 2. Stop the old media track.
 * 3. Create a fresh LocalAudioTrack with the target constraint profile.
 * 4. Publish the new track with specialized encoding options.
 */
export async function switchLocalAudioMode(
  room: Room,
  targetMode: AudioMode,
  deviceId?: string,
): Promise<LocalAudioTrack> {
  const localParticipant = room.localParticipant;
  const constraints =
    targetMode === "PLAYING"
      ? PLAYING_AUDIO_CONSTRAINTS
      : TALKING_AUDIO_CONSTRAINTS;

  logger.info({ targetMode, deviceId }, "Switching local audio track mode");

  // 1. Unpublish and stop existing audio publication
  for (const pub of localParticipant.audioTrackPublications.values()) {
    if (pub.track) {
      pub.track.stop();
      if (pub.track.mediaStreamTrack) {
        pub.track.mediaStreamTrack.stop();
      }
      await localParticipant.unpublishTrack(pub.track, true);
    }
  }

  // 2. Create new local audio track with target constraint profile
  let newTrack: LocalAudioTrack;
  try {
    newTrack = await createLocalAudioTrack({
      ...constraints,
      deviceId: deviceId ? { ideal: deviceId } : undefined,
    });
  } catch (err) {
    logger.warn({ err, deviceId }, "Failed to create audio track with ideal deviceId, falling back to mode constraints");
    try {
      newTrack = await createLocalAudioTrack(constraints);
    } catch (fallbackErr) {
      logger.warn({ fallbackErr }, "Failed with mode constraints, falling back to permissive default mic");
      newTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    }
  }

  // 3. Publish with high-fidelity or speech preset and explicitly identify as microphone source
  const publishOptions: TrackPublishOptions = {
    ...getAudioPublishOptions(targetMode),
    source: Track.Source.Microphone,
    name: "microphone",
  };
  await localParticipant.publishTrack(newTrack, publishOptions);

  logger.info(
    {
      targetMode,
      settings: newTrack.mediaStreamTrack.getSettings(),
    },
    "Successfully published new audio track",
  );

  return newTrack;
}

/**
 * Web Audio API real-time RMS and Peak Level Analyser for VU Metering.
 *
 * Allows musician to see their instrument's raw input levels, check for dead mics,
 * and ensure instrument attacks do not digitally clip.
 */
export function createAudioLevelMeter(
  stream: MediaStream,
  onLevelChange: (rms: number, peak: number) => void,
): () => void {
  let isRunning = true;
  let animId: number | null = null;
  let audioContext: AudioContext | null = null;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioContext = new AudioContextClass();

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!isRunning) return;

      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      let peak = 0;

      for (let i = 0; i < dataArray.length; i++) {
        // Center around 0 (-1.0 to 1.0)
        const normalized = (dataArray[i] - 128) / 128;
        const absVal = Math.abs(normalized);
        if (absVal > peak) peak = absVal;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Pass normalized values (0.0 to 1.0)
      onLevelChange(Math.min(1, rms * 2.5), Math.min(1, peak));

      animId = requestAnimationFrame(tick);
    };

    tick();
  } catch (err) {
    logger.warn({ err }, "Could not initialize Web Audio Analyser");
  }

  return () => {
    isRunning = false;
    if (animId !== null) cancelAnimationFrame(animId);
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  };
}
