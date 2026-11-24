"use client";

import { useEffect, useState } from "react";
import { RoomContext, RoomAudioRenderer } from "@livekit/components-react";
import { Room, RoomEvent } from "livekit-client";
import { LessonStage } from "./LessonStage";

/** LiveKit Egress supplies its own hidden, subscribe-only identity in the URL. */
export function LessonRecordingTemplate() {
  const [room] = useState(() => new Room({ adaptiveStream: false }));
  const [error, setError] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const url = query.get("url"), token = query.get("token");
    if (!url || !token) return;
    let disposed = false, started = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const end = () => {
      if (timer) clearInterval(timer);
      if (started) console.log("END_RECORDING");
      started = false;
    };
    room.on(RoomEvent.Disconnected, end);
    void room.connect(url, token, { autoSubscribe: true }).then(async () => {
      if (disposed) return;
      await room.startAudio();
      if (disposed) return;
      const deadline = Date.now() + 5000;
      timer = setInterval(() => {
        const videos = [...document.querySelectorAll<HTMLVideoElement>(".lesson-stage video")];
        const publications = [...room.remoteParticipants.values()].flatMap(p => [...p.videoTrackPublications.values()]).filter(p => !p.isMuted);
        const ready = publications.every(p => p.isSubscribed) && videos.length >= publications.length && videos.every(video => video.readyState >= 2);
        if (room.remoteParticipants.size && (ready || Date.now() >= deadline)) {
          clearInterval(timer);
          started = true;
          // LiveKit custom-template capture protocol. Do not log the URL/token.
          console.log("START_RECORDING");
        }
      }, 100);
    }).catch(() => {
      if (!disposed) setError("Unable to connect to the lesson recording room.");
    });
    return () => {
      disposed = true;
      end();
      room.off(RoomEvent.Disconnected, end);
      void room.disconnect();
    };
  }, [room]);

  return <div style={{ position: "fixed", inset: 0, background: "#111111", overflow: "hidden" }}>
    <RoomContext.Provider value={room}>
      {error ? <p role="alert">{error}</p> : <LessonStage recorder />}
      <RoomAudioRenderer />
    </RoomContext.Provider>
  </div>;
}
