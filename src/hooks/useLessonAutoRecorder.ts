"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, LocalTrackPublication } from "livekit-client";

interface UseLessonAutoRecorderProps {
  room: Room | undefined | null;
  lessonId: string;
  isTeacher: boolean;
  callerRole?: string;
  partnerName: string;
  instrument: string;
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
}: UseLessonAutoRecorderProps) {
  // All participants (Teacher, Student, Admin) record the classroom stage composite
  // so the lecture is guaranteed to be preserved regardless of who joins/leaves first.
  const isRecorderRole = true;

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const hasUploadedRef = useRef(false);

  // Hidden DOM video elements to capture live video frames for canvas compositing
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);

  // Audio track sources map
  const audioSourcesMapRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());

  // Upload finalized recording blob to backend
  const uploadRecording = useCallback(async (): Promise<{
    success: boolean;
    fileUrl?: string;
    storageBackend?: string;
    error?: string;
  }> => {
    if (hasUploadedRef.current) return { success: true };
    if (recordedChunksRef.current.length === 0) {
      return { success: false, error: "No video chunks recorded." };
    }

    setIsUploading(true);

    try {
      const mimeType = mediaRecorderRef.current?.mimeType || "video/webm";
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });

      if (blob.size < 100) {
        setIsUploading(false);
        return { success: false, error: "Recording file was too small or empty." };
      }

      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - (recordingStartTimeRef.current || Date.now())) / 1000),
      );

      const formData = new FormData();
      formData.append(
        "file",
        blob,
        `lesson_${lessonId}_${Date.now()}.webm`,
      );
      formData.append("durationSeconds", String(durationSeconds));

      // Note: Do NOT use keepalive: true, as browsers strictly reject keepalive fetch requests > 64KB!
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s max timeout for large uploads

      const res = await fetch(`/api/lessons/${lessonId}/recording`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      hasUploadedRef.current = true;
      setIsUploading(false);
      return {
        success: true,
        fileUrl: data.fileUrl,
        storageBackend: data.storageBackend,
      };
    } catch (err) {
      setIsUploading(false);
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[AutoRecorder] Upload request failed:", msg);
      return { success: false, error: msg };
    }
  }, [lessonId]);

  // Teardown and stop recorder (returns Promise so callers can await upload completion)
  const stopAndUpload = useCallback(async (): Promise<{
    success: boolean;
    fileUrl?: string;
    error?: string;
  }> => {
    if (hasUploadedRef.current) {
      return { success: true };
    }
    if (!isRecordingRef.current && recordedChunksRef.current.length === 0) {
      return { success: false, error: "No recorded chunks available." };
    }

    isRecordingRef.current = false;
    setIsRecording(false);

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
        // Fallback safety timeout if stop event is delayed
        setTimeout(resolve, 800);
      });
    }

    // Clean up audio context
    try {
      audioSourcesMapRef.current.forEach((src) => {
        try {
          src.disconnect();
        } catch {
          // Ignore
        }
      });
      audioSourcesMapRef.current.clear();
      audioContextRef.current?.close();
    } catch {
      // Ignore
    }

    // Upload finalized recording
    return await uploadRecording();
  }, [uploadRecording]);

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
    audioContextRef.current = audioCtx;
    const destination = audioCtx.createMediaStreamDestination();
    audioDestinationRef.current = destination;

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

    // 2. Connect audio tracks to destination
    const addAudioTrack = (track: MediaStreamTrack, id: string) => {
      if (isCleanedUp || audioSourcesMapRef.current.has(id)) return;
      resumeAudioIfSuspended();
      try {
        const stream = new MediaStream([track]);
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(destination);
        audioSourcesMapRef.current.set(id, source);
      } catch (err) {
        console.warn("[AutoRecorder] Could not connect audio track:", err);
      }
    };

    const removeAudioTrack = (id: string) => {
      const source = audioSourcesMapRef.current.get(id);
      if (source) {
        try {
          source.disconnect();
        } catch {
          // Ignore
        }
        audioSourcesMapRef.current.delete(id);
      }
    };

    // 3. Connect existing local mic and camera
    const checkLocalTracks = () => {
      if (!room.localParticipant) return;
      for (const pub of room.localParticipant.audioTrackPublications.values()) {
        if (pub.track?.mediaStreamTrack) {
          addAudioTrack(pub.track.mediaStreamTrack, "local_audio");
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
        addAudioTrack(pub.track.mediaStreamTrack, "local_audio");
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
      if (pub.track?.kind === Track.Kind.Audio) {
        removeAudioTrack("local_audio");
      } else if (pub.track?.kind === Track.Kind.Video) {
        if (pub.source === Track.Source.ScreenShare && screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = null;
        }
      }
    };

    // 4. Connect remote participant tracks
    const handleTrackSubscribed = (
      track: RemoteTrack,
      pub: unknown,
      participant: RemoteParticipant,
    ) => {
      resumeAudioIfSuspended();
      if (track.kind === Track.Kind.Audio) {
        addAudioTrack(track.mediaStreamTrack, `remote_audio_${participant.identity}`);
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
      pub: unknown,
      participant: RemoteParticipant,
    ) => {
      if (track.kind === Track.Kind.Audio) {
        removeAudioTrack(`remote_audio_${participant.identity}`);
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

    const drawFrame = (timestamp: number) => {
      if (isCleanedUp || !ctx) return;

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

      animationFrameIdRef.current = requestAnimationFrame(drawFrame);
    };

    // 6. Start Recording Stream
    const startMediaRecording = () => {
      if (isCleanedUp || isRecordingRef.current) return;

      checkLocalTracks();

      // Check remote participants already in room
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track) {
            handleTrackSubscribed(pub.track as RemoteTrack, pub, p);
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
        const recorder = new MediaRecorder(combinedStream, {
          mimeType: selectedMime || undefined,
          videoBitsPerSecond: 450_000, // 450 kbps moderate quality, highly optimized
          audioBitsPerSecond: 64_000,  // 64 kbps Opus
        });

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        // Slice every 2 seconds into chunks to ensure data availability even for short calls
        recorder.start(2000);
        mediaRecorderRef.current = recorder;
        isRecordingRef.current = true;
        setIsRecording(true);
        recordingStartTimeRef.current = Date.now();

        // Draw initial frame immediately so stream has active frames
        drawFrame(performance.now());
        animationFrameIdRef.current = requestAnimationFrame(drawFrame);
      } catch (recErr) {
        console.warn("[AutoRecorder] Failed to start MediaRecorder:", recErr);
      }
    };

    // Background timer to keep drawing frames even if tab is minimized/in background
    const bgRenderInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden && !isCleanedUp) {
        drawFrame(performance.now());
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
      clearInterval(bgRenderInterval);
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
  }, [isRecorderRole, room, lessonId, instrument, partnerName, stopAndUpload]);

  return {
    stopAndUpload,
    isRecording,
    isUploading,
  };
}
