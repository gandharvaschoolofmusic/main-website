"use client";

import { useState } from "react";
import { useTracks, useIsSpeaking, VideoTrack, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MicOff, Hand, Pin, PinOff, Maximize, Minimize, FlipHorizontal } from "lucide-react";
import { RoomIconButton } from "./MeetPrimitives";

export type MeetLayout = "auto" | "tiled" | "spotlight" | "sidebar" | "studio";
export function trackKey(track: TrackReferenceOrPlaceholder) { return `${track.participant.identity}:${track.source}:${track.publication?.trackName || "camera"}`; }

export function MeetStage({ layout, hands, pinned, onPin, mirror, showSelf, partnerName }: { layout: MeetLayout; hands: Record<string, boolean>; pinned: string | null; onPin: (key: string | null) => void; mirror: boolean; showSelf: boolean; partnerName: string }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const visible = tracks.filter((track) => showSelf || !track.participant.isLocal || track.source === Track.Source.ScreenShare);
  const screen = visible.find((track) => track.source === Track.Source.ScreenShare);
  const main = visible.find((track) => trackKey(track) === pinned || (track.participant.identity === pinned && track.source === Track.Source.Camera)) || screen || visible.find((track) => !track.participant.isLocal) || visible[0];
  const rest = visible.filter((track) => trackKey(track) !== (main && trackKey(main)));
  const grid = layout === "tiled" || (layout === "auto" && visible.length > 2 && !screen && !pinned);
  const floating = layout === "auto" && !screen && rest.length === 1;
  const renderTile = (track: TrackReferenceOrPlaceholder) => <MeetTile key={trackKey(track)} track={track} raised={Boolean(hands[track.participant.identity])} pinned={pinned === trackKey(track) || pinned === track.participant.identity} onPin={() => onPin(pinned === trackKey(track) || pinned === track.participant.identity ? null : trackKey(track))} mirror={mirror} />;
  return <div className={`meet-stage ${grid ? "is-tiled" : "is-focused"} ${floating ? "has-floating-self" : ""} ${layout === "spotlight" ? "is-spotlight" : ""}`} data-count={Math.min(visible.length, 9)}>
    {visible.length === 0 ? <div className="meet-stage-empty"><div className="meet-avatar">{partnerName[0]}</div><h2>Waiting for {partnerName}</h2><p>{showSelf ? "Your lesson video will appear here." : "Your self-view is hidden. You can show it in Settings."}</p></div> : grid ? visible.map(renderTile) : <>
      <div className="meet-main-tile">{main && renderTile(main)}</div>
      {rest.length > 0 && layout !== "spotlight" && <div className="meet-filmstrip">{rest.map(renderTile)}</div>}
    </>}
  </div>;
}

function MeetTile({ track, raised, pinned, onPin, mirror }: { track: TrackReferenceOrPlaceholder; raised: boolean; pinned: boolean; onPin: () => void; mirror: boolean }) {
  const speaking = useIsSpeaking(track.participant);
  const [fit, setFit] = useState(false);
  const [flip, setFlip] = useState(false);
  const isScreen = track.source === Track.Source.ScreenShare;
  const isSecondary = track.publication?.trackName === "secondary-camera";
  const hasVideo = track.publication?.track && !track.publication.isMuted;
  const name = track.participant.name || "Participant";
  const local = track.participant.isLocal;
  return <article className={`meet-tile ${speaking ? "is-speaking" : ""} ${isScreen ? "is-presentation" : ""}`} aria-label={`${name}${isScreen ? " presentation" : " video"}`}>
    {hasVideo && track.publication ? <VideoTrack trackRef={{ participant: track.participant, source: track.source, publication: track.publication }} className={`meet-video ${fit || isScreen ? "is-contained" : ""} ${(local && !isScreen && mirror) !== flip ? "is-mirrored" : ""}`} /> : <div className={`meet-camera-off ${local ? "is-local" : ""}`}><div className="meet-avatar">{name.trim().charAt(0).toUpperCase()}</div></div>}
    <div className="meet-tile-status">{raised && <span aria-label="Hand raised"><Hand size={18}/></span>}{!track.participant.isMicrophoneEnabled ? <span aria-label="Microphone off"><MicOff size={16}/></span> : speaking ? <span className="meet-speaking" aria-label="Speaking"><i/><i/><i/></span> : null}</div>
    <div className="meet-tile-actions"><RoomIconButton label={pinned ? `Unpin ${name}` : `Pin ${name}`} active={pinned} onClick={onPin}>{pinned ? <PinOff/> : <Pin/>}</RoomIconButton><RoomIconButton label={fit ? "Fill tile" : "Fit video"} onClick={() => setFit(!fit)}>{fit ? <Minimize/> : <Maximize/>}</RoomIconButton>{local && !isScreen && <RoomIconButton label="Mirror video" onClick={() => setFlip(!flip)}><FlipHorizontal/></RoomIconButton>}</div>
    <div className="meet-tile-name">{pinned && <Pin size={14}/>}<span>{local ? `${name} (You)` : name}{isScreen ? " · Presenting" : isSecondary ? " · Instrument camera" : ""}</span></div>
  </article>;
}


