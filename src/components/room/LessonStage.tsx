"use client";

import { useRoomContext, useTracks, VideoTrack } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { lessonStageItems, lessonStageLayout } from "@/lib/lesson-stage-layout";
import "./lesson-stage.css";

export function LessonStage({ recorder = false, mirror = false }: { recorder?: boolean; mirror?: boolean }) {
  const room = useRoomContext();
  // Subscribe to membership, metadata and publication changes, never speaker order.
  useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], {
    onlySubscribed: false,
    updateOnlyOn: [RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantNameChanged,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed],
  });
  const participants = [room.localParticipant, ...room.remoteParticipants.values()];
  const tiles = lessonStageLayout(lessonStageItems(participants, recorder ? room.localParticipant.identity : undefined));
  return <div className="lesson-stage-viewport"><div className="lesson-stage" aria-label="Lesson split-screen layout">
    {!tiles.length && <div className="lesson-stage-empty">Waiting for lesson participants</div>}
    {tiles.map(tile => <div key={tile.key} className="lesson-stage-cell" data-participant={tile.participant.identity} data-source={tile.source}
      style={{ left: `${tile.x * 100}%`, top: `${tile.y * 100}%`, width: `${tile.width * 100}%`, height: `${tile.height * 100}%` }}>
      <article className="lesson-stage-tile" aria-label={tile.label}>
        {tile.publication?.track && !tile.publication.isMuted
          ? <VideoTrack trackRef={{ participant: tile.participant, publication: tile.publication, source: tile.source }} className={mirror && tile.participant.isLocal && tile.source === Track.Source.Camera ? "lesson-stage-video is-mirrored" : "lesson-stage-video"} />
          : <div className="lesson-stage-placeholder">{(tile.participant.name || "P").trim().charAt(0).toUpperCase()}</div>}
        <div className="lesson-stage-label">{tile.label}</div>
      </article>
    </div>)}
  </div></div>;
}
