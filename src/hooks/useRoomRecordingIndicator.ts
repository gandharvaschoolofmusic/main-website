"use client";

import { useEffect, useState } from "react";
import { Room, RoomEvent, type RemoteParticipant } from "livekit-client";

const topic = "lesson.recording";

export function useRoomRecordingIndicator(room: Room, localRecording: boolean) {
  const [serverRecording, setServerRecording] = useState(room.isRecording);
  const [recorders, setRecorders] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const sync = () => setServerRecording(room.isRecording);
    sync();
    room.on(RoomEvent.RecordingStatusChanged, sync).on(RoomEvent.Connected, sync).on(RoomEvent.Reconnected, sync);
    return () => { room.off(RoomEvent.RecordingStatusChanged, sync).off(RoomEvent.Connected, sync).off(RoomEvent.Reconnected, sync); };
  }, [room]);
  useEffect(() => {
    const send = (state: number) => {
      void room.localParticipant.publishData(Uint8Array.of(state), { reliable: true, topic }).catch(() => {});
    };
    const forget = (person: RemoteParticipant) => {
      setRecorders(previous => {
        if (!previous.has(person.identity)) return previous;
        const next = new Set(previous);
        next.delete(person.identity);
        return next;
      });
    };
    const receive = (data: Uint8Array, person?: RemoteParticipant, _kind?: unknown, channel?: string) => {
      if (channel !== topic || !person) return;
      if (data[0] === 2) {
        if (localRecording) send(1);
      } else if (data[0] === 1) {
        try {
          const { role, companion } = JSON.parse(person.metadata || "{}");
          if (companion || (role !== "TEACHER" && role !== "ADMIN")) return;
        } catch { return; }
        setRecorders(previous => new Set(previous).add(person.identity));
      } else if (data[0] === 0) forget(person);
    };
    const announce = () => {
      setRecorders(new Set());
      send(localRecording ? 1 : 0);
      send(2); // Ask existing browser recorders when joining or reconnecting.
    };
    room.on(RoomEvent.DataReceived, receive).on(RoomEvent.ParticipantDisconnected, forget)
      .on(RoomEvent.Connected, announce).on(RoomEvent.Reconnected, announce);
    if (room.state === "connected") announce();
    return () => {
      room.off(RoomEvent.DataReceived, receive).off(RoomEvent.ParticipantDisconnected, forget)
        .off(RoomEvent.Connected, announce).off(RoomEvent.Reconnected, announce);
    };
  }, [room, localRecording]);
  return serverRecording || localRecording || recorders.size > 0;
}
