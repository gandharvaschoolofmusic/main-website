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
    audioBitsPerSecond: 64_000,
  });
  let bytes = 0;
  recorder.ondataavailable = ({ data }) => {
    if (data.size) chunks.push(data);
    bytes += data.size;
    if (bytes >= 2_500_000 && recorder.state === "recording") rotate();
  };
  recorder.start(2000);
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
  const isRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const selectedMimeRef = useRef<string>("");
  const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Hidden DOM video elements to capture live video frames for canvas compositing
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);


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
      oldRecorder.addEventListener("stop", () => {
        void uploadSegmentBlob(chunksToUpload, segStartTime);
      }, { once: true });
      oldRecorder.stop();

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
      const res = await uploadSegmentBlob(finalChunks, finalStart);
      setIsUploading(false);
      return res;
    }

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

    localVideoRef.current = createHiddenVideo();
    remoteVideoRef.current = createHiddenVideo();
    screenShareVideoRef.current = createHiddenVideo();

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

    // 3. Connect existing local mic and camera
    const checkLocalTracks = () => {
      if (!room.localParticipant) return;
      for (const pub of room.localParticipant.audioTrackPublications.values()) {
        if (pub.track?.mediaStreamTrack) {
          bindLocalAudio(pub);
        }
      }
      for (const pub of room.localParticipant.videoTrackPublications.values()) {
        if (pub.track?.mediaStreamTrack) {
          if (pub.source === Track.Source.ScreenShare && screenShareVideoRef.current) {
            screenShareVideoRef.current.srcObject = new MediaStream([pub.track.mediaStreamTrack]);
            screenShareVideoRef.current.play().catch(() => {});
          } else if (localVideoRef.current) {
            localVideoRef.current.srcObject = new MediaStream([pub.track.mediaStreamTrack]);
            localVideoRef.current.play().catch(() => {});
          }
        }
      }
    };

    // Listen for local tracks published after initial room connection
    const handleLocalTrackPublished = (pub: LocalTrackPublication) => {
      if (pub.track?.kind === Track.Kind.Audio && pub.track.mediaStreamTrack) {
        bindLocalAudio(pub);
      } else if (pub.track?.kind === Track.Kind.Video && pub.track.mediaStreamTrack) {
        if (pub.source === Track.Source.ScreenShare && screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = new MediaStream([pub.track.mediaStreamTrack]);
          screenShareVideoRef.current.play().catch(() => {});
        } else if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([pub.track.mediaStreamTrack]);
          localVideoRef.current.play().catch(() => {});
        }
      }
    };

    const handleLocalTrackUnpublished = (pub: LocalTrackPublication) => {
      if (pub.kind === Track.Kind.Audio) {
        localAudioListeners.get(pub.trackSid)?.();
        localAudioListeners.delete(pub.trackSid);
      } else if (pub.track?.kind === Track.Kind.Video) {
        if (pub.source === Track.Source.ScreenShare && screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = null;
        }
      }
    };

    // 4. Connect remote participant tracks
    const handleTrackSubscribed = (
      track: RemoteTrack,
      pub: RemoteTrackPublication,
    ) => {
      resumeAudioIfSuspended();
      if (track.kind === Track.Kind.Audio) {
        addAudioTrack(track.mediaStreamTrack, pub.trackSid);
      } else if (track.kind === Track.Kind.Video) {
        if (track.source === Track.Source.ScreenShare && screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
          screenShareVideoRef.current.play().catch(() => {});
        } else if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
          remoteVideoRef.current.play().catch(() => {});
        }
      }
    };

    const handleTrackUnsubscribed = (
      track: RemoteTrack,
      pub: RemoteTrackPublication,
    ) => {
      if (track.kind === Track.Kind.Audio && recordingInputs.get(pub.trackSid)?.input === track.mediaStreamTrack) {
        removeAudioTrack(pub.trackSid);
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

    // 5. Canvas Compositing Engine (854x480 @ 15fps)
    const canvas = document.createElement("canvas");
    canvas.width = 854;
    canvas.height = 480;
    const ctx = canvas.getContext("2d", { alpha: false });

    let lastDrawTime = 0;
    const frameInterval = 1000 / 15; // 15 fps for high performance & moderate file size

    const drawFrame = (timestamp: number, scheduleNext = true) => {
      if (isCleanedUp || !isRecordingRef.current || !ctx) return;

      if (timestamp - lastDrawTime >= frameInterval) {
        lastDrawTime = timestamp;

        // Background: Gandharva luxury dark stage theme
        const grad = ctx.createLinearGradient(0, 0, 854, 480);
        grad.addColorStop(0, "#0E0C18");
        grad.addColorStop(1, "#160A29");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 854, 480);

        const hasScreenShare =
          screenShareVideoRef.current &&
          screenShareVideoRef.current.readyState >= 2 &&
          !screenShareVideoRef.current.paused;

        const hasLocalVideo =
          localVideoRef.current &&
          localVideoRef.current.readyState >= 2 &&
          !localVideoRef.current.paused;

        const hasRemoteVideo =
          remoteVideoRef.current &&
          remoteVideoRef.current.readyState >= 2 &&
          !remoteVideoRef.current.paused;

        if (hasScreenShare) {
          // Screen share dominant layout
          try {
            ctx.drawImage(screenShareVideoRef.current!, 0, 0, 854, 480);
          } catch {
            // Ignore frame render issue
          }

          // Small Picture-in-Picture for speakers in corner
          if (hasLocalVideo) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(16, 320, 192, 108);
            try {
              ctx.drawImage(localVideoRef.current!, 16, 320, 192, 108);
            } catch {}
          }
          if (hasRemoteVideo) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(646, 320, 192, 108);
            try {
              ctx.drawImage(remoteVideoRef.current!, 646, 320, 192, 108);
            } catch {}
          }
        } else if (hasLocalVideo && hasRemoteVideo) {
          // Side-by-side balanced stage layout (419px width each, 8px center gap)
          const feedWidth = 419;
          const feedHeight = 440;
          const feedY = 20;

          // Left feed: Teacher
          ctx.save();
          ctx.beginPath();
          ctx.rect(12, feedY, feedWidth, feedHeight);
          ctx.clip();
          try {
            ctx.drawImage(localVideoRef.current!, 12, feedY, feedWidth, feedHeight);
          } catch {}
          ctx.restore();

          // Right feed: Student
          ctx.save();
          ctx.beginPath();
          ctx.rect(423, feedY, feedWidth, feedHeight);
          ctx.clip();
          try {
            ctx.drawImage(remoteVideoRef.current!, 423, feedY, feedWidth, feedHeight);
          } catch {}
          ctx.restore();

          // Badges
          ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
          ctx.fillRect(20, 420, 140, 24);
          ctx.fillRect(431, 420, 160, 24);

          ctx.fillStyle = "#E7C976";
          ctx.font = "bold 11px sans-serif";
          ctx.fillText("Teacher (Instructor)", 26, 436);
          ctx.fillText(partnerName || "Student", 437, 436);
        } else if (hasLocalVideo) {
          // Only local active
          try {
            ctx.drawImage(localVideoRef.current!, 167, 30, 520, 390);
          } catch {}
        } else if (hasRemoteVideo) {
          // Only remote active
          try {
            ctx.drawImage(remoteVideoRef.current!, 167, 30, 520, 390);
          } catch {}
        }

        // Discreet watermark in header
        ctx.fillStyle = "rgba(231, 201, 118, 0.4)";
        ctx.font = "10px sans-serif";
        ctx.fillText(
          `Gandharva School of Music • ${instrument || "Class"} Session`,
          16,
          16,
        );
      }

      if (scheduleNext) animationFrameIdRef.current = requestAnimationFrame(drawFrame);
    };

    // 6. Start Recording Stream
    const startMediaRecording = () => {
      if (isCleanedUp || isRecordingRef.current) return;

      checkLocalTracks();

      // Check remote participants already in room
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track) {
            handleTrackSubscribed(pub.track, pub);
          }
        });
      });

      // Capture canvas stream at 15fps
      const canvasStream = canvas.captureStream(15);
      const audioTrack = destination.stream.getAudioTracks()[0];

      const tracksToRecord: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
      if (audioTrack) {
        tracksToRecord.push(audioTrack);
      }

      const combinedStream = new MediaStream(tracksToRecord);
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

      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

      stopAndUpload();

      combinedStreamRef.current?.getVideoTracks().forEach(track => track.stop());
      destination.stream.getTracks().forEach(track => track.stop());
      if (audioCtx.state !== "closed") void audioCtx.close().catch(() => {});
      // Clean up cloned audio tracks
      for (const id of recordingInputs.keys()) removeAudioTrack(id);

      // Clean up hidden video elements
      if (localVideoRef.current) {
        try {
          localVideoRef.current.pause();
          localVideoRef.current.srcObject = null;
        } catch {
          // Ignore
        }
        if (localVideoRef.current.parentNode) {
          localVideoRef.current.parentNode.removeChild(localVideoRef.current);
        }
      }
      if (remoteVideoRef.current) {
        try {
          remoteVideoRef.current.pause();
          remoteVideoRef.current.srcObject = null;
        } catch {
          // Ignore
        }
        if (remoteVideoRef.current.parentNode) {
          remoteVideoRef.current.parentNode.removeChild(remoteVideoRef.current);
        }
      }
      if (screenShareVideoRef.current) {
        try {
          screenShareVideoRef.current.pause();
          screenShareVideoRef.current.srcObject = null;
        } catch {
          // Ignore
        }
        if (screenShareVideoRef.current.parentNode) {
          screenShareVideoRef.current.parentNode.removeChild(screenShareVideoRef.current);
        }
      }
    };
  }, [isRecorderRole, room, lessonId, instrument, partnerName, stopAndUpload, cycleRecordingSegment]);

  return {
    stopAndUpload,
    isRecording,
    isUploading,
  };
}
