import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Room, RoomEvent, Track } from "livekit-client";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useLessonMicrophone } from "../../src/hooks/useLessonMicrophone";
import { useLessonAutoRecorder } from "../../src/hooks/useLessonAutoRecorder";
import { getCleanDeviceList } from "../../src/lib/media-devices";
import { PreJoinScreen } from "../../src/components/room/PreJoinScreen";
import { MeetSettings } from "../../src/components/room/MeetSettings";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(120);
  }
  throw new Error(description);
}

// Exercise the real SDK sender, receiver and renderer. Only the hardware capture
// boundary is synthetic so the check cannot transmit a real person's microphone.
const sound = new AudioContext();
const requests = [];
let failNextCapture;
navigator.mediaDevices.getUserMedia = async ({ audio }) => {
  if (!audio) throw new Error("Audio-only test");
  const id = audio.deviceId?.exact || "default";
  requests.push({ id, noiseSuppression: audio.noiseSuppression });
  if (id === "missing") throw new DOMException("Device not found", "NotFoundError");
  if (failNextCapture) {
    const name = failNextCapture;
    failNextCapture = undefined;
    throw new DOMException("Simulated capture failure", name);
  }
  return tone(id === "usb" ? 523 : 349);
};

function tone(frequency) {
  const source = sound.createOscillator();
  source.frequency.value = frequency;
  const gain = sound.createGain();
  gain.gain.value = 0.12;
  const destination = sound.createMediaStreamDestination();
  source.connect(gain).connect(destination);
  source.start();
  return destination.stream;
}

let recordingStream;
let rotate;
let recorder;
const segments = [];
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (url, options) => {
  if (url === "/api/lessons/audio-smoke/recording") {
    segments.push(options.body.get("file"));
    return Response.json({ success: true });
  }
  return fetchOriginal(url, options);
};
const intervalOriginal = window.setInterval.bind(window);
window.setInterval = (callback, period, ...args) => {
  if (period === 240000) rotate = callback;
  return intervalOriginal(callback, period, ...args);
};
window.MediaRecorder = class extends MediaRecorder {
  constructor(stream, options) {
    super(stream, options);
    recordingStream = stream;
  }
};

const controllers = new Map();
let showSettings;
function Peer({ room, name }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { if (name === "student") showSettings = setSettingsOpen; }, [name]);
  const sessionRecorder = useLessonAutoRecorder({ room, lessonId: "audio-smoke", enabled: name === "student", partnerName: "Teacher", instrument: "Voice" });
  useEffect(() => { if (name === "student") recorder = sessionRecorder; }, [name, sessionRecorder]);
  const mic = useLessonMicrophone(room, {
    audioMode: "TALKING", audioDeviceId: name === "teacher" ? "missing" : "",
    isAudioMuted: name === "student",
  });
  useEffect(() => { controllers.set(name, mic); }, [name, mic]);
  return <div id={name}><RoomAudioRenderer room={room} />{settingsOpen &&
    <MeetSettings tab="Audio" audioMode={mic.settings.mode} audioDeviceId={mic.settings.deviceId}
      onClose={() => setSettingsOpen(false)} />}
  </div>;
}

async function checkSpeaker() {
  const devices = navigator.mediaDevices;
  const enumerate = devices.enumerateDevices.bind(devices);
  const setSink = HTMLMediaElement.prototype.setSinkId;
  const routed = new Set();
  devices.enumerateDevices = async () => [{ kind: "audiooutput", deviceId: "speaker-usb", label: "USB speakers" }];
  HTMLMediaElement.prototype.setSinkId = async function(id) {
    if (id === "speaker-usb") routed.add(this);
  };
  try {
    showSettings(true);
    const picker = () => document.querySelector('select[aria-label="Speaker"]');
    await until(() => picker()?.querySelector('option[value="speaker-usb"]'), "Speaker selector did not load");
    picker().value = "speaker-usb";
    picker().dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => routed.has(document.querySelector("#student audio")) && !picker().disabled, "Call did not select the requested output");
    const test = [...document.querySelectorAll("dialog button")].find(button => button.textContent.trim() === "Test");
    test.click();
    await until(() => [...routed].some(element => !element.isConnected && !element.paused), "Test tone did not use the chosen output");
    await until(() => !test.disabled, "Speaker test did not finish");
  } finally {
    showSettings(false);
    HTMLMediaElement.prototype.setSinkId = setSink;
    devices.enumerateDevices = enumerate;
  }
}

async function checkPreview(root) {
  const devices = navigator.mediaDevices;
  const enumerate = devices.enumerateDevices.bind(devices);
  const capture = devices.getUserMedia;
  devices.enumerateDevices = async () => ["usb", "missing"].map(deviceId => ({ deviceId, kind: "audioinput", label: deviceId }));
  let last;
  devices.getUserMedia = async constraints => {
    last = constraints;
    return capture(constraints);
  };
  try {
    root.render(<PreJoinScreen lesson={{ instrument: "Voice", durationMinutes: 30, partnerName: "Teacher" }} />);
    const select = (label, value) => {
      const element = document.querySelector('select[aria-label="' + label + '"]');
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const preview = () => document.querySelector("video")?.srcObject?.getAudioTracks()[0];
    await until(() => preview() && document.querySelector('option[value="missing"]'), "No preview input");
    select("Audio mode", "PLAYING");
    await until(() => last?.audio?.noiseSuppression === false && document.querySelector('select[aria-label="Audio mode"]').value === "PLAYING", "Preview music profile was not applied");
    const working = preview();
    select("Microphone", "missing");
    await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Could not open"), "Missing preview error");
    if (working !== preview() || working.readyState !== "live") throw new Error("Failed preview switch lost working microphone");
    root.render(null);
    await until(() => working.readyState === "ended", "Preview microphone was not released");
  } finally {
    devices.enumerateDevices = enumerate;
    devices.getUserMedia = capture;
  }
}

async function hear(room, receiver, sender, source = Track.Source.Microphone) {
  const track = () => room.remoteParticipants.get(sender)?.getTrackPublication(source)?.track;
  let baseline;
  await until(async () => {
    const audio = [...document.querySelectorAll("#" + receiver + " audio")].find(el =>
      el.srcObject?.getAudioTracks().includes(track()?.mediaStreamTrack));
    if (!audio || audio.paused || audio.muted || !track()?.receiver) return false;
    for (const stat of (await track().receiver.getStats()).values()) {
      if (stat.type !== "inbound-rtp" || stat.totalAudioEnergy === undefined) continue;
      baseline ??= stat.totalAudioEnergy;
      if (stat.totalAudioEnergy > baseline + 0.00001) return true;
    }
    return false;
  }, receiver + " did not play decoded audio from " + sender);
}

async function check() {
  const { url, teacherToken, studentToken } = await (await fetch("session")).json();
  const teacher = new Room();
  const student = new Room();
  const root = createRoot(document.querySelector("main"));
  const checks = [];
  try {
    await checkPreview(root);
    checks.push("preview applies music processing, preserves a working mic on failure and releases capture on exit");
    failNextCapture = "NotReadableError";
    root.render(<>{[[teacher, "teacher", teacherToken], [student, "student", studentToken]].map(([room, name, token]) =>
      <LiveKitRoom key={name} room={room} token={token} serverUrl={url} audio={false} video={false}>
        <Peer room={room} name={name} />
      </LiveKitRoom>
    )}</>);
    await sound.resume();
    await until(() => teacher.state === "connected" && student.state === "connected", "Could not connect test participants");
    await Promise.all([teacher.startAudio(), student.startAudio()]);
    await hear(student, "student", "teacher");
    checks.push("teacher heard on join after missing saved mic fallback");
    await checkSpeaker();
    // Restore the real system output before subsequent SDK subscriptions.
    await student.switchActiveDevice("audiooutput", "");
    checks.push("call playback and speaker test request the same selected output");
    if (student.localParticipant.isMicrophoneEnabled) throw new Error("Joined-muted student transmitted audio");
    failNextCapture = "NotAllowedError";
    await controllers.get("student").toggle().catch(() => {});
    await until(() => controllers.get("student").error.includes("Allow microphone access"), "Missing permission error");
    if (student.localParticipant.isMicrophoneEnabled) throw new Error("Permission denial reported as live mic");
    await controllers.get("student").toggle();
    await hear(teacher, "teacher", "student");
    checks.push("muted join and student-to-teacher playback");
    const sid = teacher.localParticipant.getTrackPublication(Track.Source.Microphone).trackSid;
    const mic = () => controllers.get("teacher");
    await mic().selectDevice("usb");
    for (const mode of ["PLAYING", "TALKING"]) {
      await mic().selectMode(mode);
      const last = requests.at(-1);
      if (last.id !== "usb" || last.noiseSuppression !== (mode === "TALKING")) throw new Error("Wrong capture settings");
      await hear(student, "student", "teacher");
    }
    checks.push("USB input retained in both modes with incoming audio");
    const choices = getCleanDeviceList(["usb1", "usb2", "communications"].map(deviceId =>
      ({ kind: "audioinput", deviceId, label: "Microphone (AB13X USB Audio)" })), "audioinput");
    if (choices.length !== 3 || choices[1].label === choices[2].label) throw new Error("Identical USB models hidden");
    checks.push("two same-model inputs remain selectable");
    const shared = tone(880).getAudioTracks()[0];
    await teacher.localParticipant.publishTrack(shared, { source: Track.Source.ScreenShareAudio });
    await hear(student, "student", "teacher", Track.Source.ScreenShareAudio);
    const mix = sound.createMediaStreamSource(recordingStream);
    const meter = sound.createAnalyser();
    meter.fftSize = 4096;
    meter.smoothingTimeConstant = 0;
    mix.connect(meter);
    const bins = new Float32Array(meter.frequencyBinCount);
    const level = hz => bins[Math.round(hz * meter.fftSize / sound.sampleRate)];
    const readMix = () => meter.getFloatFrequencyData(bins);
    await until(() => { readMix(); return level(523) > -50 && level(880) > -50; }, "Recorder missing microphone or screen audio");
    await teacher.localParticipant.unpublishTrack(shared);
    shared.stop();
    await until(() => { readMix(); return level(523) > -50 && level(880) < -60; }, "Stopping share silenced the recorded microphone");
    mix.disconnect();
    checks.push("recording contains microphone and shared audio, and retains microphone after share ends");
    rotate();
    await until(() => segments.length === 1, "Recorder did not finalize its first segment");
    let rejected = false;
    try { await mic().selectDevice("missing"); } catch { rejected = true; }
    if (!rejected) throw new Error("Missing input was incorrectly accepted");
    await hear(student, "student", "teacher");
    checks.push("failed switch restored previous working input");
    await mic().toggle();
    const count = requests.length;
    await mic().selectMode("PLAYING");
    await mic().selectDevice("");
    if (teacher.localParticipant.isMicrophoneEnabled || requests.length !== count) throw new Error("Muted switch opened mic");
    await mic().toggle();
    await hear(student, "student", "teacher");
    if (teacher.localParticipant.getTrackPublication(Track.Source.Microphone).trackSid !== sid) throw new Error("Lost publication");
    checks.push("muted changes applied on unmute with stable publication");
    await mic().selectDevice("usb");
    const input = teacher.localParticipant.getTrackPublication(Track.Source.Microphone).audioTrack.mediaStreamTrack;
    input.stop();
    input.dispatchEvent(new Event("ended"));
    await until(() => mic().settings.deviceId === "" && requests.at(-1)?.noiseSuppression === false, "USB removal lost music mode");
    await hear(student, "student", "teacher");
    checks.push("USB disconnect recovered on default input in music mode");
    const resumed = new Promise(resolve => student.once(RoomEvent.Reconnected, resolve));
    await student.simulateScenario("full-reconnect");
    await resumed;
    await hear(student, "student", "teacher");
    await hear(teacher, "teacher", "student");
    checks.push("both directions after a full student reconnect");
    await recorder.stopAndUpload();
    if (segments.length !== 2) throw new Error("Final recording segment missing");
    for (const segment of segments) {
      const decoded = await sound.decodeAudioData(await segment.arrayBuffer());
      if (!decoded.getChannelData(0).some(sample => Math.abs(sample) > 0.01)) throw new Error("Silent recording segment");
    }
    checks.push("both saved recording segments decode with audible samples across rollover and leave");
    return checks;
  } finally {
    root.unmount();
    await Promise.all([teacher.disconnect(), student.disconnect()]);
    await sound.close();
  }
}

check().then(checks => ({ checks }), error => ({ error: error.message }))
  .then(result => fetch("result", { method: "POST", body: JSON.stringify(result) }));
