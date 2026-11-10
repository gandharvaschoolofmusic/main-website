"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Room, LocalVideoTrack, createLocalVideoTrack, Track, VideoPresets } from "livekit-client";

export type CameraAnglePreset =
  | "HANDS_KEYS"
  | "FRETBOARD"
  | "OVERHEAD_DRUMS"
  | "FULL_BODY"
  | "SHEET_MUSIC"
  | "CUSTOM";

export interface CameraAngleInfo {
  id: CameraAnglePreset;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const CAMERA_ANGLE_PRESETS: CameraAngleInfo[] = [
  {
    id: "HANDS_KEYS",
    label: "Hands & Keyboard",
    shortLabel: "Hands / Keys",
    icon: "🎹",
    description: "Close-up on piano keys, harmonium bellows & finger positioning",
  },
  {
    id: "FRETBOARD",
    label: "Fretboard & Strings",
    shortLabel: "Fretboard",
    icon: "🎸",
    description: "Angle on guitar neck, sitar frets, violin bow or ukulele strings",
  },
  {
    id: "OVERHEAD_DRUMS",
    label: "Overhead / Percussion",
    shortLabel: "Overhead",
    icon: "🥁",
    description: "Top-down view of tabla dayan/bayan, drums or hand instruments",
  },
  {
    id: "FULL_BODY",
    label: "Posture & Footwork",
    shortLabel: "Posture",
    icon: "🩰",
    description: "Full-body framing for vocal posture, dance steps & breathing",
  },
  {
    id: "SHEET_MUSIC",
    label: "Sheet Music / Notation",
    shortLabel: "Notation",
    icon: "📖",
    description: "View of physical notation, manuscript or practice handbook",
  },
  {
    id: "CUSTOM",
    label: "Secondary Angle",
    shortLabel: "Secondary Cam",
    icon: "📹",
    description: "Alternative practice angle",
  },
];

export type MultiCamLayoutMode = "SIDE_BY_SIDE" | "PIP" | "SPLIT_EQUAL";

export const DEMO_CAMERA_DEVICE_ID = "__demo_studio_overhead_angle__";

export interface MultiCameraState {
  availableCameras: MediaDeviceInfo[];
  primaryCameraId: string;
  secondaryCameraId: string;
  isSecondaryCameraActive: boolean;
  isStartingSecondary: boolean;
  secondaryAnglePreset: CameraAnglePreset;
  primaryAnglePreset: CameraAnglePreset;
  secondaryError: string | null;
  layoutMode: MultiCamLayoutMode;
  isMirroredSecondary: boolean;
  secondaryTrack: LocalVideoTrack | null;
  startSecondaryCamera: (deviceId?: string, preset?: CameraAnglePreset) => Promise<boolean>;
  stopSecondaryCamera: () => Promise<void>;
  switchSecondaryCamera: (deviceId: string) => Promise<boolean>;
  setSecondaryAnglePreset: (preset: CameraAnglePreset) => void;
  setPrimaryAnglePreset: (preset: CameraAnglePreset) => void;
  setLayoutMode: (mode: MultiCamLayoutMode) => void;
  setIsMirroredSecondary: (mirrored: boolean | ((prev: boolean) => boolean)) => void;
  setPrimaryCameraId: (id: string) => void;
  swapAngles: () => void;
  refreshDevices: () => Promise<void>;
}

/**
 * Creates an animated synthetic studio canvas stream for testing multi-cam on single-webcam devices.
 */
function createDemoStudioStream(): MediaStreamTrack {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");

  let animationFrameId: number;
  let frame = 0;

  const render = () => {
    frame++;
    if (!ctx) return;

    // Rich studio backdrop
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#0E0C18");
    grad.addColorStop(0.5, "#1B0B33");
    grad.addColorStop(1, "#0A0514");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines for studio calibration
    ctx.strokeStyle = "rgba(152, 16, 250, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Overhead Piano Keyboard Demo View
    const keyY = 380;
    const keyHeight = 240;
    const whiteKeyWidth = 45;
    const numKeys = 24;
    const startX = (canvas.width - numKeys * whiteKeyWidth) / 2;

    // Glow effect
    ctx.shadowColor = "rgba(152, 16, 250, 0.4)";
    ctx.shadowBlur = 20;

    // White keys
    for (let i = 0; i < numKeys; i++) {
      const x = startX + i * whiteKeyWidth;
      const isPressed = Math.floor((frame / 20) % numKeys) === i || Math.floor(((frame + 5) / 25) % numKeys) === i;

      ctx.fillStyle = isPressed ? "#FAF0FF" : "#E2D9F3";
      ctx.fillRect(x + 1, keyY, whiteKeyWidth - 2, keyHeight);

      if (isPressed) {
        // Cyan/violet touch wave
        ctx.fillStyle = "rgba(152, 16, 250, 0.35)";
        ctx.fillRect(x + 1, keyY, whiteKeyWidth - 2, keyHeight);
      }
    }

    // Black keys
    const blackKeyPattern = [0, 1, 3, 4, 5];
    for (let octave = 0; octave < 4; octave++) {
      for (const offset of blackKeyPattern) {
        const whiteIdx = octave * 7 + offset;
        if (whiteIdx < numKeys - 1) {
          const x = startX + (whiteIdx + 1) * whiteKeyWidth - 14;
          ctx.fillStyle = "#1E1A4D";
          ctx.fillRect(x, keyY, 28, keyHeight * 0.62);

          ctx.fillStyle = "#2D0752";
          ctx.fillRect(x + 3, keyY + 2, 22, keyHeight * 0.58);
        }
      }
    }
    ctx.shadowBlur = 0;

    // Animated hands indicator / sound pulse
    const activeX = startX + (Math.sin(frame * 0.05) * 0.5 + 0.5) * (numKeys * whiteKeyWidth);
    const activeY = keyY + 50;

    ctx.beginPath();
    ctx.arc(activeX, activeY, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 120, 3, 0.85)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(activeX, activeY, 32 + Math.sin(frame * 0.1) * 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 120, 3, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Studio Banner text
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillStyle = "#FAF0FF";
    ctx.textAlign = "center";
    ctx.fillText("STUDIO OVERHEAD ANGLE", canvas.width / 2, 140);

    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#FF7803";
    ctx.fillText("Simulated Multi-Cam Instrument Demo • Gandharva Studio", canvas.width / 2, 175);

    // Live frame badge
    ctx.fillStyle = "rgba(5, 150, 105, 0.9)";
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - 80, 210, 160, 32, 16);
    ctx.fill();

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`● LIVE FEED ${Math.floor(frame / 30)}s`, canvas.width / 2, 231);

    animationFrameId = requestAnimationFrame(render);
  };

  render();

  const stream = canvas.captureStream(30);
  const track = stream.getVideoTracks()[0];

  // Stop canvas animation when track ends
  const origStop = track.stop.bind(track);
  track.stop = () => {
    cancelAnimationFrame(animationFrameId);
    origStop();
  };

  return track;
}

export function useMultiCamera(room: Room | null, isVideoOff: boolean): MultiCameraState {
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [primaryCameraId, setPrimaryCameraId] = useState<string>("");
  const [secondaryCameraId, setSecondaryCameraId] = useState<string>("");
  const [isSecondaryCameraActive, setIsSecondaryCameraActive] = useState<boolean>(false);
  const [isStartingSecondary, setIsStartingSecondary] = useState<boolean>(false);
  const [secondaryAnglePreset, setSecondaryAnglePreset] = useState<CameraAnglePreset>("HANDS_KEYS");
  const [primaryAnglePreset, setPrimaryAnglePreset] = useState<CameraAnglePreset>("FULL_BODY");
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<MultiCamLayoutMode>("SIDE_BY_SIDE");
  const [isMirroredSecondary, setIsMirroredSecondary] = useState<boolean>(false);
  const [secondaryTrack, setSecondaryTrack] = useState<LocalVideoTrack | null>(null);

  const secondaryTrackRef = useRef<LocalVideoTrack | null>(null);

  // 1. Enumerate available video input devices
  const refreshDevices = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setAvailableCameras(videoInputs);

      // Auto-assign primary & secondary defaults
      if (videoInputs.length > 0 && !primaryCameraId) {
        setPrimaryCameraId(videoInputs[0].deviceId);
      }
      if (videoInputs.length > 1) {
        // Find if there is a real physical second camera (non-virtual, non-primary)
        const realSecondCam = videoInputs.find(
          (c) =>
            c.deviceId !== videoInputs[0].deviceId &&
            c.label &&
            !c.label.toLowerCase().includes("virtual") &&
            !c.label.toLowerCase().includes("obs"),
        );

        const currentSecondaryIsVirtual = videoInputs.some(
          (c) =>
            c.deviceId === secondaryCameraId &&
            c.label &&
            (c.label.toLowerCase().includes("virtual") || c.label.toLowerCase().includes("obs")),
        );

        if (realSecondCam) {
          if (
            !secondaryCameraId ||
            secondaryCameraId === videoInputs[0].deviceId ||
            currentSecondaryIsVirtual
          ) {
            setSecondaryCameraId(realSecondCam.deviceId);
          }
        } else {
          // If no second physical device exists or only virtual camera (like offline OBS Virtual Camera),
          // default to DEMO_CAMERA_DEVICE_ID to guarantee 100% reliable startup
          if (
            !secondaryCameraId ||
            secondaryCameraId === videoInputs[0].deviceId ||
            currentSecondaryIsVirtual
          ) {
            setSecondaryCameraId(DEMO_CAMERA_DEVICE_ID);
          }
        }
      } else {
        // Single webcam setup: default secondary to simulated Studio Overhead demo angle
        setSecondaryCameraId(DEMO_CAMERA_DEVICE_ID);
      }
    } catch (err) {
      console.warn("Could not enumerate video devices", err);
    }
  }, [primaryCameraId, secondaryCameraId]);

  useEffect(() => {
    refreshDevices();

    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      };
    }
  }, [refreshDevices]);

  // 2. Stop secondary camera
  const stopSecondaryCamera = useCallback(async () => {
    setSecondaryError(null);
    const track = secondaryTrackRef.current;
    if (track) {
      try {
        if (room && room.localParticipant) {
          await room.localParticipant.unpublishTrack(track);
        }
      } catch (err) {
        console.warn("Failed to unpublish secondary track", err);
      }

      try {
        track.stop();
        if (track.mediaStreamTrack) {
          track.mediaStreamTrack.stop();
        }
      } catch (err) {
        console.warn("Failed to stop secondary track", err);
      }

      secondaryTrackRef.current = null;
      setSecondaryTrack(null);
    }
    setIsSecondaryCameraActive(false);
  }, [room]);

  // 3. Start secondary camera
  const startSecondaryCamera = useCallback(
    async (deviceId?: string, preset?: CameraAnglePreset): Promise<boolean> => {
      setSecondaryError(null);
      setIsStartingSecondary(true);

      let targetDeviceId = deviceId || secondaryCameraId;

      // Prevent hardware conflict: if single camera device or matches primary, fallback to demo stream
      if (!targetDeviceId || (targetDeviceId === primaryCameraId && availableCameras.length <= 1)) {
        targetDeviceId = DEMO_CAMERA_DEVICE_ID;
      } else if (targetDeviceId === primaryCameraId && availableCameras.length > 1) {
        const alternate = availableCameras.find((c) => c.deviceId !== primaryCameraId);
        targetDeviceId = alternate ? alternate.deviceId : DEMO_CAMERA_DEVICE_ID;
      }

      const targetPreset = preset || secondaryAnglePreset;

      try {
        // Stop any currently running secondary track first
        if (secondaryTrackRef.current) {
          await stopSecondaryCamera();
        }

        let newTrack: LocalVideoTrack;

        if (targetDeviceId === DEMO_CAMERA_DEVICE_ID) {
          // Use high-performance synthetic studio canvas angle
          const mediaTrack = createDemoStudioStream();
          newTrack = new LocalVideoTrack(mediaTrack, undefined, false);
        } else {
          // Hardware camera capture with ideal device ID to avoid OverconstrainedError
          newTrack = await createLocalVideoTrack({
            deviceId: { ideal: targetDeviceId },
            resolution: VideoPresets.h540.resolution,
          });
        }

        secondaryTrackRef.current = newTrack;
        setSecondaryTrack(newTrack);
        setSecondaryCameraId(targetDeviceId);
        if (preset) setSecondaryAnglePreset(targetPreset);

        // Publish to LiveKit Room if room is connected with capped bandwidth for secondary angle
        if (room && room.localParticipant) {
          await room.localParticipant.publishTrack(newTrack, {
            name: "secondary-camera",
            source: Track.Source.Camera,
            videoCodec: "vp8",
            videoEncoding: {
              maxBitrate: 450_000,
              maxFramerate: 20,
              priority: "low",
            },
            simulcast: false,
          });
        }

        setIsSecondaryCameraActive(true);
        return true;
      } catch (err: unknown) {
        const errObj = err as { name?: string; message?: string };
        const isNotReadable =
          errObj?.name === "NotReadableError" ||
          errObj?.name === "TrackStartError" ||
          String(errObj?.message).includes("Could not start video source");

        // If hardware or virtual camera is locked by OS or offline, seamlessly fallback to studio demo angle
        if (isNotReadable && targetDeviceId !== DEMO_CAMERA_DEVICE_ID) {
          try {
            const mediaTrack = createDemoStudioStream();
            const fallbackTrack = new LocalVideoTrack(mediaTrack, undefined, false);
            secondaryTrackRef.current = fallbackTrack;
            setSecondaryTrack(fallbackTrack);
            setSecondaryCameraId(DEMO_CAMERA_DEVICE_ID);

            if (room && room.localParticipant) {
              await room.localParticipant.publishTrack(fallbackTrack, {
                name: "secondary-camera",
                source: Track.Source.Camera,
                videoCodec: "vp8",
                videoEncoding: {
                  maxBitrate: 350_000,
                  maxFramerate: 15,
                  priority: "low",
                },
                simulcast: false,
              });
            }
            setIsSecondaryCameraActive(true);
            setSecondaryError(
              "Camera device was unavailable or offline. Switched to Studio Overhead angle.",
            );
            return true;
          } catch (fallbackErr) {
            console.error("Secondary demo fallback failed:", fallbackErr);
          }
        } else {
          console.warn("Could not start secondary camera:", err);
        }

        const errMsg =
          err instanceof Error
            ? err.message
            : "Could not access the secondary camera. It may be in use by another application.";
        setSecondaryError(errMsg);
        return false;
      } finally {
        setIsStartingSecondary(false);
      }
    },
    [availableCameras, primaryCameraId, room, secondaryAnglePreset, secondaryCameraId, stopSecondaryCamera],
  );

  // 4. Switch secondary camera device dynamically
  const switchSecondaryCamera = useCallback(
    async (newDeviceId: string): Promise<boolean> => {
      setSecondaryCameraId(newDeviceId);
      if (isSecondaryCameraActive) {
        return startSecondaryCamera(newDeviceId);
      }
      return true;
    },
    [isSecondaryCameraActive, startSecondaryCamera],
  );

  // 5. Swap Primary and Secondary Angles
  const swapAngles = useCallback(() => {
    setPrimaryAnglePreset((prevP) => {
      const nextP = secondaryAnglePreset;
      setSecondaryAnglePreset(prevP);
      return nextP;
    });
  }, [secondaryAnglePreset]);

  // 6. Synchronous cleanup on unmount or room leave
  useEffect(() => {
    return () => {
      if (secondaryTrackRef.current) {
        try {
          secondaryTrackRef.current.stop();
          if (secondaryTrackRef.current.mediaStreamTrack) {
            secondaryTrackRef.current.mediaStreamTrack.stop();
          }
        } catch {
          // Ignore
        }
        secondaryTrackRef.current = null;
      }
    };
  }, []);

  return {
    availableCameras,
    primaryCameraId,
    secondaryCameraId,
    isSecondaryCameraActive,
    isStartingSecondary,
    secondaryAnglePreset,
    primaryAnglePreset,
    secondaryError,
    layoutMode,
    isMirroredSecondary,
    secondaryTrack,
    startSecondaryCamera,
    stopSecondaryCamera,
    switchSecondaryCamera,
    setSecondaryAnglePreset,
    setPrimaryAnglePreset,
    setLayoutMode,
    setIsMirroredSecondary,
    setPrimaryCameraId,
    swapAngles,
    refreshDevices,
  };
}
