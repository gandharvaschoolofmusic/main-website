import { RoomEvent, Track, type Room } from "livekit-client";

/** Recover interrupted playback/capture without touching a healthy camera or screen share. */
export function watchLessonVideo(room: Room, cameraWanted: () => boolean, cameraDevice: () => string) {
  let disposed = false;
  let recovering = false;
  const recover = async () => {
    if (disposed || room.state !== "connected" || document.visibilityState === "hidden") return;
    void room.startVideo().catch(() => {});
    const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    if (recovering || !cameraWanted() || (track?.mediaStreamTrack.readyState === "live" && !track.isMuted)) return;
    recovering = true;
    try {
      if (track?.mediaStreamTrack.readyState === "ended") {
        const deviceId = cameraDevice();
        await track.restartTrack(deviceId ? { deviceId: { ideal: deviceId } } : undefined);
      }
      if (disposed) { track?.stop(); return; }
      // A user may turn the camera off while its hardware restart is in flight.
      await room.localParticipant.setCameraEnabled(cameraWanted());
    } catch (error) {
      console.warn("[LessonVideo] Camera recovery failed; use the camera control to retry.", error);
    } finally {
      recovering = false;
    }
  };
  const visible = () => { void recover(); };
  const gesture = () => { if (!room.canPlaybackVideo) void room.startVideo().catch(() => {}); };
  room.on(RoomEvent.Reconnected, visible);
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("pageshow", visible);
  document.addEventListener("click", gesture, true);
  return () => {
    disposed = true;
    room.off(RoomEvent.Reconnected, visible);
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("pageshow", visible);
    document.removeEventListener("click", gesture, true);
  };
}
