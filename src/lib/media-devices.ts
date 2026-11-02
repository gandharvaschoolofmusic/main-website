import { Room, LocalTrackPublication, LocalTrack } from "livekit-client";

/**
 * Universally and synchronously terminates all active MediaStreamTracks associated with:
 * 1. A LiveKit Room instance (local participant publications: mic, camera, screenshare).
 * 2. Any additional MediaStream, MediaStreamTrack, or LocalTrack passed in.
 * 3. Any active <video> or <audio> DOM elements with MediaStream srcObjects.
 *
 * This ensures browser camera and microphone hardware indicators (LEDs and OS recording dots)
 * turn off immediately upon exiting the lesson room or unmounting components.
 */
export function releaseAllMediaDevices(
  room?: Room | null,
  additionalStreamsOrTracks?: (
    | MediaStream
    | MediaStreamTrack
    | LocalTrack
    | null
    | undefined
  )[],
): void {
  try {
    // 1. Release all tracks published in the LiveKit room
    if (room && room.localParticipant) {
      const participant = room.localParticipant;

      // Iterate all track publications on local participant
      participant.trackPublications.forEach((pub: LocalTrackPublication) => {
        try {
          if (pub.track) {
            pub.track.stop();
            if (pub.track.mediaStreamTrack) {
              pub.track.mediaStreamTrack.stop();
            }
          }
        } catch (err) {
          console.warn("Error stopping publication track:", err);
        }
      });

      // Explicitly check audioTrackPublications
      participant.audioTrackPublications.forEach((pub: LocalTrackPublication) => {
        try {
          if (pub.track) {
            pub.track.stop();
            if (pub.track.mediaStreamTrack) {
              pub.track.mediaStreamTrack.stop();
            }
          }
        } catch {}
      });

      // Explicitly check videoTrackPublications
      participant.videoTrackPublications.forEach((pub: LocalTrackPublication) => {
        try {
          if (pub.track) {
            pub.track.stop();
            if (pub.track.mediaStreamTrack) {
              pub.track.mediaStreamTrack.stop();
            }
          }
        } catch {}
      });

      // Disable hardware track state at participant level
      try {
        participant.setCameraEnabled(false).catch(() => {});
        participant.setMicrophoneEnabled(false).catch(() => {});
        participant.setScreenShareEnabled(false).catch(() => {});
      } catch {}
    }

    // 2. Stop any explicitly passed MediaStream or MediaStreamTrack objects
    if (additionalStreamsOrTracks && additionalStreamsOrTracks.length > 0) {
      for (const item of additionalStreamsOrTracks) {
        if (!item) continue;
        if (typeof MediaStream !== "undefined" && item instanceof MediaStream) {
          item.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
        } else if (
          typeof MediaStreamTrack !== "undefined" &&
          item instanceof MediaStreamTrack
        ) {
          try {
            item.stop();
          } catch {}
        } else if (item instanceof LocalTrack) {
          try {
            item.stop();
            if (item.mediaStreamTrack) {
              item.mediaStreamTrack.stop();
            }
          } catch {}
        }
      }
    }

    // 3. Clean up any active DOM media elements holding MediaStream references
    if (typeof document !== "undefined") {
      const mediaElements = document.querySelectorAll<HTMLMediaElement>("video, audio");
      mediaElements.forEach((el) => {
        try {
          if (
            typeof MediaStream !== "undefined" &&
            el.srcObject &&
            el.srcObject instanceof MediaStream
          ) {
            el.srcObject.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch {}
            });
            el.srcObject = null;
          }
          el.pause();
        } catch {}
      });
    }
  } catch (globalErr) {
    console.warn("Error in releaseAllMediaDevices:", globalErr);
  }
}

export interface CleanedDeviceOption {
  deviceId: string;
  label: string;
  isDefault?: boolean;
}

/**
 * Cleans, sanitizes, and categorizes raw device labels from WebRTC enumerateDevices.
 *
 * 1. Filters out virtual loopback recording devices (e.g. Stereo Mix, What U Hear, Virtual Cable)
 *    that feed computer audio back into calls and cause screeching audio feedback / echo.
 * 2. Strips redundant OS prefixes ("Default - ", "Communications - ").
 * 3. Strips unsightly USB vendor:product hex IDs (e.g. "(0020:0b21)").
 * 4. Recognizes and tags Bluetooth devices (e.g. AirPods, Realme Buds, Galaxy Buds) with "(Bluetooth)".
 * 5. Recognizes and tags built-in hardware (e.g. Microphone Array, laptop speakers) with "(Built-in)".
 * 6. Returns null if the device is a known loopback or should be hidden from user settings.
 */
export function cleanDeviceLabel(label: string, kind: MediaDeviceKind): string | null {
  if (!label) return "";

  // 1. Immediately reject virtual loopback devices that cause echo/feedback loops
  if (kind === "audioinput") {
    if (
      /stereo mix|what u hear|wave out|waveout|cable output|vb-audio|blackhole|soundflower|line in \(unused\)/i.test(
        label,
      )
    ) {
      return null;
    }
  }
  if (kind === "audiooutput") {
    if (/cable input|vb-audio|blackhole|soundflower/i.test(label)) {
      return null;
    }
  }

  // 2. Strip Windows virtual alias prefixes, hardware hex codes, and audio mode suffixes
  let s = label
    .replace(/^(Default|Communications)\s*-\s*/i, "")
    .replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)/g, "")
    .replace(/\s*(Hands-Free AG Audio|Hands-Free Audio|Hands-Free)\s*/gi, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 3. Built-in device identification
  if (/microphone array|smart sound|realtek/i.test(s)) {
    if (/microphone array/i.test(s)) {
      return "Microphone Array (Built-in)";
    }
    if (/speakers?/i.test(s)) {
      return "Speakers (Built-in)";
    }
  }

  // 4. Extract core name if wrapped like "Headset (Realme Buds)" or "Microphone (AB13X USB Audio)"
  const wrapperMatch = s.match(/^(Headset|Headphones|Microphone|Speakers?)\s*\((.+?)\)$/i);
  const coreName = wrapperMatch ? wrapperMatch[2].trim() : s;

  // 5. Bluetooth device identification
  const isBluetooth =
    /bluetooth|airpods|buds|freebuds|wh-|wf-|bose|jbl|hands-free|wireless|headset/i.test(
      label,
    );
  if (isBluetooth) {
    if (!/bluetooth/i.test(coreName)) {
      return `${coreName} (Bluetooth)`;
    }
    return coreName;
  }

  // 6. Camera labeling
  if (kind === "videoinput") {
    if (/integrated|facetime|built-in|internal/i.test(s) && !/built-in/i.test(s)) {
      return `${s} (Built-in)`;
    }
    if (/usb|c920|c922|brio|streamcam|webcam/i.test(s) && !/usb/i.test(s)) {
      return `${s} (USB)`;
    }
  }

  return s;
}

/**
 * Returns a deduplicated, cleanly-labeled list of devices ready for dropdown menus.
 * Places a single "System default (Device Name)" option at the top,
 * followed by distinct physical hardware devices (Bluetooth, USB, Built-in).
 */
export function getCleanDeviceList(
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  fallbackDefaultLabel?: string,
): CleanedDeviceOption[] {
  // 1. Detect active default device label if provided by browser
  const defaultEntry = devices.find(
    (d) =>
      d.kind === kind &&
      (d.deviceId === "default" || /^(Default|Communications)\s*-/i.test(d.label)),
  );
  const detectedDefaultLabel = defaultEntry
    ? cleanDeviceLabel(defaultEntry.label, kind)
    : null;

  const defaultOptionText = detectedDefaultLabel
    ? `System default (${detectedDefaultLabel})`
    : fallbackDefaultLabel || "System default";

  const result: CleanedDeviceOption[] = [
    {
      deviceId: "",
      label: defaultOptionText,
      isDefault: true,
    },
  ];

  const seenLabels = new Set<string>();
  const seenIds = new Set<string>();

  for (const device of devices) {
    if (device.kind !== kind) continue;

    // Skip virtual duplicate aliases ("default" and "communications")
    if (device.deviceId === "default" || device.deviceId === "communications") {
      continue;
    }
    if (/^(Default|Communications)\s*-/i.test(device.label)) {
      continue;
    }

    const cleaned = cleanDeviceLabel(device.label, kind);
    if (!cleaned) continue; // Loopback or invalid

    const normalizedKey = cleaned.toLowerCase();
    if (seenLabels.has(normalizedKey) || seenIds.has(device.deviceId)) {
      continue;
    }
    seenLabels.add(normalizedKey);
    seenIds.add(device.deviceId);

    result.push({
      deviceId: device.deviceId,
      label: cleaned,
    });
  }

  return result;
}
