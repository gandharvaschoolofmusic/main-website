"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import {
  ConnectionQuality,
  DisconnectReason,
  LocalTrackPublication,
  type Room,
  RoomEvent,
  Track,
  VideoPresets,
} from "livekit-client";
import type { AudioMode } from "@/lib/audio-engine";
import { useLessonMicrophone } from "@/hooks/useLessonMicrophone";
import { useLessonAudioPlayback } from "@/hooks/useLessonAudioPlayback";
import { releaseAllMediaDevices } from "@/lib/media-devices";
import { watchLessonVideo } from "@/lib/lesson-video-recovery";
import { MeetRoomUI } from "./MeetRoomUI";

import { TurnTakingState } from "./TurnTakingControls";

import { getSyncedInternetTime } from "@/lib/synced-time";
import { useMultiCamera } from "@/hooks/useMultiCamera";
import { MultiCameraModal } from "./MultiCameraModal";
import { useLessonAutoRecorder } from "@/hooks/useLessonAutoRecorder";

interface LessonRoomProps {
  room: Room;
  token: string;
  serverUrl: string;
  lesson: {
    id: string;
    instrument: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    partnerName: string;
    isTeacher: boolean;
    companion?: boolean;
    callerRole?: "TEACHER" | "STUDENT";
    lessonSource?: string | null;
  };
  initialConfig: {
    previewMicrophone?: { current: MediaStreamTrack | null };
    audioDeviceId: string;
    videoDeviceId: string;
    audioMode: AudioMode;
    isAudioMuted?: boolean;
    isVideoMuted?: boolean;
  };
  onLeave: () => void;
}

export function LessonRoom(props: LessonRoomProps) {
  const { token, serverUrl, lesson, initialConfig, onLeave } = props;
  const isIntentionalLeaveRef = useRef(false);
  const [disconnectedError, setDisconnectedError] = useState<string | null>(null);
  const hasLeftRef = useRef(false);

  const handleExplicitLeave = () => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    isIntentionalLeaveRef.current = true;
    releaseAllMediaDevices();
    onLeave();
  };

  // Keep callbacks stable: useLiveKitRoom reconnects whenever onError changes.
  const handleConnected = useCallback(() => {
    setDisconnectedError(null);
    if (!lesson.companion) void fetch(`/api/lessons/${lesson.id}/join`, { method: "POST" }).catch(() => {});
  }, [lesson.companion, lesson.id]);
  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    if (isIntentionalLeaveRef.current) return;
    console.warn("[LessonRoom] Disconnected", { reason, lessonId: lesson.id });
    setDisconnectedError(reason === DisconnectReason.PARTICIPANT_REMOVED ? "An admin removed you from this call." : "The lesson connection was lost. Check your connection and retry joining.");
  }, [lesson.id]);
  const handleError = useCallback((err: Error) => {
    if (isIntentionalLeaveRef.current || /Client initiated disconnect|cancelled|aborted/i.test(err.message)) return;
    console.error("[LessonRoom] Connection error", { lessonId: lesson.id, message: err.message, state: props.room.state });
    // A media error must not cover a connected/recovering room with a permanent modal.
    if (props.room.state !== "disconnected") return;
    initialConfig.previewMicrophone?.current?.stop();
    if (initialConfig.previewMicrophone) initialConfig.previewMicrophone.current = null;
    setDisconnectedError(err.message || "Could not connect to the lesson.");
  }, [props.room, lesson.id, initialConfig.previewMicrophone]);
  useEffect(() => {
    const recovered = () => setDisconnectedError(null);
    props.room.on(RoomEvent.Reconnected, recovered);
    return () => { props.room.off(RoomEvent.Reconnected, recovered); };
  }, [props.room]);

  return (
    <div className="fixed inset-0 bg-[#111111] text-stone-100 flex flex-col z-50 overflow-hidden">
      <LiveKitRoom
        room={props.room}
        token={token}
        serverUrl={serverUrl}
        connect={true}
        connectOptions={{
          autoSubscribe: true,
          maxRetries: 10,
          peerConnectionTimeout: 20_000,
        }}
        audio={false} // The microphone controller applies the pre-join choice after connection.
        video={false} // Managed explicitly after engine is connected
        className="w-full h-full flex flex-col"
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onError={handleError}
      >
        <LessonRoomContent
          lesson={lesson}
          initialConfig={initialConfig}
          onLeave={handleExplicitLeave}
        />
      </LiveKitRoom>

      {disconnectedError && (
        <div className="absolute inset-0 z-50 bg-[#0E0C18]/95 backdrop-blur-md flex items-center justify-center p-6">
          <div className="relative max-w-lg w-full overflow-hidden bg-[#161226] rounded-3xl p-6 sm:p-7 text-center space-y-4 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-cta to-accent" />
            <div className="flex justify-center pt-2">
              <Image
                src="/cropped-Add-a-subheading-5-png-scaled.webp"
                alt="Gandharva School of Music"
                width={150}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center text-xl mx-auto font-serif shadow-lg">
              {typeof window !== "undefined" &&
              (serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1")) &&
              window.location.hostname !== "localhost" &&
              window.location.hostname !== "127.0.0.1"
                ? "🌐"
                : "⚠️"}
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-lg font-bold text-white">
                {typeof window !== "undefined" &&
                (serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1")) &&
                window.location.hostname !== "localhost" &&
                window.location.hostname !== "127.0.0.1"
                  ? "LiveKit Cloud URL Required for Remote Devices"
                  : "Room Disconnected"}
              </h3>
              
              {typeof window !== "undefined" &&
              (serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1")) &&
              window.location.hostname !== "localhost" &&
              window.location.hostname !== "127.0.0.1" ? (
                <div className="text-left bg-[#0E0C18] rounded-2xl p-4 space-y-2 text-xs text-stone-300">
                  <p className="leading-relaxed">
                    You opened Gandharva School of Music via <span className="text-cta font-mono font-medium">{window.location.hostname}</span>, but the video engine is configured to connect to <span className="text-cta font-mono font-medium">{serverUrl}</span>.
                  </p>
                  <p className="leading-relaxed text-stone-400">
                    External devices and HTTPS pages require a live cloud server to connect.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    {disconnectedError}
                  </p>
                  <div className="text-[11px] font-mono text-stone-400 mt-2 bg-[#0E0C18] py-1 px-2.5 rounded-lg inline-block">
                    Server: {serverUrl}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary via-cta to-accent hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-primary/30 transition-all active:scale-95 cursor-pointer"
              >
                Retry Connection
              </button>
              <button
                type="button"
                onClick={handleExplicitLeave}
                className="px-5 py-2.5 rounded-xl bg-[#201A36] hover:bg-[#2A2346] text-stone-200 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                Exit to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonRoomContent({
  lesson,
  initialConfig,
  onLeave,
}: {
  lesson: LessonRoomProps["lesson"];
  initialConfig: LessonRoomProps["initialConfig"];
  onLeave: () => void;
}) {
  const room = useRoomContext();

  const mic = useLessonMicrophone(room, initialConfig);
  useLessonAudioPlayback(room);
  const [isVideoOff, setIsVideoOff] = useState(Boolean(initialConfig.isVideoMuted));
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const isLeavingRef = useRef(false);

  // Turn-taking state
  const [activeFloorState, setActiveFloorState] = useState<TurnTakingState>(
    lesson.isTeacher ? "TEACHER_PLAYING" : "DISCUSSION",
  );

  // Connection & Reconnection state
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    ConnectionQuality.Excellent,
  );
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Cameras & Devices
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(
    initialConfig.videoDeviceId || "",
  );

  const cameraState = useRef({ off: isVideoOff, deviceId: selectedCameraId });
  useEffect(() => { cameraState.current = { off: isVideoOff, deviceId: selectedCameraId }; }, [isVideoOff, selectedCameraId]);
  useEffect(() => watchLessonVideo(room, () => !cameraState.current.off, () => cameraState.current.deviceId), [room]);

  // Multi-Camera Director Engine
  const multiCam = useMultiCamera(room, isVideoOff);
  const [isMultiCamModalOpen, setIsMultiCamModalOpen] = useState(false);

  // Recording engine state: "SERVER_EGRESS" | "CLIENT_RECORDER" | "INITIALIZING"
  const [recordingMode, setRecordingMode] = useState<"SERVER_EGRESS" | "CLIENT_RECORDER" | "INITIALIZING">("INITIALIZING");

  // Auto-record the classroom session with Supabase cloud archival fail-safe
  const autoRecorder = useLessonAutoRecorder({
    room,
    lessonId: lesson.id,
    isTeacher: lesson.isTeacher,
    callerRole: lesson.callerRole,
    partnerName: lesson.partnerName,
    instrument: lesson.instrument,
    enabled: recordingMode === "CLIENT_RECORDER" && lesson.isTeacher,
  });

  // Lesson timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const endsAt = new Date(lesson.endsAt).getTime();
    return Math.max(0, Math.floor((endsAt - getSyncedInternetTime()) / 1000));
  });

  // 1. Enumerate camera devices
  useEffect(() => {
    async function getCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setAvailableCameras(videoInputs);
      } catch {
        // Ignore
      }
    }
    getCameras();
  }, []);

  // 2. Countdown lesson timer
  useEffect(() => {
    const interval = setInterval(() => {
      const endsAt = new Date(lesson.endsAt).getTime();
      const diff = Math.max(
        0,
        Math.floor((endsAt - getSyncedInternetTime()) / 1000),
      );
      setRemainingSeconds(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [lesson.endsAt]);

  // 3b. Initialize Video Track safely after engine connects with transition backoff
  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    async function initVideo() {
      if (cancelled || cameraState.current.off || initialConfig.isVideoMuted) {
        console.log("[Video] Camera kept OFF per user Pre-Join selection");
        return;
      }

      const tryEnableCamera = async (attempt = 0): Promise<void> => {
        if (cancelled || cameraState.current.off) return;
        try {
          await room.localParticipant.setCameraEnabled(true, {
            deviceId: initialConfig.videoDeviceId
              ? { ideal: initialConfig.videoDeviceId }
              : undefined,
            resolution: VideoPresets.h720.resolution,
          });
        } catch (deviceErr: unknown) {
          const errObj = deviceErr as { name?: string; message?: string };
          const isBusy =
            errObj?.name === "NotReadableError" ||
            errObj?.name === "TrackStartError" ||
            String(errObj?.message).includes("Could not start video source");

          // When transitioning from PreJoinScreen, OS drivers may take ~300ms to release
          if (isBusy && attempt < 2) {
            console.warn(
              `Camera hardware lock releasing (attempt ${attempt + 1}). Retrying in 400ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 400));
            return tryEnableCamera(attempt + 1);
          }

          if (cancelled || cameraState.current.off) return;
          console.warn("Could not enable camera with preferred deviceId, trying default camera:", deviceErr);
          try {
            await room.localParticipant.setCameraEnabled(true, {
              resolution: VideoPresets.h720.resolution,
            });
          } catch (fallbackErr) {
            console.warn("Could not auto-enable camera on room connect:", fallbackErr);
            if (!cancelled) setIsVideoOff(true);
          }
        }
      };

      await tryEnableCamera();
    }

    if (room.state === "connected") {
      initVideo();
    } else {
      room.once(RoomEvent.Connected, initVideo);
    }
    return () => { cancelled = true; room.off(RoomEvent.Connected, initVideo); };
  }, [room, initialConfig.videoDeviceId, initialConfig.isVideoMuted]);

  // 4. Listen to LiveKit Room Events

  useEffect(() => {
    if (!room) return;

    // Handle incoming data messages (turn taking signal)
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data.type === "TURN_TAKING_SIGNAL" && data.state) {
          setActiveFloorState(data.state);
        }
      } catch {
        // Ignore invalid message formats
      }
    };

    // Connection recovery events
    const handleReconnecting = () => setIsReconnecting(true);
    const handleReconnected = () => setIsReconnecting(false);

    // Quality changes
    const handleQualityChange = (
      quality: ConnectionQuality,
      participant: unknown,
    ) => {
      if (participant === room.localParticipant) {
        setConnectionQuality(quality);
      }
    };

    // Screen share publish/unpublish synchronization
    const handleLocalTrackPublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) {
        setIsScreenSharing(true);
      }
    };
    const handleLocalTrackUnpublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) {
        setIsScreenSharing(false);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.ConnectionQualityChanged, handleQualityChange);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.ConnectionQualityChanged, handleQualityChange);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    };
  }, [room]);

  // Toggle Video
  const handleToggleVideo = async () => {
    const nextOff = !isVideoOff;
    cameraState.current.off = nextOff;
    setIsVideoOff(nextOff);
    try {
      await room.localParticipant.setCameraEnabled(!nextOff, {
        deviceId:
          selectedCameraId ||
          (initialConfig.videoDeviceId
            ? { ideal: initialConfig.videoDeviceId }
            : undefined),
        resolution: VideoPresets.h720.resolution,
      });
    } catch (e) {
      console.warn("Could not toggle camera with preferred device, trying default:", e);
      try {
        await room.localParticipant.setCameraEnabled(!nextOff, {
          resolution: VideoPresets.h720.resolution,
        });
      } catch (err2) {
        setIsVideoOff(!room.localParticipant.isCameraEnabled);
        console.error("Camera toggle failed completely:", err2);
      }
    }
  };

  // Toggle Screen Share
  const handleToggleScreenShare = async () => {
    const isPublished = Array.from(room.localParticipant.videoTrackPublications.values()).some(
      (publication) => publication.source === Track.Source.ScreenShare && !publication.isMuted,
    );
    const nextShare = !isPublished;
    try {
      await room.localParticipant.setScreenShareEnabled(nextShare, {
        video: true,
        audio: { restrictOwnAudio: true },
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        systemAudio: "exclude",
        contentHint: "detail",
      });
    } catch (err) {
      console.warn("Screen share error", err);
      setIsScreenSharing(Array.from(room.localParticipant.videoTrackPublications.values()).some(
        (publication) => publication.source === Track.Source.ScreenShare && !publication.isMuted,
      ));
      if (err instanceof DOMException && err.name === "AbortError") return;
      throw err;
    }
  };

  // Switch Camera Device (mid-call hands/face swap)
  const handleCameraDeviceSwitch = async (newDeviceId: string) => {
    setSelectedCameraId(newDeviceId);
    multiCam.setPrimaryCameraId(newDeviceId);
    try {
      await room.switchActiveDevice("videoinput", newDeviceId);
    } catch (err) {
      console.warn("Failed to switch camera device", err);
    }
  };

  // Window unload listener to guarantee camera & mic shut off immediately if tab or browser is closed
  useEffect(() => {
    const handleWindowUnload = () => {
      try {
        if (lesson.companion) { /* Auxiliary devices do not close main-device attendance. */ } else if (navigator.sendBeacon) {
          navigator.sendBeacon(`/api/lessons/${lesson.id}/leave`);
        } else {
          fetch(`/api/lessons/${lesson.id}/leave`, { method: "POST", keepalive: true }).catch(() => {});
        }
      } catch {}
      multiCam.stopSecondaryCamera().catch(() => {});
      releaseAllMediaDevices(room, [multiCam.secondaryTrack]);
    };

    window.addEventListener("beforeunload", handleWindowUnload);
    window.addEventListener("pagehide", handleWindowUnload);

    return () => {
      window.removeEventListener("beforeunload", handleWindowUnload);
      window.removeEventListener("pagehide", handleWindowUnload);
    };
  }, [room, multiCam]);

  // Ensure recording is active when room is connected (prefer server egress; fallback to client recorder)
  useEffect(() => {
    if (!room || !lesson.isTeacher) return;
    let cancelled = false;
    let retryTimer: NodeJS.Timeout | null = null;

    const triggerRecording = async (retryCount = 0) => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/lessons/${lesson.id}/recording/start`, { method: "POST", signal: AbortSignal.timeout(15_000) });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.mode === "SERVER_EGRESS" && data.success) {
            setRecordingMode("SERVER_EGRESS");
            return;
          }
        }
        // Stagger retries to allow room & participant publishing to register on LiveKit Cloud
        if (retryCount < 2) {
          retryTimer = setTimeout(() => {
            if (!cancelled) void triggerRecording(retryCount + 1);
          }, 3500);
          return;
        }
        setRecordingMode("CLIENT_RECORDER");
      } catch {
        if (retryCount < 2) {
          retryTimer = setTimeout(() => {
            if (!cancelled) void triggerRecording(retryCount + 1);
          }, 3500);
          return;
        }
        if (!cancelled) setRecordingMode("CLIENT_RECORDER");
      }
    };

    const startRecording = () => { void triggerRecording(); };

    // Stagger initial check by 2.5s so participants are connected and room is established
    const initTimer = setTimeout(() => {
      if (room.state === "connected") {
        void triggerRecording();
      } else {
        room.once(RoomEvent.Connected, startRecording);
      }
    }, 2500);

    return () => {
      cancelled = true;
      room.off(RoomEvent.Connected, startRecording);
      clearTimeout(initTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [room, lesson.id, lesson.isTeacher]);

  const handleLeaveRoom = async () => {
    // Guard against multiple rapid clicks
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    setIsLeaving(true);
    try {
      // 1. Record exit timestamp immediately
      try {
        if (lesson.companion) { /* Main-device attendance remains active. */ } else if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(`/api/lessons/${lesson.id}/leave`);
        } else {
          fetch(`/api/lessons/${lesson.id}/leave`, {
            method: "POST",
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}

      // Finalize the recorder before stopping its inputs. Release capture immediately,
      // even when saving the final segment takes time.
      const saving = recordingMode === "CLIENT_RECORDER" ? autoRecorder.stopAndUpload() : undefined;
      releaseAllMediaDevices(room, [multiCam.secondaryTrack]);
      try {
        await multiCam.stopSecondaryCamera();
      } catch {
        // Ignore
      }
      if (saving) {
        await Promise.race([
          saving.catch((error) => console.warn("[LessonRoom] Recording upload on leave:", error)),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
      }

      // 4. Disconnect from LiveKit room cleanly
      try {
        room.disconnect();
      } catch {}

      // 5. Return to caller dashboard immediately (seamless, zero-wait exit)
      onLeave();
    } catch (e) {
      console.warn("[LessonRoom] Error during room exit:", e);
      onLeave();
    } finally {
      isLeavingRef.current = false;
      setIsLeaving(false);
    }
  };

  // Format remaining time
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <>
      {!lesson.companion && <RoomAudioRenderer />}
      {autoRecorder.recordingWarning && <div className="meet-call-banner" role="status">{autoRecorder.recordingWarning}</div>}
      {lesson.companion && <div className="meet-companion-choice" role="status">Second device: camera and screen sharing only. Audio stays on your main device.</div>}
      <MeetRoomUI
        localRecording={autoRecorder.isRecording}
        lesson={lesson}
        audioMode={mic.settings.mode}
        isSwitchingAudioMode={mic.busy}
        isMuted={!mic.enabled}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        activeFloorState={activeFloorState}
        onFloorChange={setActiveFloorState}
        connectionQuality={connectionQuality}
        isReconnecting={isReconnecting}
        timeFormatted={timeFormatted}
        availableCameras={availableCameras}
        selectedCameraId={selectedCameraId}
        audioDeviceId={mic.settings.deviceId}
        microphoneError={mic.error}
        onAudioDeviceSwitch={lesson.companion ? async () => {} : mic.selectDevice}
        multiCam={multiCam}
        onToggleMic={lesson.companion ? async () => {} : mic.toggle}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onSwitchAudioMode={lesson.companion ? async () => {} : mic.selectMode}
        onCameraDeviceSwitch={handleCameraDeviceSwitch}
        onOpenMultiCam={() => setIsMultiCamModalOpen(true)}
        onLeave={handleLeaveRoom}
        isLeaving={isLeaving}
      >
        <MultiCameraModal
          isOpen={isMultiCamModalOpen}
          onClose={() => setIsMultiCamModalOpen(false)}
          multiCam={multiCam}
          primaryTrack={Array.from(room.localParticipant.videoTrackPublications.values()).find(
            (publication) => publication.source === Track.Source.Camera && publication.trackName !== "secondary-camera",
          )?.videoTrack}
          onPrimaryDeviceSwitch={handleCameraDeviceSwitch}
          isTeacher={lesson.isTeacher}
        />
      </MeetRoomUI>
    </>
  );
}
