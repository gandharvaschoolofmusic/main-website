"use client";

import { useEffect } from "react";
import { RoomEvent, type Room } from "livekit-client";

// A subscribed track can still be silent when the browser pauses playback after
// a tab/phone interruption. Keep the SDK renderer as the single audio output.
export function useLessonAudioPlayback(room: Room) {
  useEffect(() => {
    const resume = () => {
      if (room.state !== "connected") return;
      // Call directly from gestures, before any await, to retain browser activation.
      // The SDK exposes failure through canPlaybackAudio and the existing sound banner.
      void room.startAudio().catch(() => {});
    };
    const visible = () => {
      if (document.visibilityState === "visible") resume();
    };
    const gesture = () => {
      const paused = [...room.remoteParticipants.values()].some(participant =>
        [...participant.audioTrackPublications.values()].some(publication =>
          publication.audioTrack?.attachedElements.some(element => element.paused),
        ),
      );
      if (!room.canPlaybackAudio || paused) resume();
    };

    room.on(RoomEvent.Connected, resume);
    room.on(RoomEvent.Reconnected, resume);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", visible);
    document.addEventListener("click", gesture, true);
    document.addEventListener("keydown", gesture, true);
    resume();
    return () => {
      room.off(RoomEvent.Connected, resume);
      room.off(RoomEvent.Reconnected, resume);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", visible);
      document.removeEventListener("click", gesture, true);
      document.removeEventListener("keydown", gesture, true);
    };
  }, [room]);
}
