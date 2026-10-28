"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Mic, Video, Settings, Captions, Smile, Volume2 } from "lucide-react";
import type { AudioMode } from "@/lib/audio-engine";
import { RoomDialog, RoomSwitch } from "./MeetPrimitives";

export type SettingsTab = "Audio" | "Video" | "General" | "Captions" | "Reactions";
const tabs = [{ name: "Audio", icon: Mic }, { name: "Video", icon: Video }, { name: "General", icon: Settings }, { name: "Captions", icon: Captions }, { name: "Reactions", icon: Smile }] as const;

export function MeetSettings({ tab, setTab, onClose, audioMode, switchingAudio, onAudioMode, audioDeviceId, videoDeviceId, onAudioDevice, onVideoDevice, mirror, setMirror, showSelf, setShowSelf, reactionsEnabled, setReactionsEnabled, onEffects }: {
  tab: SettingsTab; setTab: (tab: SettingsTab) => void; onClose: () => void;
  audioMode: AudioMode; switchingAudio: boolean; onAudioMode: (mode: AudioMode) => Promise<void>;
  audioDeviceId: string; videoDeviceId: string; onAudioDevice: (id: string) => Promise<void>; onVideoDevice: (id: string) => Promise<void>;
  mirror: boolean; setMirror: (value: boolean) => void; showSelf: boolean; setShowSelf: (value: boolean) => void;
  reactionsEnabled: boolean; setReactionsEnabled: (value: boolean) => void; onEffects: () => void;
}) {
  const room = useRoomContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState("");
  const [speaker, setSpeaker] = useState(() => room.getActiveDevice("audiooutput") || "default");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const update = () => navigator.mediaDevices.enumerateDevices().then((items) => { if (active) setDevices(items); }).catch(() => { if (active) setError("Device list is unavailable. Check browser permissions."); });
    void update();
    navigator.mediaDevices?.addEventListener("devicechange", update);
    return () => { active = false; navigator.mediaDevices?.removeEventListener("devicechange", update); };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Could not update this setting. Please try again."); } finally { setBusy(false); }
  }
  const selectDevice = (kind: MediaDeviceKind, label: string, value: string, onChange: (id: string) => Promise<void>) => <label className="meet-field"><span>{label}</span><select aria-label={label} value={value} disabled={busy} onChange={(event) => void run(() => onChange(event.target.value))}><option value="">System default</option>{devices.filter((device) => device.kind === kind).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>;
  async function testSpeaker() {
    const context = new AudioContext();
    try {
      if ("setSinkId" in context) await (context as AudioContext & { setSinkId: (id: string) => Promise<void> }).setSinkId(speaker === "default" ? "" : speaker);
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 440; gain.gain.value = 0.07;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.6);
      await new Promise<void>((resolve) => { oscillator.onended = () => resolve(); oscillator.stop(context.currentTime + 0.7); });
    } finally { await context.close(); }
  }
  return <RoomDialog title="Settings" onClose={onClose} wide>
    <div className="meet-settings-layout"><nav aria-label="Settings categories">{tabs.map(({ name, icon: Icon }) => <button type="button" key={name} aria-current={tab === name ? "page" : undefined} className={tab === name ? "is-selected" : ""} onClick={() => setTab(name)}><Icon size={21}/>{name}</button>)}</nav>
      <div className="meet-settings-content" aria-label={`${tab} settings`}>
        {error && <p className="meet-error" role="alert">{error}</p>}
        {tab === "Audio" && <>
          {selectDevice("audioinput", "Microphone", audioDeviceId, onAudioDevice)}
          <div className="meet-speaker-field">{selectDevice("audiooutput", "Speaker", speaker, async (id) => { await room.switchActiveDevice("audiooutput", id); setSpeaker(id); })}<button type="button" className="meet-text-button" disabled={busy} onClick={() => void run(testSpeaker)}><Volume2 size={18}/> Test</button></div>
          <RoomSwitch label="Music mode" description="Preserve instrument tone with stereo audio. Use headphones to avoid echo." checked={audioMode === "PLAYING"} disabled={switchingAudio || busy} onChange={() => void run(() => onAudioMode(audioMode === "PLAYING" ? "TALKING" : "PLAYING"))}/>
          <p className="meet-muted">{audioMode === "PLAYING" ? "Noise suppression and echo cancellation are off." : "Noise suppression and echo cancellation are on for clear speech."}</p>
        </>}
        {tab === "Video" && <>
          <button type="button" className="meet-settings-callout" onClick={onEffects}>Video appearance <span>Backgrounds and effects</span></button>
          {selectDevice("videoinput", "Camera", videoDeviceId, onVideoDevice)}
          <label className="meet-field"><span>Send resolution (maximum)</span><select disabled><option>Auto — managed by the lesson</option></select></label>
          <label className="meet-field"><span>Receive resolution (maximum)</span><select disabled><option>Auto — adapts to your connection</option></select></label>
          <RoomSwitch label="Mirror my video" description="Only changes how you see yourself." checked={mirror} onChange={() => setMirror(!mirror)}/>
        </>}
        {tab === "General" && <>
          <RoomSwitch label="Show my self-view" checked={showSelf} onChange={() => setShowSelf(!showSelf)}/>
          <h3>Keyboard shortcuts</h3><dl className="meet-shortcuts"><div><dt>Microphone on / off</dt><dd>Ctrl + D</dd></div><div><dt>Camera on / off</dt><dd>Ctrl + E</dd></div><div><dt>Lesson participation</dt><dd>Ctrl + Alt + H</dd></div><div><dt>Close panel or menu</dt><dd>Esc</dd></div></dl>
        </>}
        {tab === "Captions" && <><Captions size={32}/><h3>Live captions</h3><p className="meet-muted">Live captions and translated captions are not available in this lesson room yet. You can use in-call messages to follow along in writing.</p><RoomSwitch label="Live captions" checked={false} disabled/><label className="meet-field"><span>Meeting language</span><select disabled><option>English</option></select></label></>}
        {tab === "Reactions" && <><RoomSwitch label="Reaction confirmations" description="Show a confirmation when you send an emoji to in-call messages." checked={reactionsEnabled} onChange={() => setReactionsEnabled(!reactionsEnabled)}/><div className="meet-reaction-example" aria-hidden="true">💖 👍 🎉 👏 😂</div><p className="meet-muted">Your preference only applies to your view. Reduced-motion preferences are respected.</p></>}
      </div>
    </div>
  </RoomDialog>;
}

