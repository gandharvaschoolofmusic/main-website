"use client";

import { useEffect, useRef } from "react";
import { LocalVideoTrack } from "livekit-client";
import {
  MultiCameraState,
  CAMERA_ANGLE_PRESETS,
  CameraAnglePreset,
  DEMO_CAMERA_DEVICE_ID,
} from "@/hooks/useMultiCamera";
import {
  Camera,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  X,
  Video as VideoIcon,
  VideoOff,
  FlipHorizontal,
  ArrowRightLeft,
} from "lucide-react";

interface MultiCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  multiCam: MultiCameraState;
  primaryTrack?: LocalVideoTrack | null;
  onPrimaryDeviceSwitch: (deviceId: string) => void;
  isTeacher: boolean;
}

export function MultiCameraModal({
  isOpen,
  onClose,
  multiCam,
  primaryTrack,
  onPrimaryDeviceSwitch,
}: MultiCameraModalProps) {
  const {
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
    swapAngles,
    refreshDevices,
  } = multiCam;

  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-refresh camera devices when modal opens to ensure all newly attached devices & permissions are detected
  useEffect(() => {
    if (isOpen && refreshDevices) {
      refreshDevices();
    }
  }, [isOpen, refreshDevices]);

  // Bind live primary camera track from room publication (avoids redundant getUserMedia hardware locks)
  useEffect(() => {
    const video = primaryVideoRef.current;
    if (!isOpen || !video) return;

    if (primaryTrack && primaryTrack.mediaStreamTrack) {
      const ms = new MediaStream([primaryTrack.mediaStreamTrack]);
      video.srcObject = ms;
      return () => {
        video.srcObject = null;
      };
    } else {
      video.srcObject = null;
    }
  }, [isOpen, primaryTrack]);

  // Bind secondary preview in modal
  useEffect(() => {
    if (!isOpen || !secondaryVideoRef.current) return;
    if (secondaryTrack && secondaryTrack.mediaStreamTrack) {
      const ms = new MediaStream([secondaryTrack.mediaStreamTrack]);
      secondaryVideoRef.current.srcObject = ms;
    } else {
      secondaryVideoRef.current.srcObject = null;
    }
  }, [isOpen, secondaryTrack, isSecondaryCameraActive]);

  if (!isOpen) return null;

  const handleToggleSecondary = async () => {
    if (isSecondaryCameraActive) {
      await stopSecondaryCamera();
    } else {
      await startSecondaryCamera(secondaryCameraId, secondaryAnglePreset);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-[#202124] border-0 shadow-2xl text-stone-100 flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="px-5 sm:px-7 pt-6 pb-4 border-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1a73e8] text-white flex items-center justify-center shadow-lg shadow-black/20">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-medium text-white tracking-tight">
                  Multi-camera studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#a8c7fa]/20 text-[#a8c7fa] border-0">
                  Dual Angle
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Broadcast face and instrument angles simultaneously on a single screen
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close multi-camera studio"
            className="w-8 h-8 rounded-full bg-[#303134] hover:bg-[#44474b] text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1">
          {/* Secondary Camera Activation Alert / Error */}
          {secondaryError && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-rose-950/40 border-0 p-3.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{secondaryError}</span>
            </div>
          )}

          {/* Dual Camera Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* ─── CARD 1: PRIMARY CAMERA (FACE / POSTURE) ──────────────────── */}
            <div className="rounded-2xl bg-[#303134] border-0 p-4 space-y-3.5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#a8c7fa] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#a8c7fa]" />
                      Camera 1 (Primary)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border-0">
                    Active
                  </span>
                </div>

                {/* Video Preview */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border-0 flex items-center justify-center mb-3">
                  <video
                    ref={primaryVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {(!primaryTrack || !primaryTrack.mediaStreamTrack) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124] text-stone-400 p-2 text-center">
                      <Camera className="w-5 h-5 mb-1 text-[#a8c7fa] opacity-60" />
                      <p className="text-[11px] font-medium text-stone-300">Camera 1</p>
                      <p className="text-[10px] text-stone-500">Live in Room</p>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-stone-200">
                    {CAMERA_ANGLE_PRESETS.find((p) => p.id === primaryAnglePreset)?.icon}{" "}
                    {CAMERA_ANGLE_PRESETS.find((p) => p.id === primaryAnglePreset)?.shortLabel}
                  </div>
                </div>

                {/* Device Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-stone-300 uppercase tracking-wider">
                    Video Device
                  </label>
                  <select
                    value={primaryCameraId}
                    onChange={(e) => {
                      onPrimaryDeviceSwitch(e.target.value);
                    }}
                    className="w-full rounded-xl bg-[#3c4043] border-0 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#a8c7fa] font-medium cursor-pointer"
                  >
                    {availableCameras.map((cam, idx) => (
                      <option key={cam.deviceId} value={cam.deviceId} className="bg-[#202124]">
                        {cam.label || `Camera Device ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Angle Preset for Primary */}
                <div className="space-y-1.5 mt-3">
                  <label className="block text-[11px] font-semibold text-stone-300 uppercase tracking-wider">
                    Angle Purpose
                  </label>
                  <select
                    value={primaryAnglePreset}
                    onChange={(e) => setPrimaryAnglePreset(e.target.value as CameraAnglePreset)}
                    className="w-full rounded-xl bg-[#3c4043] border-0 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#a8c7fa] font-medium cursor-pointer"
                  >
                    {CAMERA_ANGLE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#202124]">
                        {p.icon} {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-stone-400 leading-snug pt-1">
                Main camera framing face, posture, teacher-student eye contact & vocal expression.
              </p>
            </div>

            {/* ─── CARD 2: SECONDARY CAMERA (INSTRUMENT / HANDS) ───────────────── */}
            <div
              className={`rounded-2xl border-0 p-4 space-y-3.5 flex flex-col justify-between shadow-lg transition-all ${
                isSecondaryCameraActive
                  ? "bg-[#303134] shadow-black/20"
                  : "bg-[#303134] opacity-90"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#a8c7fa] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#a8c7fa]" />
                    Camera 2 (Instrument / Hands)
                  </span>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    disabled={isStartingSecondary}
                    onClick={handleToggleSecondary}
                    className={`btn-tactile px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                      isSecondaryCameraActive
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                        : "bg-[#1a73e8] text-white shadow-black/20"
                    }`}
                  >
                    {isStartingSecondary ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isSecondaryCameraActive ? (
                      <>
                        <VideoOff className="w-3.5 h-3.5" />
                        <span>Turn Off</span>
                      </>
                    ) : (
                      <>
                        <VideoIcon className="w-3.5 h-3.5" />
                        <span>Enable</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Video Preview */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border-0 flex items-center justify-center mb-3">
                  {isSecondaryCameraActive ? (
                    <video
                      ref={secondaryVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        isMirroredSecondary ? "scale-x-[-1]" : ""
                      }`}
                    />
                  ) : (
                    <div className="text-center p-3 space-y-1 text-stone-400">
                      <Layers className="w-6 h-6 mx-auto text-[#a8c7fa] opacity-60" />
                      <p className="text-[11px] font-medium">Secondary camera is off</p>
                      <p className="text-[10px] text-stone-500">
                        Click &quot;Enable&quot; above to broadcast overhead or instrument view
                      </p>
                    </div>
                  )}

                  {isSecondaryCameraActive && (
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-[#a8c7fa]">
                      {CAMERA_ANGLE_PRESETS.find((p) => p.id === secondaryAnglePreset)?.icon}{" "}
                      {CAMERA_ANGLE_PRESETS.find((p) => p.id === secondaryAnglePreset)?.shortLabel}
                    </div>
                  )}
                </div>

                {/* Device Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-stone-300 uppercase tracking-wider">
                      Secondary Device
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => refreshDevices && refreshDevices()}
                        className="text-[10px] text-[#a8c7fa] hover:text-white font-mono flex items-center gap-1 cursor-pointer transition-colors border-0"
                        title="Rescan video devices"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Rescan</span>
                      </button>
                      {availableCameras.length <= 1 && (
                        <span className="text-[10px] text-amber-400 font-mono">
                          [Studio Demo Active]
                        </span>
                      )}
                    </div>
                  </div>
                  <select
                    value={secondaryCameraId}
                    onChange={(e) => switchSecondaryCamera(e.target.value)}
                    className="w-full rounded-xl bg-[#3c4043] border-0 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#a8c7fa] font-medium cursor-pointer"
                  >
                    {availableCameras.map((cam, idx) => {
                      const isInUse = cam.deviceId === primaryCameraId;
                      const isVirtual =
                        cam.label &&
                        (cam.label.toLowerCase().includes("virtual") ||
                          cam.label.toLowerCase().includes("obs"));
                      return (
                        <option
                          key={cam.deviceId}
                          value={cam.deviceId}
                          className="bg-[#202124]"
                          disabled={isInUse}
                        >
                          {cam.label || `Camera Device ${idx + 1}`}
                          {isVirtual ? " (Virtual/OBS - Requires Active Feed)" : ""}
                          {isInUse ? " (Currently Camera 1 - In Use)" : ""}
                        </option>
                      );
                    })}
                    <option value={DEMO_CAMERA_DEVICE_ID} className="bg-[#202124] text-amber-300">
                      🎹 Studio Overhead Angle (Simulated Multi-Cam Demo)
                    </option>
                  </select>
                </div>

                {/* Angle Preset Buttons */}
                <div className="space-y-1.5 mt-3">
                  <label className="block text-[11px] font-semibold text-stone-300 uppercase tracking-wider">
                    Instrument Angle Preset
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CAMERA_ANGLE_PRESETS.slice(0, 4).map((preset) => {
                      const isSelected = secondaryAnglePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSecondaryAnglePreset(preset.id)}
                          className={`btn-tactile py-1.5 px-2 rounded-xl text-[11px] font-medium text-left flex items-center gap-1.5 transition-all cursor-pointer border-0 ${
                            isSelected
                              ? "bg-[#1a73e8] text-white shadow-xs font-bold"
                              : "bg-[#3c4043]/70 hover:bg-[#3c4043] text-stone-300"
                          }`}
                        >
                          <span>{preset.icon}</span>
                          <span className="truncate">{preset.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mirror Toggle for Secondary */}
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-stone-300 text-[11px]">Mirror Hand Angle</span>
                  <button
                    type="button"
                    onClick={() => setIsMirroredSecondary((prev) => !prev)}
                    className={`btn-tactile px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border-0 ${
                      isMirroredSecondary
                        ? "bg-[#a8c7fa]/20 text-[#a8c7fa]"
                        : "bg-[#3c4043] text-stone-400"
                    }`}
                  >
                    <FlipHorizontal className="w-3 h-3" />
                    <span>{isMirroredSecondary ? "Mirrored" : "Normal"}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-stone-400 leading-snug pt-1">
                Dedicated angle for piano keys, guitar fretboard, tabla strokes, or dance feet.
              </p>
            </div>
          </div>

          {/* ─── STAGE LAYOUT & MULTI-VIEW SETTINGS ─────────────────────────── */}
          <div className="rounded-2xl bg-[#303134] border-0 p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#a8c7fa]" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-200">
                  Stage Multi-View Layout
                </span>
              </div>
              <button
                type="button"
                onClick={swapAngles}
                className="btn-tactile px-2.5 py-1 rounded-xl bg-[#3c4043] hover:bg-[#44474b] text-stone-200 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border-0"
                title="Swap primary and secondary angle roles"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#a8c7fa]" />
                <span>Swap Angle Roles</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setLayoutMode("SIDE_BY_SIDE")}
                className={`btn-tactile p-3 rounded-xl border-0 text-left transition-all cursor-pointer ${
                  layoutMode === "SIDE_BY_SIDE"
                    ? "bg-[#1a73e8]/25 text-white shadow-md shadow-black/20"
                    : "bg-[#3c4043]/60 text-stone-300 hover:bg-[#3c4043]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Side-by-Side Dual View (50/50)</span>
                  {layoutMode === "SIDE_BY_SIDE" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#a8c7fa] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-stone-400 leading-snug">
                  Both face and instrument angles displayed simultaneously at equal size on the main stage.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLayoutMode("PIP")}
                className={`btn-tactile p-3 rounded-xl border-0 text-left transition-all cursor-pointer ${
                  layoutMode === "PIP"
                    ? "bg-[#1a73e8]/25 text-white shadow-md shadow-black/20"
                    : "bg-[#3c4043]/60 text-stone-300 hover:bg-[#3c4043]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Picture-in-Picture (PiP Inset)</span>
                  {layoutMode === "PIP" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#a8c7fa] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-stone-400 leading-snug">
                  Primary camera occupies the full stage while secondary camera floats in a corner inset.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-4 bg-[#202124] border-0 flex items-center justify-between">
          <div className="text-xs text-stone-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {isSecondaryCameraActive
                ? "2 Camera views currently active & synchronized"
                : "1 Camera view active"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-tactile px-5 py-2 rounded-xl bg-[#1a73e8] hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-black/20 transition-all cursor-pointer active:scale-95"
          >
            Apply & Return to Classroom
          </button>
        </div>
      </div>
    </div>
  );
}
