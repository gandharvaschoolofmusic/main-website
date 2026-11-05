"use client";

import { useEffect, useRef, useState } from "react";
import { Room } from "livekit-client";
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
    room.current ??= new Room();
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

  const handleLeave = () => {
    releaseAllMediaDevices();
    const dashboardRoute =
      lesson.callerRole === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard";
    router.push(dashboardRoute);
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
