import type { Room } from "livekit-client";

export function canRouteLessonAudio() {
  return typeof HTMLMediaElement !== "undefined" && typeof HTMLMediaElement.prototype.setSinkId === "function";
}

export function phoneLoudspeaker(devices: MediaDeviceInfo[]) {
  const outputs = devices.filter(device => device.kind === "audiooutput");
  const physical = outputs.filter(device => device.deviceId && !["default", "communications"].includes(device.deviceId));
  const isSpeaker = (label: string) => /^(?:(?:built[ -]?in|internal|phone|iphone|ipad)\s+)?(?:loud\s?speaker|speaker\s?phone|speakers?)(?:\s*\(built[ -]?in\))?$/i.test(label.trim());
  const isReceiver = (label: string) => /^(?:(?:built[ -]?in|phone|iphone)\s+)?(?:earpiece|receiver)$/i.test(label.trim());
  // An unknown output may be a headset or hearing aid. Leave its routing to the OS.
  if (physical.some(device => !isSpeaker(device.label) && !isReceiver(device.label))) return;
  const defaultLabel = outputs.find(device => device.deviceId === "default")?.label.replace(/^default\s*[-:]?\s*/i, "");
  if (defaultLabel && !isReceiver(defaultLabel)) return;
  return physical.find(device => isSpeaker(device.label));
}

export async function preferPhoneSpeaker(room: Room) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!mobile || !canRouteLessonAudio()) return;
  try {
    const speaker = phoneLoudspeaker(await navigator.mediaDevices.enumerateDevices());
    if (speaker) await room.switchActiveDevice("audiooutput", speaker.deviceId);
  } catch {
    // Permission and routing policies vary. The system output remains usable on join.
  }
}
