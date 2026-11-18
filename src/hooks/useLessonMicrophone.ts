"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { RoomEvent, TrackEvent, type Room } from "livekit-client";
import type { AudioMode } from "@/lib/audio-engine";
import {
  enableLessonMicrophone, microphoneTrack, resolveMicrophoneId, restartLessonMicrophone,
  type MicrophoneSettings,
} from "@/lib/lesson-microphone";

export function useLessonMicrophone(room: Room, initial: {
  audioMode: AudioMode; audioDeviceId: string; isAudioMuted?: boolean;
  previewMicrophone?: { current: MediaStreamTrack | null };
}) {
  const { isMicrophoneEnabled: enabled, microphoneTrack: publication } = useLocalParticipant({ room });
  const [settings, setSettings] = useState<MicrophoneSettings>({
    mode: initial.audioMode, deviceId: initial.audioDeviceId,
  });
  const selected = useRef(settings);
  const applied = useRef(settings);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const queue = useRef(Promise.resolve());
  const changing = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const wanted = useRef(!initial.isAudioMuted);
  const hasCaptured = useRef(false);

  const run = useCallback((action: (signal: AbortSignal) => Promise<void>) => {
    const signal = lifetime.current?.signal;
    const operation = queue.current.then(async () => {
      if (!signal || signal.aborted) return;
      changing.current = true;
      setBusy(true);
      setError("");
      try {
        if (room.state !== "connected") throw new Error("Wait for the lesson to reconnect.");
        await action(signal);
      } catch (cause) {
        if (signal.aborted) return;
        const message = cause instanceof Error && cause.name === "NotAllowedError"
          ? "Allow microphone access in your browser, then turn on your microphone."
          : "Could not start the selected microphone. Check the device in Audio settings and try again.";
        setError(message);
        throw new Error(message, { cause });
      } finally {
        changing.current = false;
        if (!signal.aborted) setBusy(false);
      }
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [room]);

  const enable = useCallback(async (signal: AbortSignal) => {
    const requested = selected.current;
    const preview = initial.previewMicrophone?.current;
    if (initial.previewMicrophone) initial.previewMicrophone.current = null;
    const actual = await enableLessonMicrophone(room, requested, signal, applied.current, preview);
    if (signal.aborted) return;
    selected.current = applied.current = actual;
    hasCaptured.current = true;
    setSettings(actual);
  }, [room, initial.previewMicrophone]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const join = () => {
      if (!initial.isAudioMuted) void run(enable).catch(() => {});
    };
    if (room.state === "connected") join();
    else room.once(RoomEvent.Connected, join);
    return () => {
      controller.abort();
      room.off(RoomEvent.Connected, join);
    };
  }, [room, initial.isAudioMuted, run, enable]);

  const change = useCallback((patch: Partial<MicrophoneSettings>) => run(async signal => {
    const next = { ...selected.current, ...patch };
    if (room.localParticipant.isMicrophoneEnabled) {
      next.deviceId = await resolveMicrophoneId(next.deviceId);
      await restartLessonMicrophone(room, applied.current, next);
      if (signal.aborted) return;
      applied.current = next;
    }
    selected.current = next;
    setSettings(next);
    try {
      localStorage.setItem("toneroom_mic_id", next.deviceId);
      localStorage.setItem("toneroom_audio_mode", next.mode);
    } catch { /* Storage is optional. */ }
  }), [room, run]);

  // LiveKit can independently restart a disconnected USB input on the OS default.
  // Restore the chosen processing profile to that input and update the picker.
  useEffect(() => {
    const track = publication?.audioTrack;
    if (!track) return;
    const recovered = () => {
      if (changing.current || track.isMuted) return;
      const actual = track.mediaStreamTrack.getSettings().deviceId;
      const deviceId = actual === selected.current.deviceId ? actual : "";
      void change({ deviceId }).catch(() => {});
    };
    track.on(TrackEvent.Restarted, recovered);
    return () => { track.off(TrackEvent.Restarted, recovered); };
  }, [publication, change]);

  useEffect(() => {
    let pending = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const needsRecovery = () => {
      const track = microphoneTrack(room);
      return wanted.current && hasCaptured.current && room.state === "connected" &&
        (!track || track.isMuted || track.mediaStreamTrack.readyState === "ended" || track.mediaStreamTrack.muted);
    };
    const recover = () => {
      if (pending || !needsRecovery()) return;
      pending = true;
      // Serialize with settings changes and recheck: the SDK or a user mute may
      // have resolved the interruption while this operation was waiting.
      void run(async signal => {
        if (needsRecovery()) await enable(signal);
      }).catch(() => {}).finally(() => { pending = false; });
    };
    const visible = () => {
      if (document.visibilityState === "visible") recover();
    };
    const track = publication?.audioTrack;
    const muted = () => {
      if (changing.current || track?.mediaStreamTrack.readyState !== "ended") return;
      // The SDK mutes after its own device-restart attempt fails. Give the OS
      // one bounded retry; subsequent retries require a device or page event.
      clearTimeout(retry);
      retry = setTimeout(recover, 500);
    };
    track?.on(TrackEvent.Muted, muted);
    room.on(RoomEvent.Reconnected, recover);
    navigator.mediaDevices?.addEventListener("devicechange", recover);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", visible);
    return () => {
      clearTimeout(retry);
      track?.off(TrackEvent.Muted, muted);
      room.off(RoomEvent.Reconnected, recover);
      navigator.mediaDevices?.removeEventListener("devicechange", recover);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", visible);
    };
  }, [room, publication, run, enable]);

  return {
    settings, enabled, busy, error,
    selectMode: (mode: AudioMode) => change({ mode }),
    selectDevice: (deviceId: string) => change({ deviceId }),
    toggle: () => run(async signal => {
      wanted.current = !room.localParticipant.isMicrophoneEnabled;
      if (wanted.current) await enable(signal);
      else await room.localParticipant.setMicrophoneEnabled(false);
    }),
  };
}
