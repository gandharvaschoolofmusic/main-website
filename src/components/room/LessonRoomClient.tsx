"use client";

import { useEffect, useRef, useState } from "react";
import { Room, type RoomOptions, AudioPresets, VideoPresets } from "livekit-client";
import { preferPhoneSpeaker } from "@/lib/lesson-speaker";
import "./meet-room.css";

import { useRouter } from "next/navigation";
import { AudioMode } from "@/lib/audio-engine";
import { releaseAllMediaDevices } from "@/lib/media-devices";
import { PreJoinScreen } from "./PreJoinScreen";
import { LessonRoom } from "./LessonRoom";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

interface LessonRoomClientProps {
  lesson: {
    id: string;
    instrument: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    partnerName: string;
    isTeacher: boolean;
    callerRole: "TEACHER" | "STUDENT";
    lessonSource?: string | null;
  };
}

const lessonRoomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
  },
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },
  publishDefaults: {
    simulcast: true,
    videoSimulcastLayers: [
      VideoPresets.h180,
      VideoPresets.h360,
    ],
    videoCodec: "vp8",
    backupCodec: true,
    dtx: true,
    red: true,
    forceStereo: false,
    audioPreset: AudioPresets.music,
    videoEncoding: {
      maxBitrate: 750_000,
      maxFramerate: 24,
      priority: "medium",
    },
    screenShareEncoding: {
      maxBitrate: 1_200_000,
      maxFramerate: 15,
      priority: "medium",
    },
    degradationPreference: "maintain-framerate",
    stopMicTrackOnMute: false,
  },
  disconnectOnPageLeave: true,
};

export function LessonRoomClient({ lesson }: LessonRoomClientProps) {
  const router = useRouter();
  const room = useRef<Room | null>(null);
  const previewMicrophone = useRef<MediaStreamTrack | null>(null);
  useEffect(() => {
    const releasePending = () => { previewMicrophone.current?.stop(); previewMicrophone.current = null; };
    window.addEventListener("pagehide", releasePending);
    return () => { window.removeEventListener("pagehide", releasePending); releasePending(); };
  }, []);

  const [step, setStep] = useState<"PRE_JOIN" | "CONNECTING" | "CONNECTED" | "ERROR">("PRE_JOIN");
  const [tokenData, setTokenData] = useState<{
    room: Room;
    token: string;
    serverUrl: string;
  } | null>(null);

  const [joinedConfig, setJoinedConfig] = useState<{
    audioDeviceId: string;
    videoDeviceId: string;
    audioMode: AudioMode;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
  }>({
    audioDeviceId: "",
    videoDeviceId: "",
    audioMode: "TALKING",
    isAudioMuted: false,
    isVideoMuted: false,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePreJoinComplete = async (config: {
    audioDeviceId: string;
    videoDeviceId: string;
    audioMode: AudioMode;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
  }, microphone?: MediaStreamTrack) => {
    previewMicrophone.current = microphone ?? null;
    room.current ??= new Room(lessonRoomOptions);
    // Use the Join gesture while the browser still permits starting playback.
    void room.current.startAudio().catch(() => {});
    setJoinedConfig(config);
    setStep("CONNECTING");
    setErrorMessage(null);

    try {
      const [res] = await Promise.all([
        fetch(`/api/lessons/${lesson.id}/room-token?early=true`),
        preferPhoneSpeaker(room.current),
      ]);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to mint lesson room token.");
      }

      setTokenData({
        room: room.current,
        token: data.token,
        serverUrl: data.serverUrl,
      });
      setStep("CONNECTED");
    } catch (err: unknown) {
      previewMicrophone.current?.stop();
      previewMicrophone.current = null;
      const error = err as Error;
      setErrorMessage(error.message || "Failed to connect to lesson room.");
      setStep("ERROR");
    }
  };

  const hasLeftRouteRef = useRef(false);
  const handleLeave = () => {
    if (hasLeftRouteRef.current) return;
    hasLeftRouteRef.current = true;
    releaseAllMediaDevices();
    const dashboardRoute =
      lesson.callerRole === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard";
    router.replace(dashboardRoute);
  };

  if (step === "PRE_JOIN") {
    return (
      <PreJoinScreen
        lesson={lesson}
        onJoin={handlePreJoinComplete}
        onCancel={handleLeave}
      />
    );
  }

  if (step === "CONNECTING") {
    return <div className="meet-connection" role="status"><Loader2 size={40} className="animate-spin text-[#a8c7fa]"/><h2 className="text-2xl">Joining your lesson…</h2><p className="meet-muted">Connecting with {lesson.partnerName}</p></div>;
  }

  if (step === "ERROR") {
    return <div className="meet-connection"><AlertCircle size={40}/><h2 className="text-2xl">Couldn’t join the lesson</h2><p className="meet-muted max-w-md">{errorMessage}</p><button type="button" className="meet-primary-button" onClick={() => setStep("PRE_JOIN")}>Try again</button><button type="button" className="meet-text-button" onClick={handleLeave}><ArrowLeft size={16}/>Back to dashboard</button></div>;
  }
  if (!tokenData) return null;

  return (
    <LessonRoom
      room={tokenData.room}
      token={tokenData.token}
      serverUrl={tokenData.serverUrl}
      lesson={lesson}
      initialConfig={{ ...joinedConfig, previewMicrophone }}
      onLeave={handleLeave}
    />
  );
}
