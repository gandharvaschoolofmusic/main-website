"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import {
  ConnectionQuality,
  DisconnectReason,
  LocalAudioTrack,
  LocalTrackPublication,
  RoomEvent,
  Track,
} from "livekit-client";
import { AudioMode, switchLocalAudioMode } from "@/lib/audio-engine";
import { releaseAllMediaDevices } from "@/lib/media-devices";
import { MeetRoomUI } from "./MeetRoomUI";

import { TurnTakingState } from "./TurnTakingControls";

import { getSyncedInternetTime } from "@/lib/synced-time";
import { useMultiCamera } from "@/hooks/useMultiCamera";
import { MultiCameraModal } from "./MultiCameraModal";
import { useLessonAutoRecorder } from "@/hooks/useLessonAutoRecorder";

interface LessonRoomProps {
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
    callerRole?: "TEACHER" | "STUDENT";
    lessonSource?: string | null;
  };
  initialConfig: {
    audioDeviceId: string;
    videoDeviceId: string;
    audioMode: AudioMode;
  };
  onLeave: () => void;
}

export function LessonRoom(props: LessonRoomProps) {
  const { token, serverUrl, lesson, initialConfig, onLeave } = props;
  const isIntentionalLeaveRef = useRef(false);
  const [isIntentionalLeave, setIsIntentionalLeave] = useState(false);
  const [disconnectedError, setDisconnectedError] = useState<string | null>(null);

  const handleExplicitLeave = () => {
    isIntentionalLeaveRef.current = true;
    setIsIntentionalLeave(true);
    releaseAllMediaDevices();
    onLeave();
  };

  const handleDisconnected = (reason?: DisconnectReason) => {
    if (isIntentionalLeaveRef.current) {
      releaseAllMediaDevices();
      onLeave();
    } else {
      console.warn("LiveKit room disconnected unexpectedly:", reason);
      setDisconnectedError(
        "The live video room was disconnected. Check your connection or LiveKit server status.",
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-[#111111] text-stone-100 flex flex-col z-50 overflow-hidden">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={false} // Managed explicitly via switchLocalAudioMode
        video={false} // Managed explicitly after engine is connected
        className="w-full h-full flex flex-col"
        onDisconnected={handleDisconnected}
        onError={(err) => {
          // Ignore expected client-initiated disconnect cancellations when user exits
          const isExpectedExit =
            isIntentionalLeaveRef.current ||
            isIntentionalLeave ||
            err?.message?.includes("Client initiated disconnect") ||
            err?.message?.includes("cancelled") ||
            err?.message?.includes("aborted");

          if (isExpectedExit) {
            return;
          }

          console.error("LiveKit connection error:", err);
          setDisconnectedError(
            err.message || "Failed to establish WebRTC video room connection.",
          );
        }}
      >
        <RoomAudioRenderer />
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

  // Reference to manually managed local audio track to guarantee track.stop() on teardown
  const currentAudioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Audio Mode & Track state
  const [audioMode, setAudioMode] = useState<AudioMode>(initialConfig.audioMode);
  const [isSwitchingAudioMode, setIsSwitchingAudioMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

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

  // Multi-Camera Director Engine
  const multiCam = useMultiCamera(room, isVideoOff);
  const [isMultiCamModalOpen, setIsMultiCamModalOpen] = useState(false);

  // Automatic silent lesson recording (optimized for zero server lag, saves to Google Drive)
  const autoRecorder = useLessonAutoRecorder({
    room,
    lessonId: lesson.id,
    isTeacher: lesson.isTeacher,
    partnerName: lesson.partnerName,
    instrument: lesson.instrument,
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

  // 3. Initialize Audio Track with specified constraints
  const initializedAudioRef = useRef(false);
  useEffect(() => {
    if (!room || initializedAudioRef.current) return;
    initializedAudioRef.current = true;

    async function initAudio() {
      try {
        setIsSwitchingAudioMode(true);
        const track = await switchLocalAudioMode(
          room,
          initialConfig.audioMode,
          initialConfig.audioDeviceId,
        );
        currentAudioTrackRef.current = track;
      } catch (err) {
        console.error("Failed to initialize custom audio track", err);
      } finally {
        setIsSwitchingAudioMode(false);
      }
    }

    if (room.state === "connected") {
      initAudio();
    } else {
      room.once(RoomEvent.Connected, initAudio);
    }
  }, [room, initialConfig.audioMode, initialConfig.audioDeviceId]);

  // 3b. Initialize Video Track safely after engine connects with transition backoff
  const initializedVideoRef = useRef(false);
  useEffect(() => {
    if (!room || initializedVideoRef.current) return;
    initializedVideoRef.current = true;

    async function initVideo() {
      if (isVideoOff) return;

      const tryEnableCamera = async (attempt = 0): Promise<void> => {
        try {
          await room.localParticipant.setCameraEnabled(true, {
            deviceId: initialConfig.videoDeviceId
              ? { ideal: initialConfig.videoDeviceId }
              : undefined,
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

          console.warn("Could not enable camera with preferred deviceId, trying default camera:", deviceErr);
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch (fallbackErr) {
            console.warn("Could not auto-enable camera on room connect:", fallbackErr);
            setIsVideoOff(true);
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
  }, [room, isVideoOff, initialConfig.videoDeviceId]);

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

  // Handle runtime Audio Mode Switch
  const handleSwitchAudioMode = async (targetMode: AudioMode) => {
    if (isSwitchingAudioMode) return;
    setIsSwitchingAudioMode(true);
    try {
      const track = await switchLocalAudioMode(
        room,
        targetMode,
        initialConfig.audioDeviceId,
      );
      currentAudioTrackRef.current = track;
      setAudioMode(targetMode);
    } catch (err) {
      console.error("Failed to switch audio mode", err);
    } finally {
      setIsSwitchingAudioMode(false);
    }
  };

  // Toggle Microphone
  const handleToggleMic = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    for (const pub of room.localParticipant.audioTrackPublications.values()) {
      if (pub.track) {
        if (nextMuted) {
          pub.track.mute();
        } else {
          pub.track.unmute();
        }
      }
    }
  };

  // Toggle Video
  const handleToggleVideo = async () => {
    const nextOff = !isVideoOff;
    setIsVideoOff(nextOff);
    await room.localParticipant.setCameraEnabled(!nextOff);
  };

  // Toggle Screen Share
  const handleToggleScreenShare = async () => {
    try {
      const nextShare = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(nextShare, {
        audio: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
        systemAudio: "include",
        contentHint: "detail",
      });
      setIsScreenSharing(nextShare);
    } catch (err) {
      console.warn("Screen share error", err);
      setIsScreenSharing(false);
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
      multiCam.stopSecondaryCamera().catch(() => {});
      releaseAllMediaDevices(room, [currentAudioTrackRef.current, multiCam.secondaryTrack]);
    };

    window.addEventListener("beforeunload", handleWindowUnload);
    window.addEventListener("pagehide", handleWindowUnload);

    return () => {
      window.removeEventListener("beforeunload", handleWindowUnload);
      window.removeEventListener("pagehide", handleWindowUnload);
    };
  }, [room, multiCam]);

  const handleLeaveRoom = () => {
    // 1. Finalize and trigger upload of automatic lesson recording
    autoRecorder.stopAndUpload();
    // 2. Immediately terminate all hardware camera (primary + secondary) and mic tracks synchronously
    multiCam.stopSecondaryCamera().catch(() => {});
    releaseAllMediaDevices(room, [currentAudioTrackRef.current, multiCam.secondaryTrack]);
    // 3. Mark intentional leave and return to caller dashboard
    onLeave();
  };

  // Format remaining time
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <MeetRoomUI
      lesson={lesson}
      audioMode={audioMode}
      isSwitchingAudioMode={isSwitchingAudioMode}
      isMuted={isMuted}
      isVideoOff={isVideoOff}
      isScreenSharing={isScreenSharing}
      activeFloorState={activeFloorState}
      onFloorChange={setActiveFloorState}
      connectionQuality={connectionQuality}
      isReconnecting={isReconnecting}
      timeFormatted={timeFormatted}
      availableCameras={availableCameras}
      selectedCameraId={selectedCameraId}
      audioDeviceId={initialConfig.audioDeviceId}
      multiCam={multiCam}
      onToggleMic={handleToggleMic}
      onToggleVideo={handleToggleVideo}
      onToggleScreenShare={handleToggleScreenShare}
      onSwitchAudioMode={handleSwitchAudioMode}
      onCameraDeviceSwitch={handleCameraDeviceSwitch}
      onOpenMultiCam={() => setIsMultiCamModalOpen(true)}
      onLeave={handleLeaveRoom}
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
  );
}

