"use client";

import { Mic, MicOff, Video, VideoOff, ChevronUp, MonitorUp, Smile, Captions, Hand, MoreVertical, PhoneOff, Loader2 } from "lucide-react";
import { RoomIconButton } from "./MeetPrimitives";

interface RoomControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  handRaised: boolean;
  captionsOpen: boolean;
  reactionsOpen: boolean;
  moreOpen: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHand: () => void;
  onToggleCaptions: () => void;
  onToggleReactions: () => void;
  onToggleMore: () => void;
  onSettings: (tab: "Audio" | "Video") => void;
  onLeave: () => void;
  isLeaving?: boolean;
}

export function RoomControls(props: RoomControlsProps) {
  return <div className="meet-control-dock" role="group" aria-label="Call controls">
    <div className={`meet-device-pair ${props.isMuted ? "is-off" : ""}`}>
      <RoomIconButton label="Audio settings" className="meet-device-chevron" onClick={() => props.onSettings("Audio")}><ChevronUp/></RoomIconButton>
      <RoomIconButton label={props.isMuted ? "Turn on microphone (Ctrl+D)" : "Turn off microphone (Ctrl+D)"} className="meet-device-toggle" onClick={props.onToggleMic}>{props.isMuted ? <MicOff/> : <Mic/>}</RoomIconButton>
    </div>
    <div className={`meet-device-pair ${props.isVideoOff ? "is-off" : ""}`}>
      <RoomIconButton label="Video settings" className="meet-device-chevron" onClick={() => props.onSettings("Video")}><ChevronUp/></RoomIconButton>
      <RoomIconButton label={props.isVideoOff ? "Turn on camera (Ctrl+E)" : "Turn off camera (Ctrl+E)"} className="meet-device-toggle" onClick={props.onToggleVideo}>{props.isVideoOff ? <VideoOff/> : <Video/>}</RoomIconButton>
    </div>
    <RoomIconButton label={props.isScreenSharing ? "Stop presenting" : "Present now"} active={props.isScreenSharing} onClick={props.onToggleScreenShare}><MonitorUp/></RoomIconButton>
    <RoomIconButton label="Send a reaction" active={props.reactionsOpen} aria-expanded={props.reactionsOpen} onClick={props.onToggleReactions}><Smile/></RoomIconButton>
    <RoomIconButton label="Captions" active={props.captionsOpen} className="meet-secondary-control" onClick={props.onToggleCaptions}><Captions/></RoomIconButton>
    <RoomIconButton label={props.handRaised ? "Lower hand (Ctrl+Alt+H)" : "Raise hand (Ctrl+Alt+H)"} active={props.handRaised} onClick={props.onToggleHand}><Hand/></RoomIconButton>
    <RoomIconButton label="More options" active={props.moreOpen} aria-expanded={props.moreOpen} onClick={props.onToggleMore}><MoreVertical/></RoomIconButton>
    <RoomIconButton
      label={props.isLeaving ? "Ending meeting..." : "Leave call"}
      className={`meet-leave ${props.isLeaving ? "is-leaving" : ""}`}
      disabled={props.isLeaving}
      onClick={props.onLeave}
    >
      {props.isLeaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <PhoneOff />}
    </RoomIconButton>
  </div>;
}
