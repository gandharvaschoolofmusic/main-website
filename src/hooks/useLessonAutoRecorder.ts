"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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

function startSegment(stream: MediaStream, mimeType: string, chunks: Blob[], rotate: () => void) {
  const recorder = new MediaRecorder(stream, {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: 450_000,
    audioBitsPerSecond: 48_000,
  });
  let bytes = 0;
  recorder.ondataavailable = ({ data }) => {
    if (data.size) chunks.push(data);
    bytes += data.size;
    // Rotate safely at ~3.5 MB to stay under Vercel's 4.5 MB body limit without rapid cycling
    if (bytes >= 3_500_000 && recorder.state === "recording") rotate();
  };
  recorder.start(3000);
  return recorder;
}

/**
 * useLessonAutoRecorder
 *
 * Automatically and silently records the lesson stage (teacher + student video, screen shares)
 * and mixed audio (microphone feeds from both sides) in the background.
 *
 * Highlights:
 * - Silent & discreet background operation with zero frame drops.
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pendingParts = useRef(new Set<Promise<unknown>>());
  const isRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const selectedMimeRef = useRef<string>("");
  const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Upload a completed segment blob to the backend (Supabase storage)
  const uploadSegmentBlob = useCallback(
    async (
      chunks: Blob[],
      startTime: number,
    ): Promise<{
      success: boolean;
      fileUrl?: string;
      storageBackend?: string;
      error?: string;
    }> => {
      if (chunks.length === 0) {
        return { success: false, error: "No video chunks recorded." };
      }

      const mimeType = selectedMimeRef.current || mediaRecorderRef.current?.mimeType || "video/webm";
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size < 100) {
        return { success: false, error: "Recording segment was too small or empty." };
      }

      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - (startTime || Date.now())) / 1000),
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

  // Rolling segment cycler: every 4 minutes, closes current part and uploads to Supabase in background
  const cycleRecordingSegment = useCallback(function rotate() {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;
    const oldRecorder = mediaRecorderRef.current;
    if (oldRecorder.state !== "recording" || !combinedStreamRef.current) return;

    const segStartTime = recordingStartTimeRef.current || Date.now();

    try {
      const chunksToUpload = recordedChunksRef.current;
      const stopped = new Promise<void>(resolve => oldRecorder.addEventListener("stop", () => resolve(), { once: true }));
      oldRecorder.stop();
      const saving = stopped.then(() => uploadSegmentBlob(chunksToUpload, segStartTime));
      pendingParts.current.add(saving);
      void saving.finally(() => pendingParts.current.delete(saving)).catch(() => {});

      const chunks: Blob[] = [];
      mediaRecorderRef.current = startSegment(combinedStreamRef.current, selectedMimeRef.current, chunks, rotate);
      recordedChunksRef.current = chunks;
      recordingStartTimeRef.current = Date.now();
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecording(false);
      console.warn("[AutoRecorder] Error during rolling segment cycle:", err);
    }
  }, [uploadSegmentBlob]);

  // Teardown and stop recorder (returns Promise so callers can await upload completion)
  const stopAndUpload = useCallback(async (): Promise<{
    success: boolean;
    fileUrl?: string;
    error?: string;
  }> => {
    if (!isRecordingRef.current) {
      return { success: true };
    }

    isRecordingRef.current = false;
    const finalChunks = recordedChunksRef.current;
    const finalStart = recordingStartTimeRef.current || Date.now();
    setIsRecording(false);

    if (segmentIntervalRef.current) {
      clearInterval(segmentIntervalRef.current);
      segmentIntervalRef.current = null;
    }

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    // Stop MediaRecorder cleanly and wait for onstop event to collect final buffered chunk
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      await new Promise<void>((resolve) => {
        const rec = mediaRecorderRef.current;
        if (!rec) return resolve();

        const onStopHandler = () => {
          rec.removeEventListener("stop", onStopHandler);
          resolve();
        };

        rec.addEventListener("stop", onStopHandler);
        try {
          if (typeof rec.requestData === "function") {
            try {
              rec.requestData();
            } catch {}
          }
          rec.stop();
        } catch {
          resolve();
        }
        setTimeout(resolve, 800);
      });
    }


    if (finalChunks.length > 0) {
      setIsUploading(true);
      const [res] = await Promise.all([uploadSegmentBlob(finalChunks, finalStart), ...pendingParts.current] as const);
      setIsUploading(false);
      return res;
    }

    await Promise.all(pendingParts.current);
    return { success: true };
  }, [uploadSegmentBlob]);

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
    const cameras = new Map<string, { video: HTMLVideoElement; detach: () => void }>();
    const presentations = new Map<string, MediaStreamTrack>();
    let stageTrack: MediaStreamTrack | undefined;

    // Keep a stable stream per encoded part. A native presentation track keeps
    // producing frames when the teacher switches away from the lesson tab.
    const videoSource = () => Array.from(presentations.values()).find(track => track.readyState === "live") ?? stageTrack;
    const syncRecordingVideo = () => {
      const video = videoSource();
      const stream = combinedStreamRef.current;
      if (!isRecordingRef.current || !stream || !video || stream.getVideoTracks()[0] === video) return;
      combinedStreamRef.current = new MediaStream([video, ...destination.stream.getAudioTracks()]);
      cycleRecordingSegment();
    };

    type Publication = LocalTrackPublication | RemoteTrackPublication;
    const addPublication = (pub: Publication) => {
      const track = pub.track;
      if (!track) return;
      if (track.kind === Track.Kind.Audio) {
        if (pub instanceof LocalTrackPublication) bindLocalAudio(pub);
        else addAudioTrack(track.mediaStreamTrack, pub.trackSid);
      } else if (pub.source === Track.Source.ScreenShare) {
        presentations.set(pub.trackSid, track.mediaStreamTrack);
        syncRecordingVideo();
      } else if (!cameras.has(pub.trackSid)) {
        const video = createHiddenVideo();
        track.attach(video);
        cameras.set(pub.trackSid, { video, detach: () => { track.detach(video); video.remove(); } });
      }
    };
    const removePublication = (pub: Publication) => {
      localAudioListeners.get(pub.trackSid)?.();
      localAudioListeners.delete(pub.trackSid);
      removeAudioTrack(pub.trackSid);
      cameras.get(pub.trackSid)?.detach();
      cameras.delete(pub.trackSid);
      if (presentations.delete(pub.trackSid)) syncRecordingVideo();
    };
    const subscribed = (_track: RemoteTrack, pub: RemoteTrackPublication) => addPublication(pub);
    const unsubscribed = (_track: RemoteTrack, pub: RemoteTrackPublication) => removePublication(pub);
    room.on(RoomEvent.TrackSubscribed, subscribed);
    room.on(RoomEvent.TrackUnsubscribed, unsubscribed);
    room.on(RoomEvent.LocalTrackPublished, addPublication);
    room.on(RoomEvent.LocalTrackUnpublished, removePublication);

    let lastFrame = -Infinity;
    const drawFrame = (timestamp: number, schedule = true) => {
      if (isCleanedUp || !ctx) return;
      if (timestamp - lastFrame >= 1000 / 15) {
        lastFrame = timestamp;
        ctx.fillStyle = "#111018";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const feeds = [...cameras.values()].map(entry => entry.video).filter(video =>
          video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
        const cols = Math.max(1, Math.ceil(Math.sqrt(feeds.length)));
        const rows = Math.ceil(feeds.length / cols);
        feeds.forEach((video, i) => {
          const w = canvas.width / cols, h = canvas.height / rows;
          const scale = Math.min(w / video.videoWidth, h / video.videoHeight);
          const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
          ctx.drawImage(video, (i % cols) * w + (w - dw) / 2, Math.floor(i / cols) * h + (h - dh) / 2, dw, dh);
        });
        if (!feeds.length) {
          ctx.fillStyle = "#ece9ef";
          ctx.font = "24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText((instrument || "Music") + " lesson - Cameras off", canvas.width / 2, canvas.height / 2);
        }
      }
      if (schedule && isRecordingRef.current) animationFrameIdRef.current = requestAnimationFrame(drawFrame);
    };

    // 6. Start Recording Stream
    const startMediaRecording = () => {
      if (isCleanedUp || isRecordingRef.current) return;

      room.localParticipant.trackPublications.forEach(addPublication);
      room.remoteParticipants.forEach(participant => participant.trackPublications.forEach(addPublication));

      stageTrack = canvas.captureStream(15).getVideoTracks()[0];
      const video = videoSource();
      const audio = destination.stream.getAudioTracks()[0];
      if (!ctx || !video || !audio) {
        console.error("[AutoRecorder] Both video and audio are required for lesson recording.");
        return;
      }
      drawFrame(performance.now(), false);
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
      selectedMimeRef.current = selectedMime;

      try {
        const chunks: Blob[] = [];
        recordedChunksRef.current = chunks;
        mediaRecorderRef.current = startSegment(combinedStream, selectedMime, chunks, cycleRecordingSegment);
        isRecordingRef.current = true;
        setIsRecording(true);
        recordingStartTimeRef.current = Date.now();

        // Progressive cloud backup: cycle every 4 minutes (240,000 ms) so lessons are safely preserved in parts
        if (segmentIntervalRef.current) clearInterval(segmentIntervalRef.current);
        segmentIntervalRef.current = setInterval(() => {
          if (!isCleanedUp) {
            void cycleRecordingSegment();
          }
        }, 240_000);

        // Draw initial frame immediately so stream has active frames
        drawFrame(performance.now());
      } catch (recErr) {
        console.warn("[AutoRecorder] Failed to start MediaRecorder:", recErr);
      }
    };

    // Background timer to keep drawing frames even if tab is minimized/in background
    const bgRenderInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden && !isCleanedUp) {
        drawFrame(performance.now(), false);
      }
    }, 150);

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
      clearInterval(bgRenderInterval);
      if (segmentIntervalRef.current) {
        clearInterval(segmentIntervalRef.current);
        segmentIntervalRef.current = null;
      }
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

      cameras.forEach(entry => entry.detach());
      cameras.clear();
      presentations.clear();
    };
  }, [isRecorderRole, room, lessonId, instrument, partnerName, stopAndUpload, cycleRecordingSegment]);

  return {
    stopAndUpload,
    isRecording,
    isUploading,
  };
}
