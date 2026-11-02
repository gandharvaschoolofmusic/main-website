"use client";

import { useEffect, useRef, useState } from "react";

import { AudioMode } from "@/lib/audio-engine";
import { getCleanDeviceList, CleanedDeviceOption } from "@/lib/media-devices";
import { AudioLevelMeter } from "./AudioLevelMeter";
import { Mic, MicOff, Video as VideoIcon, VideoOff, Music, ArrowLeft } from "lucide-react";
import { RoomIconButton } from "./MeetPrimitives";

interface PreJoinScreenProps {
  lesson: {
    id: string;
    instrument: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    partnerName: string;
    callerRole: "TEACHER" | "STUDENT";
    lessonSource?: string | null;
  };
  onJoin: (config: {
    audioDeviceId: string;
    videoDeviceId: string;
    audioMode: AudioMode;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
  }) => void;
  onCancel?: () => void;
}

export function PreJoinScreen({ lesson, onJoin, onCancel }: PreJoinScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [audioDevices, setAudioDevices] = useState<CleanedDeviceOption[]>([]);
  const [videoDevices, setVideoDevices] = useState<CleanedDeviceOption[]>([]);

  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");

  const [audioMode, setAudioMode] = useState<AudioMode>("TALKING");
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [headphonesAcknowledged, setHeadphonesAcknowledged] = useState(false);

  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Load saved audio mode preference from localStorage and clear legacy persistent mute flags
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("toneroom_audio_mode") as AudioMode;
      // Restore the existing saved audio preference after hydration; never change it during a UI redesign.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedMode === "TALKING" || savedMode === "PLAYING") setAudioMode(savedMode);

      // Clean up legacy persistent mute keys so microphone is never trapped muted
      localStorage.removeItem("toneroom_mic_muted");
      localStorage.removeItem("toneroom_cam_muted");
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Request media permissions and enumerate devices
  useEffect(() => {
    let active = true;

    async function setupDevices() {
      try {
        setDeviceError(null);
        // Initial permission request: try video and audio together, fallback to audio-only if camera is busy or unavailable
        let initialStream: MediaStream;
        try {
          initialStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (mediaErr: unknown) {
          console.warn("Could not acquire both video and audio, trying audio only:", mediaErr);
          try {
            initialStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            setIsVideoMuted(true);
            setDeviceError(
              "Camera is currently unavailable (it may be in use by another browser tab or app). Audio is ready.",
            );
          } catch {
            throw mediaErr;
          }
        }

        if (!active) {
          initialStream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = initialStream;
        setStream(initialStream);

        if (videoRef.current) {
          videoRef.current.srcObject = initialStream;
        }

        // Enumerate devices with clean, deduplicated, and friendly labels
        const rawDevices = await navigator.mediaDevices.enumerateDevices();
        const mics = getCleanDeviceList(rawDevices, "audioinput", "Default microphone");
        const cams = getCleanDeviceList(rawDevices, "videoinput", "Default camera");

        setAudioDevices(mics);
        setVideoDevices(cams);

        let savedMic: string | null = null;
        let savedCam: string | null = null;
        try {
          savedMic = localStorage.getItem("toneroom_mic_id");
          savedCam = localStorage.getItem("toneroom_cam_id");
        } catch {
          // Ignore
        }

        // Match saved mic or default to first available
        const matchedMic = mics.find((m) => m.deviceId === savedMic);
        if (matchedMic) {
          setSelectedAudioDevice(matchedMic.deviceId);
        } else if (mics[0]) {
          setSelectedAudioDevice(mics[0].deviceId);
        }

        // Match saved cam or default to first available
        const matchedCam = cams.find((c) => c.deviceId === savedCam);
        if (matchedCam) {
          setSelectedVideoDevice(matchedCam.deviceId);
        } else if (cams[0]) {
          setSelectedVideoDevice(cams[0].deviceId);
        }
      } catch (err: unknown) {
        const error = err as Error;
        setDeviceError(
          error.message ||
            "Please grant microphone and camera permissions to join the lesson room.",
        );
      }
    }

    setupDevices();

    const handleBeforeUnload = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      active = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Handle camera / mic device change in preview
  const handleDeviceChange = async (newMicId: string, newCamId: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: newMicId ? { deviceId: { ideal: newMicId } } : true,
          video: newCamId ? { deviceId: { ideal: newCamId } } : true,
        });
      } catch (devErr) {
        console.warn("Could not switch to ideal device, falling back to default media:", devErr);
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      }

      streamRef.current = newStream;
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Sync mute states
      newStream.getVideoTracks().forEach((t) => (t.enabled = !isVideoMuted));
      newStream.getAudioTracks().forEach((t) => (t.enabled = !isAudioMuted));
    } catch (err) {
      console.warn("Failed to switch preview device", err);
    }
  };

  const toggleVideo = () => {
    const nextState = !isVideoMuted;
    setIsVideoMuted(nextState);
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = !nextState));
    }
  };

  const toggleAudio = () => {
    const nextState = !isAudioMuted;
    setIsAudioMuted(nextState);
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = !nextState));
    }
  };

  const handleJoin = () => {
    // Save hardware device preferences (do not persist mute flags across sessions)
    try {
      localStorage.setItem("toneroom_mic_id", selectedAudioDevice);
      localStorage.setItem("toneroom_cam_id", selectedVideoDevice);
      localStorage.setItem("toneroom_audio_mode", audioMode);
    } catch {
      // Ignore
    }

    // Explicitly and synchronously stop local preview tracks before handoff to LiveKit
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }

    onJoin({
      audioDeviceId: selectedAudioDevice,
      videoDeviceId: selectedVideoDevice,
      audioMode,
      isAudioMuted,
      isVideoMuted,
    });
  };

  const handleCancel = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    onCancel?.();
  };

  const canJoin = audioMode === "TALKING" || headphonesAcknowledged;

  return (
    <div className="meet-prejoin">
      <header className="meet-prejoin-header"><div className="meet-prejoin-brand"><VideoIcon size={30}/><span>Gandharva <strong>Meet</strong></span></div><span>{lesson.instrument} · {lesson.durationMinutes} minute lesson</span></header>
      <main className="meet-prejoin-main">
        <section aria-label="Camera and microphone preview">
          <div className="meet-preview">
            <video ref={videoRef} autoPlay playsInline muted hidden={isVideoMuted}/>
            {isVideoMuted && <div className="meet-preview-off"><VideoOff size={36}/><span>Camera is off</span></div>}
            <span className="meet-preview-label">You</span>
            <div className="meet-preview-controls"><RoomIconButton label={isAudioMuted ? "Turn on microphone" : "Turn off microphone"} className={isAudioMuted ? "is-off" : ""} onClick={toggleAudio}>{isAudioMuted ? <MicOff/> : <Mic/>}</RoomIconButton><RoomIconButton label={isVideoMuted ? "Turn on camera" : "Turn off camera"} className={isVideoMuted ? "is-off" : ""} onClick={toggleVideo}>{isVideoMuted ? <VideoOff/> : <VideoIcon/>}</RoomIconButton></div>
          </div>
          <div className="meet-prejoin-devices">
            <label>
              <Mic size={18} />
              <select
                aria-label="Microphone"
                value={selectedAudioDevice}
                onChange={(event) => {
                  setSelectedAudioDevice(event.target.value);
                  void handleDeviceChange(event.target.value, selectedVideoDevice);
                }}
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <VideoIcon size={18} />
              <select
                aria-label="Camera"
                value={selectedVideoDevice}
                onChange={(event) => {
                  setSelectedVideoDevice(event.target.value);
                  void handleDeviceChange(selectedAudioDevice, event.target.value);
                }}
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {stream && !isAudioMuted && <AudioLevelMeter stream={stream} className="mt-3"/>}
          {deviceError && <p className="meet-chat-warning mt-4" role="alert">{deviceError}</p>}
        </section>
        <section className="meet-ready"><h1>Ready to join?</h1><p>{lesson.instrument} with {lesson.partnerName}</p><p>Your lesson is ready when you are.</p><button type="button" className="meet-primary-button" disabled={!canJoin} onClick={handleJoin}>Join now</button>
          <div className="meet-prejoin-audio"><label><span><Music size={16} className="inline mr-2"/>Audio mode</span><select aria-label="Audio mode" value={audioMode} onChange={(event) => setAudioMode(event.target.value as AudioMode)}><option value="TALKING">Talking Mode</option><option value="PLAYING">Instrument Mode</option></select></label>{audioMode === "PLAYING" && <label className="meet-headphone-check"><input type="checkbox" checked={headphonesAcknowledged} onChange={(event) => setHeadphonesAcknowledged(event.target.checked)}/><span>I’m wearing headphones to prevent echo in Instrument Mode.</span></label>}</div>
          <button type="button" className="meet-text-button" onClick={handleCancel}><ArrowLeft size={16}/>Back to dashboard</button>
        </section>
      </main>
      <footer className="meet-prejoin-footer">Only your assigned lesson participants can join this room.</footer>
    </div>
  );
}
