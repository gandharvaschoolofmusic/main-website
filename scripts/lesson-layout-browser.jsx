import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Room, RoomEvent, Track, LocalVideoTrack, LocalTrackPublication, RemoteVideoTrack, RemoteTrackPublication } from "livekit-client";
import { TrackInfo, TrackSource, TrackType } from "@livekit/protocol";
import { RoomContext } from "@livekit/components-react";
import { LessonStage } from "../src/components/room/LessonStage";
import { LessonRecordingTemplate } from "../src/components/room/LessonRecordingTemplate";
import { useLessonAutoRecorder } from "../src/hooks/useLessonAutoRecorder";

const checks = [], uploads = [], encoders = [];
const check = (value, message) => { if (!value) throw Error(message); checks.push(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message) {
  for (let i = 0; i < 100; i++) { if (test()) return; await wait(50); }
  throw Error(message);
}
const room = new Room({ adaptiveStream: false });
let controller;
const nativeRecorder = window.MediaRecorder;
window.MediaRecorder = class extends nativeRecorder {
  constructor(stream, options) { super(stream, options); this.input = stream; encoders.push(this); }
};
window.fetch = async (url, options) => {
  if (url !== "/api/lessons/layout-test/recording") throw Error("Unexpected request");
  uploads.push(options.body.get("file"));
  return Response.json({ success: true });
};
function Probe() {
  const recorder = useLessonAutoRecorder({ room, lessonId: "layout-test", isTeacher: true, enabled: true, partnerName: "Student", instrument: "Piano" });
  useEffect(() => { controller = recorder; }, [recorder]);
  return <RoomContext.Provider value={room}><LessonStage /></RoomContext.Provider>;
}
const root = createRoot(document.querySelector("main"));
const sources = [];
function publication(participant, sid, color, source = Track.Source.Camera) {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext("2d");
  const paint = () => { ctx.fillStyle = color; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = "white"; ctx.font = "32px Arial"; ctx.fillText(sid, 40, 70); };
  paint(); const timer = setInterval(paint, 50);
  const media = canvas.captureStream(20).getVideoTracks()[0]; sources.push({ timer, media });
  const info = new TrackInfo({ sid, name: sid, type: TrackType.VIDEO, source: source === Track.Source.Camera ? TrackSource.CAMERA : TrackSource.SCREEN_SHARE });
  const track = participant.isLocal ? new LocalVideoTrack(media) : new RemoteVideoTrack(media, sid, undefined);
  track.source = source;
  const pub = participant.isLocal ? new LocalTrackPublication(Track.Kind.Video, info, track) : new RemoteTrackPublication(Track.Kind.Video, info, true);
  if (!participant.isLocal) pub.setTrack(track);
  participant.addTrackPublication(pub);
  room.emit(participant.isLocal ? RoomEvent.LocalTrackPublished : RoomEvent.TrackSubscribed, ...(participant.isLocal ? [pub] : [track, pub, participant]));
  return pub;
}
const cells = () => [...document.querySelectorAll(".lesson-stage-cell")];
const geometry = () => cells().map(cell => ({ id: cell.dataset.participant, source: cell.dataset.source, left: cell.style.left, top: cell.style.top, width: cell.style.width, height: cell.style.height }));
async function frame(video) {
  await until(() => video.readyState >= 2 && video.videoWidth, "No decoded recording frame");
  const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d"); ctx.drawImage(video, 0, 0);
  return (x, y) => [...ctx.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data];
}
const isRed = p => p[0] > 150 && p[1] < 80 && p[2] < 80;
const isGreen = p => p[1] > 100 && p[0] < 80 && p[2] < 80;
const isBlue = p => p[2] > 150 && p[0] < 80 && p[1] < 80;
const isYellow = p => p[0] > 150 && p[1] > 150 && p[2] < 80;

async function testTemplate() {
  const originalLog = console.log;
  const signals = [];
  let recorderRoom, connection;
  console.log = (...args) => { if (["START_RECORDING", "END_RECORDING"].includes(args[0])) signals.push(args[0]); else originalLog(...args); };
  window.configureRecordingRoom = room => { room.connect = async function(url, token, options) {
    recorderRoom = this; connection = { url, token, options };
    await this.simulateParticipants({ participants: { count: 3, video: false }, publish: { video: false, audio: false } });
    const [teacher, student] = [...this.remoteParticipants.values()];
    teacher.name = "Teacher"; teacher.metadata = '{"role":"TEACHER"}';
    student.name = "Student"; student.metadata = '{"role":"STUDENT"}';
  }; };
  history.replaceState(null, "", "?url=wss%3A%2F%2Frecording.example&token=test-only");
  try {
    root.render(<LessonRecordingTemplate />);
    await until(() => signals.includes("START_RECORDING"), "Server template did not signal capture readiness");
    check(connection.url === "wss://recording.example" && connection.token === "test-only" && connection.options.autoSubscribe, "server template connects using supplied Egress credentials and subscribes to all feeds");
    check(cells().length === 2 && cells().every(cell => cell.dataset.participant !== recorderRoom.localParticipant.identity), "hidden recorder is excluded; camera-off teacher/student remain visible");
    recorderRoom.emit(RoomEvent.Reconnected);
    await wait(150);
    check(signals.length === 1, "reconnection does not restart the recording capture protocol");
    recorderRoom.emit(RoomEvent.Disconnected);
    await wait(50);
    check(signals.join(",") === "START_RECORDING,END_RECORDING", "server template signals capture end on disconnection");
    root.render(null); await wait(50);
    check(signals.length === 2, "server template cleanup does not send duplicate end signals");
  } finally {
    delete window.configureRecordingRoom; console.log = originalLog;
    history.replaceState(null, "", "/");
  }
}

async function run() {
  if (!window.layoutPreviewOnly) await testTemplate();
  await room.simulateParticipants({ participants: { count: 3, video: false }, publish: { video: false, audio: true, useRealTracks: false } });
  const teacher = room.localParticipant;
  const [student, admin] = [...room.remoteParticipants.values()];
  for (const [person, role] of [[teacher, "TEACHER"], [student, "STUDENT"], [admin, "ADMIN"]]) { person.name = role[0] + role.slice(1).toLowerCase(); person.metadata = JSON.stringify({ role }); }
  room.remoteParticipants.delete(admin.identity);
  const teacherCam = publication(teacher, "Teacher camera", "#df2020");
  publication(student, "Student camera", "#20c020");
  if (window.layoutPreviewOnly) {
    publication(teacher, "Shared lesson sheet", "#dfdf20", Track.Source.ScreenShare);
    root.render(<Probe />);
    return checks;
  }
  root.render(<Probe />);
  await until(() => controller?.isRecording && cells().length === 2, "Two-person layout did not start");
  check(cells().every(cell => cell.style.width === "50%" && cell.style.height === "100%"), "teacher/student occupy two equal full-height columns");
  const initial = JSON.stringify(geometry());
  for (let i = 0; i < 30; i++) room.emit(RoomEvent.ActiveSpeakersChanged, [i % 2 ? teacher : student]);
  await wait(100);
  check(JSON.stringify(geometry()) === initial, "speaker changes never reorder, hide, or spotlight participants");

  const output = document.createElement("video"); output.muted = true; output.srcObject = encoders[0].input; await output.play(); await wait(300);
  let pixels = await frame(output);
  check(isRed(pixels(.25, .5)) && isGreen(pixels(.75, .5)), "browser recording contains both camera feeds in their visible positions");
  room.remoteParticipants.set(admin.identity, admin); publication(admin, "Admin camera", "#2020df"); room.emit(RoomEvent.ParticipantConnected, admin);
  await until(() => cells().length === 3, "Admin not shown");
  check(cells().every(cell => Math.abs(parseFloat(cell.style.width) - 100 / 3) < .01 && cell.style.height === "100%"), "admin joins as third equal column");
  await wait(250); pixels = await frame(output);
  check(isRed(pixels(1 / 6, .5)) && isGreen(pixels(.5, .5)) && isBlue(pixels(5 / 6, .5)), "recorded three-person view matches live teacher/student/admin order");

  const share = publication(teacher, "Shared lesson sheet", "#dfdf20", Track.Source.ScreenShare);
  await until(() => cells().length === 4, "Share did not appear");
  check(cells()[0].style.width === "72%" && cells().slice(1).every(cell => parseFloat(cell.style.left) === 72), "screen share receives largest section with all three cameras beside it");
  await wait(350); pixels = await frame(output);
  check(isYellow(pixels(.36, .5)) && isRed(pixels(.86, 1 / 6)) && isGreen(pixels(.86, .5)) && isBlue(pixels(.86, 5 / 6)), "recording retains screen share and every participant simultaneously");
  check(encoders.length === 1, "screen sharing does not rotate or replace the active encoder");

  teacherCam.track.isMuted = true; room.emit(RoomEvent.TrackMuted, teacherCam, teacher);
  await until(() => cells()[1]?.querySelector(".lesson-stage-placeholder"), "Camera-off placeholder missing");
  check(cells().length === 4 && cells()[1].style.left === "72%", "muting a camera keeps its labeled position");
  teacherCam.track.isMuted = false; room.emit(RoomEvent.TrackUnmuted, teacherCam, teacher);
  room.remoteParticipants.delete(admin.identity); room.emit(RoomEvent.ParticipantDisconnected, admin);
  await until(() => cells().length === 3, "Admin did not leave");
  check(cells()[1].style.height === "50%" && cells()[2].style.height === "50%", "screen share with teacher/student has three nonoverlapping sections");
  await wait(1200);
  check((await controller.stopAndUpload()).success && uploads.length === 1, "composite recording saves one valid media segment");
  const encoded = document.createElement("video"); encoded.muted = true; encoded.src = URL.createObjectURL(uploads[0]);
  await encoded.play();
  await until(() => Number.isFinite(encoded.duration) && encoded.duration > 0 || encoded.readyState >= 2, "Encoded recording cannot play");
  // WebM may report Infinity until seeked; a far seek resolves its actual duration.
  encoded.currentTime = 1e6;
  await new Promise(resolve => encoded.addEventListener("seeked", resolve, { once: true }));
  pixels = await frame(encoded);
  check(isYellow(pixels(.36, .5)) && isRed(pixels(.86, .25)) && isGreen(pixels(.86, .75)), "saved recording decodes with shared screen and both cameras visible");
  encoded.pause(); URL.revokeObjectURL(encoded.src);

  teacher.trackPublications.delete(share.trackSid); teacher.videoTrackPublications.delete(share.trackSid); room.emit(RoomEvent.LocalTrackUnpublished, share);
  await until(() => cells().length === 2, "Share did not disappear");
  check(cells().every(cell => cell.style.width === "50%"), "stopping share restores equal columns automatically");
  check([...document.querySelectorAll(".lesson-stage-video")].every(video => getComputedStyle(video).objectFit === "contain"), "video and presentation aspect ratios are preserved without cropping");
  // Leave a representative sharing view for responsive screenshots.
  teacher.addTrackPublication(share); room.emit(RoomEvent.LocalTrackPublished, share);
  output.pause(); output.srcObject = null;
  await wait(200);
  return checks;
}
run().then(checks => window.videoTestResult = { checks }).catch(error => window.videoTestResult = { error: error.stack });
