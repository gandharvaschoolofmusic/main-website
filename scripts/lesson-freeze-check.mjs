// Real attendance and recording code with controlled DB, clock and encoder boundaries.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

const state = globalThis.freezeCheck = { lesson: null, writes: 0, invalidations: 0 };
const mocks = {
  "@/lib/logger": "export const logger={info(){},warn(){}};",
  "next/cache": "export const revalidateTag=()=>globalThis.freezeCheck.invalidations++;",
  "@/lib/db": `const s=globalThis.freezeCheck;let tail=Promise.resolve();
    const tx={$queryRaw:async()=>[],lesson:{findUnique:async()=>structuredClone(s.lesson),
      update:async({data})=>{s.writes++;Object.assign(s.lesson,structuredClone(data));}}};
    export const db={$transaction:fn=>{const task=tail.then(()=>fn(tx));tail=task.catch(()=>{});return task;}};`,
};
const bundle = await build({
  stdin: { contents: "export * from './src/lib/attendance';export * from './src/lib/lesson-recording-segments';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "boundaries", setup(b) {
    b.onResolve({ filter: /.*/ }, a => mocks[a.path] ? { path: a.path, namespace: "mock" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({ contents: mocks[a.path], loader: "js" }));
  } }],
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
const { recordParticipantJoin, recordParticipantLeave, createLessonSegmentRecorder } = mod.exports;

state.lesson = { id: "lesson", attendanceLogs: [], teacherJoinedAt: null, teacherLeftAt: null, studentJoinedAt: null, studentLeftAt: null };
const teacher = { lessonId: "lesson", userId: "teacher", userRole: "TEACHER" };
const student = { lessonId: "lesson", userId: "student", userRole: "STUDENT" };
await Promise.all([recordParticipantJoin(teacher), recordParticipantJoin(student)]);
state.lesson.attendanceLogs.forEach(s => { s.joinedAt = new Date(Date.now() - 30 * 60_000).toISOString(); });
const initial = structuredClone(state.lesson);
const writes = state.writes, invalidations = state.invalidations;
await Promise.all(Array.from({ length: 100 }, (_, i) => recordParticipantJoin(i % 2 ? teacher : student)));
assert.deepEqual(state.lesson, initial);
assert.equal(state.writes, writes);
assert.equal(state.invalidations, invalidations);
await recordParticipantLeave(teacher);
await recordParticipantLeave(teacher);
await recordParticipantJoin(teacher);
assert.equal(state.lesson.attendanceLogs.length, 3);
assert(state.lesson.attendanceLogs[0].leftAt);
assert.equal(state.lesson.attendanceLogs[1].leftAt, null);
assert.equal(state.lesson.attendanceLogs[2].leftAt, null);
console.log("PASS 100 delayed/repeated joins preserve one visit per participant; a real exit/rejoin still creates a visit");

const flush = () => new Promise(resolve => setImmediate(resolve));
const encoders = [];
const timers = new Set();
const realInterval = globalThis.setInterval, realClear = globalThis.clearInterval;
const realRecorder = globalThis.MediaRecorder;
globalThis.setInterval = fn => { timers.add(fn); return fn; };
globalThis.clearInterval = fn => timers.delete(fn);
class Encoder extends EventTarget {
  state = "inactive";
  constructor(stream) { super(); this.stream = stream; encoders.push(this); }
  start() { this.state = "recording"; }
  data(size = 200) { this.ondataavailable({ data: new Blob([new Uint8Array(size)]) }); }
  stop() { this.state = "inactive"; this.stopRequested = true; }
  finish() { assert(this.stopRequested); this.data(); this.dispatchEvent(new Event("stop")); }
}
globalThis.MediaRecorder = Encoder;
try {
  const uploads = [], releases = [], pauses = [], errors = [];
  let currentStream = { id: "camera" }, activeUploads = 0, maxUploads = 0;
  const controller = createLessonSegmentRecorder({
    stream: () => currentStream, mimeType: "video/webm",
    onPaused: value => pauses.push(value), onError: error => errors.push(error),
    upload: async (chunks, start, end) => {
      activeUploads++; maxUploads = Math.max(maxUploads, activeUploads);
      uploads.push({ size: chunks.reduce((sum, b) => sum + b.size, 0), start, end, chunks });
      await new Promise(resolve => releases.push(resolve));
      activeUploads--;
      return { success: true };
    },
  });
  controller.start();
  encoders.at(-1).data(3_500_000);
  for (let i = 0; i < 100; i++) controller.rotate();
  assert.equal(encoders.length, 1, "do not allocate replacement while previous encoder is draining");
  encoders.at(-1).finish(); await flush();
  assert.equal(encoders.length, 2);
  assert.equal(uploads[0].size, 3_500_200, "includes final dataavailable chunk");
  for (let i = 0; i < 2; i++) {
    controller.rotate(); encoders.at(-1).finish(); await flush();
  }
  assert.equal(encoders.length, 3);
  assert.equal(controller.isCapturing, false);
  assert.equal(pauses.at(-1), true);
  assert.equal(uploads.length, 1, "one network upload at a time");
  for (let i = 0; i < 1000; i++) controller.rotate();
  assert.equal(encoders.length, 3, "backlog cannot allocate more encoders");
  currentStream = { id: "screen" };
  releases.shift()(); await flush();
  assert.equal(uploads[0].chunks.length, 0, "release saved blobs");
  assert.equal(encoders.at(-1).stream.id, "screen");
  assert.equal(pauses.at(-1), false);
  assert.equal(controller.isCapturing, true);
  const stopped = controller.stop();
  assert.equal(controller.stop(), stopped, "stop is idempotent");
  await flush();
  encoders.at(-1).finish(); await flush();
  while (releases.length) { releases.shift()(); await flush(); }
  assert.equal((await stopped).success, true);
  assert.equal(uploads.length, 4);
  assert.equal(maxUploads, 1);
  assert.equal(timers.size, 0);
  assert.equal(errors.length, 0);
  console.log("PASS encoder drain, 1,000 coalesced rotations, bounded backlog, serial uploads, recovery and final chunk preservation");

  const blocked = [], warnings = [];
  const leaving = createLessonSegmentRecorder({ stream: () => ({}), mimeType: "video/webm",
    onPaused() {}, onError: error => warnings.push(error),
    upload: () => new Promise(resolve => blocked.push(resolve)),
  });
  leaving.start();
  for (let i = 0; i < 3; i++) { leaving.rotate(); encoders.at(-1).finish(); await flush(); }
  const count = encoders.length;
  const finish = leaving.stop();
  while (blocked.length) { blocked.shift()({ success: false, error: "offline" }); await flush(); }
  assert.equal((await finish).success, false);
  assert.equal(encoders.length, count, "never restart after leaving during backlog pause");
  assert.equal(warnings.length, 3);
  assert.equal(timers.size, 0);
  console.log("PASS leaving during backlog cannot restart capture; failed uploads are reported");
} finally {
  globalThis.setInterval = realInterval;
  globalThis.clearInterval = realClear;
  globalThis.MediaRecorder = realRecorder;
  delete globalThis.freezeCheck;
}
