"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AudioMode } from "@/lib/audio-engine";
import { microphoneOptions } from "@/lib/lesson-microphone";
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

  const previewRequest = useRef(0);
  const [changingPreview, setChangingPreview] = useState(false);
  const releasePreview = useCallback(() => {
    previewRequest.current++;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(getCleanDeviceList(devices, "audioinput", "Default microphone"));
      setVideoDevices(getCleanDeviceList(devices, "videoinput", "Default camera"));
    } catch { /* Capture can still work when device enumeration is unavailable. */ }
  }, []);

  const openPreview = useCallback(async (micId: string, camId: string, mode: AudioMode, restore = false, keepCamera = false) => {
    const request = ++previewRequest.current;
    setChangingPreview(!restore);
    const input = (id: string) => id ? { deviceId: restore ? { ideal: id } : { exact: id } } : true;
    const audio = microphoneOptions({ deviceId: micId, mode });
    if (restore && micId) audio.deviceId = { ideal: micId };
    let acquired: MediaStream | undefined;
    try {
      const previousCamera = keepCamera ? streamRef.current?.getVideoTracks().find(track => track.readyState === "live") : undefined;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio, video: previousCamera ? false : input(camId) });
      } catch (error) {
        if (request !== previewRequest.current) return;
        if (previousCamera) throw error;
        try {
          acquired = await navigator.mediaDevices.getUserMedia({ audio });
        } catch (micError) {
          if (!restore || request !== previewRequest.current) throw micError;
          acquired = await navigator.mediaDevices.getUserMedia({ video: input(camId) });
        }
      }
      if (request !== previewRequest.current) return;
      if (previousCamera) acquired.addTrack(previousCamera);
      const cameraUnavailable = !acquired.getVideoTracks().length;
      void refreshDevices();
      const actualMic = acquired.getAudioTracks()[0]?.getSettings().deviceId;
      const actualCam = acquired.getVideoTracks()[0]?.getSettings().deviceId;
      setSelectedAudioDevice(micId && actualMic === micId ? micId : "");
      setSelectedVideoDevice(camId && actualCam === camId ? camId : "");
      if (cameraUnavailable) setIsVideoMuted(true);
      const micUnavailable = !acquired.getAudioTracks().length;
      setDeviceError(micUnavailable ? "Microphone unavailable. Check permissions or choose another microphone." :
        cameraUnavailable ? "Camera unavailable. Your microphone is ready." : null);
      streamRef.current?.getTracks().forEach(track => { if (track !== previousCamera) track.stop(); });
      streamRef.current = acquired;
      setAudioMode(mode);
      setStream(acquired);
      if (videoRef.current) videoRef.current.srcObject = acquired;
    } catch {
      if (request !== previewRequest.current) return;
      setDeviceError("Could not open the microphone. Check browser permissions or select another input.");
    } finally {
      if (acquired && acquired !== streamRef.current) acquired.getTracks().forEach(track => track.stop());
      if (request === previewRequest.current) setChangingPreview(false);
    }
  }, [refreshDevices]);

  useEffect(() => {
    let mic = "";
    let cam = "";
    let mode: AudioMode = "TALKING";
    try {
      mic = localStorage.getItem("toneroom_mic_id") || "";
      cam = localStorage.getItem("toneroom_cam_id") || "";
      if (localStorage.getItem("toneroom_audio_mode") === "PLAYING") mode = "PLAYING";
      localStorage.removeItem("toneroom_mic_muted");
      localStorage.removeItem("toneroom_cam_muted");
    } catch { /* Storage is optional. */ }
    setAudioMode(mode);
    void refreshDevices();
    navigator.mediaDevices?.addEventListener("devicechange", refreshDevices);
    void openPreview(mic, cam, mode, true);
    window.addEventListener("pagehide", releasePreview);
    return () => {
      window.removeEventListener("pagehide", releasePreview);
      navigator.mediaDevices?.removeEventListener("devicechange", refreshDevices);
      releasePreview();
    };
  }, [openPreview, releasePreview, refreshDevices]);

  useEffect(() => {
    stream?.getAudioTracks().forEach(track => { track.enabled = !isAudioMuted; });
    stream?.getVideoTracks().forEach(track => { track.enabled = !isVideoMuted; });
  }, [stream, isAudioMuted, isVideoMuted]);

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

    releasePreview();

    onJoin({
      audioDeviceId: selectedAudioDevice,
      videoDeviceId: selectedVideoDevice,
      audioMode,
      isAudioMuted,
      isVideoMuted,
    });
  };

  const handleCancel = () => {
    releasePreview();
    onCancel?.();
  };

  const canJoin = !changingPreview && (audioMode === "TALKING" || headphonesAcknowledged);
  const changeMode = (mode: AudioMode) => {
    if (!streamRef.current?.getAudioTracks().length) setAudioMode(mode);
    void openPreview(selectedAudioDevice, selectedVideoDevice, mode, false, true);
  };

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
                  void openPreview(event.target.value, selectedVideoDevice, audioMode, false, true);
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
                  void openPreview(selectedAudioDevice, event.target.value, audioMode);
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
          <div className="meet-prejoin-audio"><label><span><Music size={16} className="inline mr-2"/>Audio mode</span><select aria-label="Audio mode" value={audioMode} onChange={(event) => changeMode(event.target.value as AudioMode)}><option value="TALKING">Talking Mode</option><option value="PLAYING">Instrument Mode</option></select></label>{audioMode === "PLAYING" && <label className="meet-headphone-check"><input type="checkbox" checked={headphonesAcknowledged} onChange={(event) => setHeadphonesAcknowledged(event.target.checked)}/><span>I’m wearing headphones to prevent echo in Instrument Mode.</span></label>}</div>
          <button type="button" className="meet-text-button" onClick={handleCancel}><ArrowLeft size={16}/>Back to dashboard</button>
        </section>
      </main>
      <footer className="meet-prejoin-footer">Only your assigned lesson participants can join this room.</footer>
    </div>
  );
}
