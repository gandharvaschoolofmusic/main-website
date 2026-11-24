import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Room } from "livekit-client";
import { useLessonAutoRecorder } from "../src/hooks/useLessonAutoRecorder";

const checks = [];
const check = (condition, description) => { if (!condition) throw Error(description); checks.push(description); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, description) {
  for (let i = 0; i < 100; i++) { if (test()) return; await wait(50); }
  throw Error(description);
}
const room = new Room();
const instances = [];
const uploads = [];
const pending = [];
let activeUploads = 0, maxUploads = 0, controller, rotate;
const nativeRecorder = window.MediaRecorder;
window.MediaRecorder = class extends nativeRecorder {
  constructor(stream, options) { super(stream, options); this.input = stream; this.bytes = 0; this.addEventListener("dataavailable", event => { this.bytes += event.data.size; }); instances.push(this); }
};
const nativeInterval = window.setInterval.bind(window);
window.setInterval = (fn, period, ...args) => {
  if (period === 240000) rotate = fn;
  return nativeInterval(fn, period, ...args);
};
window.fetch = async (url, options) => {
  if (url !== "/api/lessons/freeze-test/recording") throw Error("Unexpected network request");
  activeUploads++; maxUploads = Math.max(maxUploads, activeUploads);
  uploads.push(options.body);
  await new Promise(resolve => pending.push(resolve));
  activeUploads--;
  return Response.json({ success: true });
};
function Probe() {
  const recorder = useLessonAutoRecorder({ room, lessonId: "freeze-test", isTeacher: true, enabled: true, partnerName: "Test", instrument: "Voice" });
  const [clicks, setClicks] = useState(0);
  useEffect(() => { controller = recorder; }, [recorder]);
  return <><button onClick={() => setClicks(c => c + 1)}>Responsive {clicks}</button><p role="status">{recorder.recordingWarning}</p></>;
}
const root = createRoot(document.querySelector("main"));
async function run() {
  // SDK-generated synthetic video; no camera/microphone permissions or real calls.
  await room.simulateParticipants({ participants: { count: 0 }, publish: { video: true, audio: true, useRealTracks: false } });
  root.render(<Probe />);
  await until(() => controller?.isRecording && instances[0]?.state === "recording", "Recording did not start");
  const camera = [...room.localParticipant.videoTrackPublications.values()][0].videoTrack;
  check(instances[0].input.getVideoTracks().length === 1 && instances[0].input.getAudioTracks().length === 1, "browser fallback records composite video and mixed audio");
  for (let i = 0; i < 3; i++) {
    await wait(i === 0 ? 1500 : 450);
    rotate();
    if (i < 2) await until(() => instances.length === i + 2, "Segment did not rotate");
  }
  await until(() => controller.recordingWarning.includes("paused"), "Missing recording backlog notice");
  for (let i = 0; i < 100; i++) rotate();
  await wait(100);
  check(instances.length === 3 && activeUploads === 1, "real MediaRecorder backlog stops at three segments and one upload");
  document.querySelector("button").click(); await wait(50);
  check(document.body.textContent.includes("Responsive 1") && camera.mediaStreamTrack.readyState === "live", "lesson controls and live camera continue while recording is paused");
  pending.shift()();
  await until(() => instances.length === 4 && !controller.recordingWarning, "Recording did not resume after upload");
  check(instances.at(-1).state === "recording", "recording resumes when upload capacity returns");
  await wait(450);
  let finished = false;
  const saved = controller.stopAndUpload().then(result => { finished = true; return result; });
  for (let i = 0; i < 100 && !finished; i++) {
    pending.shift()?.(); await wait(50);
  }
  check(finished && (await saved).success && uploads.length === 4 && maxUploads === 1, "leaving saves every completed segment exactly once");
  for (const form of uploads) {
    check(form.get("file").size > 100 && Number(form.get("durationSeconds")) >= 1, "saved segment has media bytes and capture duration");
  }
  check(camera.mediaStreamTrack.readyState === "live", "stopping recorder does not stop the lesson camera");
  root.unmount();
  await wait(100);
  check(!document.querySelector("video") && instances.every(item => item.state === "inactive"), "recorder cleanup releases hidden videos and encoders");
  await room.disconnect();
  return checks;
}
run().then(checks => window.videoTestResult = { checks }).catch(error => window.videoTestResult = { error: error.stack + "\n" + JSON.stringify({ uploads: uploads.length, warning: controller?.recordingWarning, encoders: instances.map(item => ({ state: item.state, bytes: item.bytes })) }) });
