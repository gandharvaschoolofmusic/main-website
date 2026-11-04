"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChat, useParticipants, useRoomContext, useAudioPlayback } from "@livekit/components-react";
import { ConnectionQuality, RoomEvent } from "livekit-client";
import { Info, Users, MessageSquare, Grid3X3, ShieldCheck, X, Copy, Search, Mic, MicOff, Pin, LayoutGrid, Maximize, PictureInPicture2, Sparkles, Settings, CircleHelp, Circle, FileText, Radio, Columns3, ChartNoAxesColumnIncreasing, MessageCircleQuestion, Timer, ChevronRight, Music2, Camera, Captions, Hand, Keyboard, LockKeyhole, MonitorUp, VolumeX } from "lucide-react";
import type { AudioMode } from "@/lib/audio-engine";
import type { MultiCameraState } from "@/hooks/useMultiCamera";
import { MeetStage, type MeetLayout } from "./MeetStage";
import { StageVideoLayout } from "./StageVideoLayout";
import { RoomControls } from "./RoomControls";
import { LessonChat } from "./LessonChat";
import { MeetSettings, type SettingsTab } from "./MeetSettings";
import { RoomDialog, RoomIconButton, RoomPanel, RoomSwitch } from "./MeetPrimitives";
import { TurnTakingControls, type TurnTakingState } from "./TurnTakingControls";

type Panel = "people" | "chat" | "tools" | "host" | "details" | "effects" | "help" | null;
type Modal = "settings" | "layout" | "captions" | "hand" | "recording" | null;
interface Props {
  lesson: { id: string; instrument: string; partnerName: string; isTeacher: boolean; startsAt: string; durationMinutes: number };
  audioMode: AudioMode; isSwitchingAudioMode: boolean; isMuted: boolean; isVideoOff: boolean; isScreenSharing: boolean;
  activeFloorState: TurnTakingState; onFloorChange: (value: TurnTakingState) => void;
  connectionQuality: ConnectionQuality; isReconnecting: boolean; timeFormatted: string;
  availableCameras: MediaDeviceInfo[]; selectedCameraId: string; audioDeviceId: string; multiCam: MultiCameraState;
  microphoneError: string; onAudioDeviceSwitch: (id: string) => Promise<void>;
  onToggleMic: () => Promise<void>; onToggleVideo: () => Promise<void>; onToggleScreenShare: () => Promise<void>;
  onSwitchAudioMode: (mode: AudioMode) => Promise<void>; onCameraDeviceSwitch: (id: string) => Promise<void>;
  onOpenMultiCam: () => void; onLeave: () => void; children: ReactNode;
}
const reactions = [{ emoji: "💖", name: "Love" }, { emoji: "👍", name: "Thumbs up" }, { emoji: "🎉", name: "Celebrate" }, { emoji: "👏", name: "Applause" }, { emoji: "😂", name: "Laugh" }, { emoji: "😮", name: "Surprised" }, { emoji: "😢", name: "Sad" }, { emoji: "🤔", name: "Thinking" }, { emoji: "👎", name: "Thumbs down" }];
const unavailableTools = [{ label: "Speech translation", description: "Translate speech into another language", icon: Captions }, { label: "Transcribe", description: "Capture the conversation", icon: FileText }, { label: "Live streaming", description: "Stream to view-only users", icon: Radio }, { label: "Breakout rooms", description: "Break into smaller groups", icon: Columns3 }, { label: "Polls", description: "Send polls to the audience", icon: ChartNoAxesColumnIncreasing }, { label: "Q&A", description: "Ask and answer questions", icon: MessageCircleQuestion }];
const layouts = [{ id: "auto", title: "Auto", description: "Focus on your partner, with a floating self-view" }, { id: "tiled", title: "Tiled", description: "See everyone in a grid" }, { id: "spotlight", title: "Spotlight", description: "Fill the stage with one person or presentation" }, { id: "sidebar", title: "Sidebar", description: "A main speaker with a strip of participants" }, { id: "studio", title: "Multi-camera studio", description: "Original lesson view with instrument angles" }] as const;

export function MeetRoomUI(props: Props) {
  const room = useRoomContext();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const participants = useParticipants({ updateOnlyOn: [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ParticipantNameChanged] });
  const { send } = useChat();
  const [panel, setPanel] = useState<Panel>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("Audio");
  const [moreOpen, setMoreOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [layout, setLayout] = useState<MeetLayout>("auto");
  const [pinned, setPinned] = useState<string | null>(null);
  const [mirror, setMirror] = useState(true);
  const [showSelf, setShowSelf] = useState(true);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState("");
  const [toolsTab, setToolsTab] = useState<"tools" | "addons">("tools");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ mic: props.onToggleMic, video: props.onToggleVideo });
  useEffect(() => { handlers.current = { mic: props.onToggleMic, video: props.onToggleVideo }; }, [props.onToggleMic, props.onToggleVideo]);
  const notify = (message: string) => { setNotice(message); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(""), 5000); };
  async function run(action: () => Promise<void>) { try { await action(); } catch (error) { notify(error instanceof Error ? error.message : "This action could not be completed. Please try again."); } }
  const togglePanel = (next: Panel) => { setPanel((current) => current === next ? null : next); setMoreOpen(false); setReactionsOpen(false); };
  const openSettings = (tab: SettingsTab) => { setSettingsTab(tab); setModal("settings"); setMoreOpen(false); };
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick(); const timer = setInterval(tick, 1000);
    return () => { clearInterval(timer); if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPanel(null); setMoreOpen(false); setReactionsOpen(false); }
      if ((event.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true],dialog")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); void handlers.current.mic().catch(() => setNotice("Could not change microphone state.")); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") { event.preventDefault(); void handlers.current.video().catch(() => setNotice("Could not change camera state.")); }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "h") { event.preventDefault(); setModal("hand"); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!moreOpen && !reactionsOpen) return;
    const outside = (event: PointerEvent) => { if (!popoverRef.current?.contains(event.target as Node)) { setMoreOpen(false); setReactionsOpen(false); } };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [moreOpen, reactionsOpen]);
  async function copyLink() { await navigator.clipboard.writeText(`${window.location.origin}/lesson/${props.lesson.id}`); notify("Lesson link copied"); }
  async function fullscreen() { setMoreOpen(false); if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector<HTMLElement>(".meet-room")?.requestFullscreen(); }
  async function pictureInPicture() {
    setMoreOpen(false);
    const video = document.querySelector<HTMLVideoElement>(".meet-main-tile video, .meet-stage video");
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (video && document.pictureInPictureEnabled) await video.requestPictureInPicture();
    else notify("Turn on a camera or presentation to use picture-in-picture.");
  }
  const floorControls = <TurnTakingControls isTeacher={props.lesson.isTeacher} activeState={props.activeFloorState} onStateChange={props.onFloorChange}/>;
  return <div className="meet-room">
    <header className="meet-topbar"><div className="meet-room-heading"><time suppressHydrationWarning>{clock || "--:--"}</time><span className="meet-divider"/><h1>{props.lesson.instrument} lesson</h1><RoomIconButton label="Meeting details" active={panel === "details"} onClick={() => togglePanel("details")}><Info size={17}/></RoomIconButton></div>
      <div className="meet-top-actions"><button className="meet-audio-status" type="button" onClick={() => openSettings("Audio")} title="Audio mode"><Mic size={14}/>{props.audioMode === "TALKING" ? "Talking mode" : "Instrument mode"}</button><button type="button" className="meet-people-pill" aria-label={`People (${participants.length})`} aria-expanded={panel === "people"} onClick={() => togglePanel("people")}><span className="meet-mini-avatar">{(room.localParticipant.name || "Y")[0]}</span><Users size={16}/><span>{participants.length}</span></button></div>
    </header>
    {props.microphoneError && <div className="meet-call-banner" role="alert">
      <span>{props.microphoneError}</span>
      <button type="button" onClick={() => openSettings("Audio")}>Audio settings</button>
    </div>}
    {!canPlayAudio && (
      <div className="meet-call-banner bg-amber-600/90 text-white font-medium flex items-center justify-center gap-2.5 py-2 px-4 shadow-lg" role="alert">
        <VolumeX size={18} />
        <span>Incoming sound is blocked by your browser.</span>
        <button
          type="button"
          onClick={() => void run(startAudio)}
          className="ml-2 px-3 py-1 bg-white text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-100 transition-colors shadow-sm cursor-pointer"
        >
          Enable Audio
        </button>
      </div>
    )}
    {(props.isReconnecting || props.isScreenSharing) && <div className="meet-call-banner" role="status">{props.isReconnecting ? "Reconnecting… Your call will resume automatically." : <><MonitorUp size={18}/>You’re presenting to everyone<button type="button" onClick={() => void run(props.onToggleScreenShare)}>Stop presenting</button></>}</div>}
    <main className="meet-workspace">
      <div className="meet-stage-wrap">
        {layout === "studio" ? <div className="meet-studio-stage"><StageVideoLayout activeFloorState={props.activeFloorState} isTeacher={props.lesson.isTeacher} audioMode={props.audioMode} availableCameras={props.availableCameras} selectedCameraId={props.selectedCameraId} onCameraDeviceSwitch={props.onCameraDeviceSwitch} multiCam={props.multiCam}/></div> : <MeetStage layout={layout} hands={{}} pinned={pinned} onPin={setPinned} mirror={mirror} showSelf={showSelf} partnerName={props.lesson.partnerName}/>}
        {participants.length === 1 && <div className="meet-alone-notice"><Users size={18}/><span>You’re the only one here</span><button type="button" onClick={() => void run(copyLink)}>Copy lesson link</button></div>}
      </div>
      <LessonChat isOpen={panel === "chat"} onClose={() => setPanel(null)} isTeacher={props.lesson.isTeacher} participantName={props.lesson.partnerName} onNewMessage={(count) => setUnread((current) => count === 0 ? 0 : current + count)}/>
      {panel === "people" && <RoomPanel title="People" onClose={() => setPanel(null)}><button type="button" className="meet-primary-button" onClick={() => void run(copyLink)}><Copy size={18}/>Copy joining info</button><label className="meet-search"><Search size={20}/><input aria-label="Search for people" placeholder="Search for people" value={search} onChange={(event) => setSearch(event.target.value)}/></label><h3 className="meet-overline">In the meeting</h3><div className="meet-participant-list"><h3>Contributors <span>{participants.length}</span></h3>{participants.filter((person) => (person.name || person.identity).toLowerCase().includes(search.toLowerCase())).map((person) => {
        let host = false; try { host = JSON.parse(person.metadata || "{}").role === "TEACHER"; } catch { /* A participant can have no role metadata. */ }
        return <div className="meet-person" key={person.identity}><span className="meet-mini-avatar">{(person.name || "P")[0]}</span><div><strong>{person.name || "Participant"}{person.isLocal ? " (You)" : ""}</strong><p>{host ? "Lesson teacher" : "Participant"}</p></div><span aria-label={person.isMicrophoneEnabled ? "Microphone on" : "Microphone off"}>{person.isMicrophoneEnabled ? <Mic size={18}/> : <MicOff size={18}/>}</span><RoomIconButton label={`Pin ${person.name || "participant"}`} active={pinned === person.identity} onClick={() => { setPinned(pinned === person.identity ? null : person.identity); setLayout("spotlight"); }}><Pin size={18}/></RoomIconButton></div>;
      })}{!participants.some((person) => (person.name || person.identity).toLowerCase().includes(search.toLowerCase())) && <p className="meet-muted meet-pad">No matching participants</p>}</div></RoomPanel>}
      {panel === "details" && <RoomPanel title="Meeting details" onClose={() => setPanel(null)}><h3>{props.lesson.instrument} lesson</h3><p className="meet-muted">with {props.lesson.partnerName}</p><div className="meet-detail-card"><span>Time remaining</span><strong>{props.timeFormatted}</strong></div><h3>Joining info</h3><p className="meet-link">{typeof window !== "undefined" ? `${window.location.origin}/lesson/${props.lesson.id}` : `/lesson/${props.lesson.id}`}</p><button type="button" className="meet-text-button" onClick={() => void run(copyLink)}><Copy size={18}/>Copy joining info</button><p className="meet-note"><LockKeyhole size={18}/>Only participants assigned to this lesson can join.</p><hr/><h3>Lesson participation</h3>{floorControls}</RoomPanel>}
      {panel === "tools" && <RoomPanel title="Meeting tools" onClose={() => setPanel(null)}><div className="meet-tabs"><button type="button" className={toolsTab === "tools" ? "is-selected" : ""} onClick={() => setToolsTab("tools")}>Tools</button><button type="button" className={toolsTab === "addons" ? "is-selected" : ""} onClick={() => setToolsTab("addons")}>Add-ons</button></div>{toolsTab === "tools" ? <>
        <ToolButton icon={<Timer/>} label="Lesson timer" description={`${props.timeFormatted} remaining in your lesson`} onClick={() => setPanel("details")}/>
        <ToolButton icon={<Music2/>} label={props.audioMode === "TALKING" ? "Talking mode" : "Instrument mode"} description="Microphone and music audio settings" onClick={() => openSettings("Audio")}/>
        <ToolButton icon={<Camera/>} label="Multi-camera studio" description={props.multiCam.isSecondaryCameraActive ? "Two camera angles active" : "Add a hands or instrument camera"} onClick={props.onOpenMultiCam}/>
        <ToolButton icon={<Hand/>} label="Lesson participation" description="Demonstrate, practise, and discuss" onClick={() => setModal("hand")}/>
        <ToolButton icon={<Circle/>} label="Lesson recording" description="Automatic lesson recording information" onClick={() => setModal("recording")}/>
        <h3 className="meet-section-title">Unavailable in this lesson room</h3><p className="meet-muted">These meeting tools are not enabled for this classroom.</p>{unavailableTools.map((tool) => <ToolButton key={tool.label} icon={<tool.icon/>} label={tool.label} description={tool.description} disabled/>)}
      </> : <div className="meet-empty-panel"><Grid3X3 size={36}/><h3>No add-ons installed</h3><p>Music and camera tools are available in the Tools tab.</p><button type="button" className="meet-text-button" onClick={() => setToolsTab("tools")}>View lesson tools</button></div>}</RoomPanel>}
      {panel === "host" && <RoomPanel title="Host controls" onClose={() => setPanel(null)}><p className="meet-muted">Lesson access and permissions are managed by the school. Your existing lesson settings remain in effect.</p><h3 className="meet-overline">Meeting moderation</h3><RoomSwitch label="Host management" description="Additional host moderation is not available in this room." checked={false} disabled/><h3 className="meet-overline">Let contributors</h3>{["Share their screen", "Send reactions in chat", "Turn on their microphone", "Turn on their video", "Send messages"].map((label) => <RoomSwitch key={label} label={label} checked disabled/>)}<h3 className="meet-overline">Meeting access</h3><p className="meet-note"><LockKeyhole size={20}/><span><strong>Restricted to lesson participants</strong><br/>Students and teachers sign in with their assigned account.</span></p><h3 className="meet-overline">Lesson participation</h3>{floorControls}</RoomPanel>}
      {panel === "effects" && <RoomPanel title="Backgrounds and effects" onClose={() => setPanel(null)}><div className="meet-effect-preview"><Camera size={36}/><span>Video appearance</span></div><RoomSwitch label="Mirror my video" description="Only changes your self-view." checked={mirror} onChange={() => setMirror(!mirror)}/><div className="meet-tabs"><span className="is-selected">Backgrounds</span><span>Filters</span><span>Appearance</span></div><div className="meet-background-options"><button type="button" aria-pressed="true"><X/>No effect</button><button type="button" disabled><Sparkles/>Blur</button><button type="button" disabled><Grid3X3/>Background</button></div><p className="meet-muted">Background replacement, blur, and filters are not available in this lesson room. Your camera feed stays unchanged.</p></RoomPanel>}
      {panel === "help" && <RoomPanel title="Troubleshooting and help" onClose={() => setPanel(null)}><div className="meet-detail-card"><span>Connection</span><strong>{props.isReconnecting ? "Reconnecting" : props.connectionQuality}</strong></div><h3>Audio and video</h3><p className="meet-muted">Check your selected microphone and camera in Settings. If a device is unavailable, close other apps using it and try again.</p><button type="button" className="meet-text-button" onClick={() => openSettings("Audio")}><Settings size={18}/>Open settings</button><h3>Keyboard shortcuts</h3><dl className="meet-shortcuts"><div><dt>Microphone</dt><dd>Ctrl + D</dd></div><div><dt>Camera</dt><dd>Ctrl + E</dd></div><div><dt>Lesson participation</dt><dd>Ctrl + Alt + H</dd></div></dl><h3>Need help with your lesson?</h3><p className="meet-muted">Contact your school administrator through your dashboard after the call.</p></RoomPanel>}
    </main>
    <footer className="meet-bottom-bar"><div className="meet-footer-spacer"/><div className="meet-controls-anchor" ref={popoverRef}>
      {reactionsOpen && <div className="meet-reactions-menu" role="group" aria-label="Send a reaction in chat">{reactions.map((reaction) => <button type="button" key={reaction.name} aria-label={`Send ${reaction.name} in chat`} title={reaction.name} onClick={() => void run(async () => { await send(reaction.emoji); if (reactionsEnabled) notify(`${reaction.emoji} Sent to in-call messages`); })}>{reaction.emoji}</button>)}</div>}
      {moreOpen && <div className="meet-more-menu" aria-label="More options"><MenuButton icon={<Circle/>} label="Lesson recording" onClick={() => { setModal("recording"); setMoreOpen(false); }}/><hr/><MenuButton icon={<LayoutGrid/>} label="Adjust view" onClick={() => { setModal("layout"); setMoreOpen(false); }}/><MenuButton icon={<Maximize/>} label="Full screen" onClick={() => void run(fullscreen)}/><MenuButton icon={<PictureInPicture2/>} label="Open picture-in-picture mode" onClick={() => void run(pictureInPicture)}/><MenuButton icon={<Sparkles/>} label="Backgrounds and effects" onClick={() => togglePanel("effects")}/><MenuButton icon={<Captions/>} label="Captions" onClick={() => { setModal("captions"); setMoreOpen(false); }}/><hr/><MenuButton icon={<CircleHelp/>} label="Troubleshooting and help" onClick={() => togglePanel("help")}/><MenuButton icon={<Keyboard/>} label="Keyboard shortcuts" onClick={() => openSettings("General")}/><MenuButton icon={<Settings/>} label="Settings" onClick={() => openSettings("Audio")}/></div>}
      <RoomControls isMuted={props.isMuted} isVideoOff={props.isVideoOff} isScreenSharing={props.isScreenSharing} handRaised={false} captionsOpen={modal === "captions"} reactionsOpen={reactionsOpen} moreOpen={moreOpen} onToggleMic={() => void run(props.onToggleMic)} onToggleVideo={() => void run(props.onToggleVideo)} onToggleScreenShare={() => void run(props.onToggleScreenShare)} onToggleHand={() => setModal("hand")} onToggleCaptions={() => setModal("captions")} onToggleReactions={() => { setReactionsOpen(!reactionsOpen); setMoreOpen(false); }} onToggleMore={() => { setMoreOpen(!moreOpen); setReactionsOpen(false); }} onSettings={openSettings} onLeave={props.onLeave}/>
    </div><nav className="meet-side-dock" aria-label="Meeting panels"><RoomIconButton label="Chat with everyone" active={panel === "chat"} onClick={() => togglePanel("chat")}><MessageSquare/>{unread > 0 && panel !== "chat" && <span className="meet-unread">{unread > 9 ? "9+" : unread}</span>}</RoomIconButton><RoomIconButton label="Meeting tools" active={panel === "tools"} onClick={() => togglePanel("tools")}><Grid3X3/></RoomIconButton><RoomIconButton label="Host controls" active={panel === "host"} onClick={() => togglePanel("host")}><ShieldCheck/></RoomIconButton></nav></footer>
    {notice && <div className="meet-toast" role="status"><span>{notice}</span><RoomIconButton label="Dismiss notification" onClick={() => setNotice("")}><X size={18}/></RoomIconButton></div>}
    {modal === "settings" && <MeetSettings tab={settingsTab} setTab={setSettingsTab} onClose={() => setModal(null)} audioMode={props.audioMode} switchingAudio={props.isSwitchingAudioMode} onAudioMode={props.onSwitchAudioMode} audioDeviceId={props.audioDeviceId} videoDeviceId={props.selectedCameraId} onAudioDevice={props.onAudioDeviceSwitch} onVideoDevice={props.onCameraDeviceSwitch} mirror={mirror} setMirror={setMirror} showSelf={showSelf} setShowSelf={setShowSelf} reactionsEnabled={reactionsEnabled} setReactionsEnabled={setReactionsEnabled} onEffects={() => { setModal(null); setPanel("effects"); }}/>}
    {modal === "layout" && <RoomDialog title="Adjust view" onClose={() => setModal(null)}><div className="meet-dialog-content"><p className="meet-muted">Choose how you see people in this call.</p>{layouts.map((item) => <label className="meet-layout-option" key={item.id}><input type="radio" name="layout" value={item.id} checked={layout === item.id} onChange={() => setLayout(item.id)}/><span><strong>{item.title}</strong><small>{item.description}</small></span><span className={`meet-layout-preview preview-${item.id}`} aria-hidden="true"><i/><i/><i/><i/></span></label>)}<div className="meet-dialog-actions"><button type="button" className="meet-text-button" onClick={() => setModal(null)}>Done</button></div></div></RoomDialog>}
    {modal === "captions" && <RoomDialog title="Captions" onClose={() => setModal(null)}><div className="meet-dialog-content"><Captions size={32}/><h3>Live captions aren’t available yet</h3><p className="meet-muted">You can use in-call messages during your lesson. Audio remains in {props.audioMode === "TALKING" ? "Talking Mode" : "Instrument Mode"}.</p><div className="meet-dialog-actions"><button type="button" className="meet-text-button" onClick={() => { setModal(null); setPanel("chat"); }}>Open messages</button></div></div></RoomDialog>}
    {modal === "hand" && <RoomDialog title="Lesson participation" onClose={() => setModal(null)}><div className="meet-dialog-content"><Hand size={32}/><h3>{props.lesson.isTeacher ? "Guide your lesson" : "Ready to play?"}</h3><p className="meet-muted">Use the lesson’s turn-taking controls to request a turn or return to discussion.</p>{floorControls}<div className="meet-dialog-actions"><button type="button" className="meet-text-button" onClick={() => setModal(null)}>Done</button></div></div></RoomDialog>}
    {modal === "recording" && <RoomDialog title="Lesson recording" onClose={() => setModal(null)}><div className="meet-dialog-content"><Circle size={32}/><h3>Automatic lesson recording</h3><p className="meet-muted">Available lesson recordings appear in the dashboard after processing. Recording is managed automatically for this lesson.</p><p className="meet-muted">Manual recording and transcripts are not available here.</p><div className="meet-dialog-actions"><button type="button" className="meet-text-button" onClick={() => setModal(null)}>Got it</button></div></div></RoomDialog>}
    {props.children}
  </div>;
}

function ToolButton({ icon, label, description, onClick, disabled }: { icon: ReactNode; label: string; description: string; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" className="meet-tool-button" onClick={onClick} disabled={disabled} title={disabled ? `${label} is not available in this lesson room` : undefined}><span className="meet-tool-icon">{icon}</span><span><strong>{label}</strong><small>{description}</small></span>{!disabled && <ChevronRight size={21}/>}</button>;
}
function MenuButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) { return <button type="button" className="meet-menu-button" onClick={onClick}>{icon}<span>{label}</span></button>; }
