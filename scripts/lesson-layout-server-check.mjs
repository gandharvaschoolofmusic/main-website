// Tests only: real JWT encoding, mocked Egress and storage boundaries; no external requests.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { EgressClient, EgressStatus } = require("livekit-server-sdk");

const output = await build({ entryPoints: ["src/lib/livekit.ts"], bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "boundaries", setup(b) {
    b.onResolve({ filter: /recording-s3|@\/lib\/logger|@\/lib\/db/ }, a => ({ path: a.path, namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({ contents: a.path.includes("logger")
      ? "export const logger={info(){},warn(){},error(){}}"
      : a.path.endsWith("/db") ? 'export const db={lesson:{findFirst:async()=>({trackingCode:"S0005-SE004",instrument:"Keyboard",startsAt:new Date("2026-11-18T15:30:00Z"),enrollment:{course:{title:"Electronic Keyboard Foundation"}}})}};'
      : 'export const getS3UploadConfig=()=>({bucket:"test-archive",accessKey:"test",secret:"test",region:"us-east-1"}); export const recordingS3Object=()=>null;' }));
  } }],
});
const module = { exports: {} };
new Function("require", "module", "exports", output.outputFiles[0].text)(require, module, module.exports);
Object.assign(process.env, { LIVEKIT_API_KEY: "test-key", LIVEKIT_API_SECRET: "test-secret-minimum-32-characters-long", LIVEKIT_URL: "wss://test.livekit.cloud", APP_URL: "https://school.example" });
delete process.env.LIVEKIT_RECORDING_TEMPLATE_URL;
let calls = [], existing = [];
EgressClient.prototype.listEgress = async () => existing;
EgressClient.prototype.startRoomCompositeEgress = async (...args) => { calls.push(args); return { egressId: "EG_test" }; };
const api = module.exports;
assert.equal((await api.startLessonRoomEgress({ roomName: "lesson-test", lessonId: "test" })).success, true);
assert.equal(calls[0][2].customBaseUrl, "https://school.example/recording/lesson");
assert.equal(calls[0][2].layout, "lesson-split");
assert.equal(calls[0][2].audioOnly, false);
assert.equal(calls[0][2].videoOnly, false);
assert.match(calls[0][1].filepath, /^[^/]+\/S0005-SE004_Electronic_Keyboard_Foundation_2026-11-18_Recorded-\d{8}T\d{9}Z\.mp4$/);
console.log("PASS server recording uses the shared split-screen template with video and mixed audio");
process.env.LIVEKIT_RECORDING_TEMPLATE_URL = "https://preview.example/recording/lesson";
await api.startLessonRoomEgress({ roomName: "lesson-test" });
assert.notEqual(calls[0][1].filepath.split('/')[0], calls[1][1].filepath.split('/')[0], "Each recording uses a separate storage directory");
assert.equal(calls[1][2].customBaseUrl, process.env.LIVEKIT_RECORDING_TEMPLATE_URL);
existing = [{ egressId: "EG_existing", status: EgressStatus.EGRESS_ACTIVE, request: { case: "roomComposite", value: { audioOnly: false, videoOnly: false, fileOutputs: [calls[0][1]], output: {} } } }];
assert.equal((await api.startLessonRoomEgress({ roomName: "lesson-test" })).egressId, "EG_existing");
assert.equal(calls.length, 2);
console.log("PASS configurable template URL and idempotent recording startup");
const token = await api.generateLessonRoomToken({ lessonId: "test", userId: "admin", userName: "Admin", role: "TEACHER", participantRole: "ADMIN", instrument: "Piano", durationMinutes: 30 });
const claims = JSON.parse(Buffer.from(token.token.split(".")[1], "base64url"));
assert.equal(JSON.parse(claims.metadata).role, "ADMIN");
assert.equal(JSON.parse(claims.metadata).isTeacher, false);
assert.equal(claims.video.roomAdmin, true);
console.log("PASS admin has its own stage identity while retaining existing authorized room permissions");
