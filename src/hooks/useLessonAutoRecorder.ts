"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { startLessonFrameClock } from "@/lib/lesson-frame-clock";
import { drawLessonStage, lessonStageItems, lessonStageLayout } from "@/lib/lesson-stage-layout";
import { createLessonSegmentRecorder } from "@/lib/lesson-recording-segments";
import { Room, RoomEvent, TrackEvent, LocalAudioTrack, Track, RemoteTrack, RemoteTrackPublication, LocalTrackPublication } from "livekit-client";

interface UseLessonAutoRecorderProps {
  room: Room | undefined | null;
  lessonId: string;
  isTeacher: boolean;
  callerRole?: string;
  partnerName: string;
  instrument: string;
  enabled?: boolean;
}

/**
 * useLessonAutoRecorder
 *
 * Automatically and silently records the lesson stage (teacher + student video, screen shares)
 * and mixed audio (microphone feeds from both sides) in the background.
 *
 * Highlights:
 * - Bounded canvas rendering while server recording is unavailable.
 * - Dynamic composite layout: auto-adapts to screen share or side-by-side video feeds.
 * - Mixed AudioContext engine combining local and remote audio.
 * - Safely stops and uploads recording to Supabase when lesson ends.
 */
export function useLessonAutoRecorder({
  room,
  lessonId,
  isTeacher,
  callerRole,
  partnerName,
  instrument,
  enabled,
}: UseLessonAutoRecorderProps) {
  // Client recorder runs whenever enabled (or as automatic fail-safe when teacher is in room)
  const isRecorderRole =
    enabled !== undefined
      ? enabled
      : process.env.NEXT_PUBLIC_ENABLE_CLIENT_RECORDER === "true" ||
        isTeacher ||
        callerRole === "TEACHER";

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const segmentRecorder = useRef<ReturnType<typeof createLessonSegmentRecorder> | null>(null);
  const [recordingWarning, setRecordingWarning] = useState("");
  const isRecordingRef = useRef(false);
  const stopRenderingRef = useRef<(() => void) | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);

  // Upload a completed segment blob to the backend (Supabase storage)
  const uploadSegmentBlob = useCallback(
    async (
      chunks: Blob[],
      startTime: number,
      endTime: number,
      mimeType: string,
    ): Promise<{
      success: boolean;
      fileUrl?: string;
      storageBackend?: string;
      error?: string;
    }> => {
      if (chunks.length === 0) {
        return { success: false, error: "No video chunks recorded." };
      }

      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size < 100) {
        return { success: false, error: "Recording segment was too small or empty." };
      }

      const durationSeconds = Math.max(
        1,
        Math.round((endTime - startTime) / 1000),
      );

      const formData = new FormData();
      formData.append(
        "file",
        blob,
        `lesson_${lessonId}_${Date.now()}.${mimeType.startsWith("video/mp4") ? "mp4" : "webm"}`,
      );
      formData.append("durationSeconds", String(durationSeconds));
      formData.append("segmentId", crypto.randomUUID());

      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`/api/lessons/${lessonId}/recording`, {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(60000),
            priority: "low" as RequestPriority,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (res.status >= 400 && res.status < 500 && res.status !== 429) {
              return { success: false, error: errData.error || "Recording upload was rejected." };
            }
            throw new Error(errData.error || `Server responded with status ${res.status}`);
          }

          const data = await res.json();
          return {
            success: true,
            fileUrl: data.fileUrl,
            storageBackend: data.storageBackend,
          };
        } catch (err) {
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[AutoRecorder] Segment upload failed:", msg);
          return { success: false, error: msg };
        }
      }
    },
    [lessonId],
  );


  const stopAndUpload = useCallback(async () => {
    const recorder = segmentRecorder.current;
    isRecordingRef.current = false;
    setIsRecording(false);
    stopRenderingRef.current?.();
    stopRenderingRef.current = null;
    if (!recorder) return { success: true };
    setIsUploading(true);
    try {
      return await recorder.stop();
    } finally {
      if (segmentRecorder.current === recorder) setIsUploading(false);
    }
  }, []);

  useEffect(() => {
    if (!isRecorderRole || !room || !lessonId) return;

    // Check MediaRecorder browser support
    if (typeof window === "undefined" || !window.MediaRecorder) {
      console.warn("[AutoRecorder] MediaRecorder not supported in this browser.");
      return;
    }

    let isCleanedUp = false;

    // Helper: Create off-screen video element (avoids display:none which halts browser decoding)
    const createHiddenVideo = () => {
      const el = document.createElement("video");
      el.muted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.style.position = "fixed";
      el.style.top = "-9999px";
      el.style.left = "-9999px";
      el.style.width = "480px";
      el.style.height = "270px";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      return el;
    };

    // 1. Initialize AudioContext and Destination
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const audioSources = new Map<string, MediaStreamAudioSourceNode>();
    const recordingInputs = new Map<string, { input: MediaStreamTrack; track: MediaStreamTrack; stream: MediaStream; isCloned: boolean }>();
    const destination = audioCtx.createMediaStreamDestination();

    const resumeAudioIfSuspended = () => {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    };

    // Unlock AudioContext on any user gesture (click, tap, keypress)
    const handleUserGestureUnlock = () => {
      resumeAudioIfSuspended();
    };
    window.addEventListener("click", handleUserGestureUnlock, { passive: true });
    window.addEventListener("touchstart", handleUserGestureUnlock, { passive: true });
    window.addEventListener("keydown", handleUserGestureUnlock, { passive: true });

    // 2. Connect audio tracks to destination using cloned tracks so the live WebRTC audio is never hijacked
    const addAudioTrack = (track: MediaStreamTrack, id: string, clone = true) => {
      if (isCleanedUp || recordingInputs.get(id)?.input === track) return;
      removeAudioTrack(id);
      resumeAudioIfSuspended();
      let audioTrackToUse = track;
      try {
        // Clone track for background recording so Web Audio graph NEVER silences or alters
        // the original track delivering audio to the participant's speakers!
        let isCloned = false;
        try {
          if (clone && typeof track.clone === "function") {
            audioTrackToUse = track.clone();
            isCloned = true;
          }
        } catch (cloneErr) {
          console.warn("[AutoRecorder] Track clone fallback to direct:", cloneErr);
          audioTrackToUse = track;
        }

        const stream = new MediaStream([audioTrackToUse]);
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(destination);
        audioSources.set(id, source);
        recordingInputs.set(id, { input: track, track: audioTrackToUse, stream, isCloned });
      } catch (err) {
        if (audioTrackToUse !== track) audioTrackToUse.stop();
        console.warn("[AutoRecorder] Could not connect audio track:", err);
      }
    };

    const removeAudioTrack = (id: string) => {
      const source = audioSources.get(id);
      if (source) {
        try {
          source.disconnect();
        } catch {
          // Ignore
        }
        audioSources.delete(id);
      }
      const item = recordingInputs.get(id);
      if (item) {
        if (item.isCloned) {
          try {
            item.track.stop();
          } catch {}
        }
        recordingInputs.delete(id);
      }
    };

    const localAudioListeners = new Map<string, () => void>();
    const bindLocalAudio = (pub: LocalTrackPublication) => {
      const track = pub.audioTrack;
      if (!(track instanceof LocalAudioTrack) || localAudioListeners.has(pub.trackSid)) return;
      const refresh = () => {
        removeAudioTrack(pub.trackSid);
        // Use the actual input so local mute also silences the recording.
        addAudioTrack(track.mediaStreamTrack, pub.trackSid, false);
      };
      refresh();
      track.on(TrackEvent.Restarted, refresh);
      localAudioListeners.set(pub.trackSid, () => {
        track.off(TrackEvent.Restarted, refresh);
        removeAudioTrack(pub.trackSid);
      });
    };

    const canvas = document.createElement("canvas");
    canvas.width = 854;
    canvas.height = 480;
    const ctx = canvas.getContext("2d", { alpha: false });
    const videos = new Map<string, { video: HTMLVideoElement; detach: () => void }>();
    let stageTrack: MediaStreamTrack | undefined;

    type Publication = LocalTrackPublication | RemoteTrackPublication;
    const addPublication = (pub: Publication) => {
      const track = pub.track;
      if (!track) return;
      if (track.kind === Track.Kind.Audio) {
        if (pub instanceof LocalTrackPublication) bindLocalAudio(pub);
        else addAudioTrack(track.mediaStreamTrack, pub.trackSid);
      } else if (!videos.has(pub.trackSid)) {
        const video = createHiddenVideo();
        track.attach(video);
        videos.set(pub.trackSid, { video, detach: () => { track.detach(video); video.remove(); } });
      }
    };
    const removePublication = (pub: Publication) => {
      localAudioListeners.get(pub.trackSid)?.();
      localAudioListeners.delete(pub.trackSid);
      removeAudioTrack(pub.trackSid);
      videos.get(pub.trackSid)?.detach();
      videos.delete(pub.trackSid);
    };
    const subscribed = (_track: RemoteTrack, pub: RemoteTrackPublication) => addPublication(pub);
    const unsubscribed = (_track: RemoteTrack, pub: RemoteTrackPublication) => removePublication(pub);
    room.on(RoomEvent.TrackSubscribed, subscribed);
    room.on(RoomEvent.TrackUnsubscribed, unsubscribed);
    room.on(RoomEvent.LocalTrackPublished, addPublication);
    room.on(RoomEvent.LocalTrackUnpublished, removePublication);

    const drawFrame = () => {
      if (isCleanedUp || !ctx || !segmentRecorder.current?.isCapturing) return;
      drawLessonStage(ctx, lessonStageLayout(lessonStageItems([
        room.localParticipant, ...room.remoteParticipants.values(),
      ])), videos);
    };

    // 6. Start Recording Stream
    const startMediaRecording = () => {
      if (isCleanedUp || isRecordingRef.current) return;

      room.localParticipant.trackPublications.forEach(addPublication);
      room.remoteParticipants.forEach(participant => participant.trackPublications.forEach(addPublication));

      stageTrack = canvas.captureStream(15).getVideoTracks()[0];
      const video = stageTrack;
      const audio = destination.stream.getAudioTracks()[0];
      if (!ctx || !video || !audio) {
        console.error("[AutoRecorder] Both video and audio are required for lesson recording.");
        return;
      }
      drawFrame();
      const combinedStream = new MediaStream([video, audio]);
      combinedStreamRef.current = combinedStream;

      // Select mime type
      const mimeTypes = [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm",
        "video/mp4",
      ];
      const selectedMime =
        mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      try {
        let uploadError = "";
        const recorder = createLessonSegmentRecorder({
          stream: () => combinedStreamRef.current!,
          mimeType: selectedMime,
          upload: (chunks, start, end) => uploadSegmentBlob(chunks, start, end, selectedMime),
          onPaused: paused => {
            if (!isCleanedUp) setRecordingWarning(paused
              ? "Recording is paused while uploads catch up. Your live lesson can continue."
              : uploadError);
          },
          onError: () => {
            uploadError = "Part of this lesson could not be recorded or saved. Your live lesson can continue.";
            if (!isCleanedUp) setRecordingWarning(uploadError);
          },
        });
        segmentRecorder.current = recorder;
        recorder.start();
        isRecordingRef.current = true;
        setIsRecording(true);
        setRecordingWarning("");

        // Draw initial frame immediately so stream has active frames
        drawFrame();
        stopRenderingRef.current = startLessonFrameClock(drawFrame);
      } catch (recErr) {
        console.warn("[AutoRecorder] Failed to start MediaRecorder:", recErr);
      }
    };

    if (room.state === "connected") {
      startMediaRecording();
    } else {
      room.once(RoomEvent.Connected, startMediaRecording);
    }

    // Teardown when room leaves or unmounts
    const handleBeforeUnload = () => {
      stopAndUpload();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      isCleanedUp = true;
      room.off(RoomEvent.Connected, startMediaRecording);
      localAudioListeners.forEach(unbind => unbind());
      localAudioListeners.clear();
      stopRenderingRef.current?.();
      stopRenderingRef.current = null;
      window.removeEventListener("click", handleUserGestureUnlock);
      window.removeEventListener("touchstart", handleUserGestureUnlock);
      window.removeEventListener("keydown", handleUserGestureUnlock);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);

      room.off(RoomEvent.TrackSubscribed, subscribed);
      room.off(RoomEvent.TrackUnsubscribed, unsubscribed);
      room.off(RoomEvent.LocalTrackPublished, addPublication);
      room.off(RoomEvent.LocalTrackUnpublished, removePublication);

      stopAndUpload();

      stageTrack?.stop();
      destination.stream.getTracks().forEach(track => track.stop());
      if (audioCtx.state !== "closed") void audioCtx.close().catch(() => {});
      // Clean up cloned audio tracks
      for (const id of recordingInputs.keys()) removeAudioTrack(id);

      videos.forEach(entry => entry.detach());
      videos.clear();
    };
  }, [isRecorderRole, room, lessonId, instrument, partnerName, stopAndUpload, uploadSegmentBlob]);

  return {
    stopAndUpload,
    isRecording,
    isUploading,
    recordingWarning,
  };
}
