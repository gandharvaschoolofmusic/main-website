import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

const state = globalThis.prejoinCheck = {
  user: { id: "admin" }, allowed: true, status: "SCHEDULED", groupRoomId: null,
  participants: [], calls: [], error: null,
};
const mocks = {
  "@/lib/auth": "export const auth=async()=>({user:globalThis.prejoinCheck.user});",
  "@/lib/auth-helpers": `import {ForbiddenError} from '@/lib/errors';
    export const requireLessonParticipant=async(id)=>{
      const s=globalThis.prejoinCheck;
      if(!s.allowed) throw new ForbiddenError('Forbidden');
      return {lesson:{id,status:s.status,groupRoomId:s.groupRoomId}};
    };`,
  "@/lib/livekit": "export const getLiveKitHttpUrl=()=> 'https://room.example';",
  "livekit-server-sdk": `export const ParticipantInfo_State={ACTIVE:2};
    export class ServerError extends Error {constructor(code){super(code);this.code=code}}
    export class RoomServiceClient {async listParticipants(room){
      const s=globalThis.prejoinCheck;s.calls.push(room);
      if(s.error) throw new ServerError(s.error);return s.participants;
    }}`,
};
const bundle = await build({
  stdin: { contents: `export * from './src/lib/lesson-prejoin';
    export * from './src/lib/timezone';
    export {GET} from './src/app/api/lessons/[id]/participants/route';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "boundaries", setup(b) {
    b.onResolve({ filter: /.*/ }, a => mocks[a.path] ? { path: a.path, namespace: "mock" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({ contents: mocks[a.path], resolveDir: process.cwd() }));
  } }],
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
const { needsInstrumentHeadphones, formatProfileLocation, formatTimezoneLabel, GET } = mod.exports;
for (const audioMode of ["TALKING", "PLAYING"]) {
  for (const isAudioMuted of [true, false]) {
    for (const companion of [true, false]) {
      for (const headphonesAcknowledged of [true, false]) {
        const blocked = needsInstrumentHeadphones({ audioMode, isAudioMuted, companion, headphonesAcknowledged });
        if (isAudioMuted || companion || audioMode === "TALKING" || headphonesAcknowledged) assert.equal(blocked, false);
        else assert.equal(blocked, true);
      }
    }
  }
}
for (const [country, timezone, expected] of [
  [null, "America/Chicago", "United States · Chicago"],
  ["United States", "US/Central", "United States · Chicago"],
  [null, "Europe/London", "United Kingdom · London"],
  ["Canada", "America/Toronto", "Canada · Toronto"],
  [null, "Australia/Sydney", "Australia · Sydney"],
  ["India", "Asia/Calcutta", "India · Kolkata"],
  ["Singapore", "Asia/Singapore", "Singapore"],
  [null, "UTC", "Not provided"],
  ["Canada", "not-a-zone", "Canada"],
]) assert.equal(formatProfileLocation(country, timezone), expected);
assert.match(formatTimezoneLabel("US/Central", "2026-11-26"), /United States · Chicago/);

const get = () => GET(new Request("https://school.example/api/lessons/lesson/participants"), { params: Promise.resolve({ id: "lesson" }) });
state.user = null;
assert.equal((await get()).status, 401);
state.user = { id: "outsider" }; state.allowed = false;
assert.equal((await get()).status, 403);
assert.equal(state.calls.length, 0, "Unauthorized requests cannot inspect LiveKit rooms");
state.allowed = true;
state.participants = [
  { identity: "teacher", name: "Teacher Name", kind: 0, state: 2 },
  { identity: "teacher:companion:one", name: "Teacher Name · Second device", kind: 0, state: 2 },
  { identity: "student", name: "Student Name", kind: 0, state: 2 },
  { identity: "joining", name: "Not connected", kind: 0, state: 0 },
  { identity: "gone", name: "Disconnected", kind: 0, state: 3 },
  { identity: "recorder", name: "Recorder", kind: 2, state: 2 },
  { identity: "hidden", name: "Hidden", kind: 0, state: 2, permission: { hidden: true } },
];
let response = await get();
assert.deepEqual(await response.json(), { names: ["Teacher Name", "Student Name"] });
assert.equal(response.headers.get("cache-control"), "private, no-store");
assert.equal(state.calls.at(-1), "lesson-lesson");
state.groupRoomId = "shared-course-room";
await get(); assert.equal(state.calls.at(-1), "shared-course-room");
state.error = "not_found";
assert.deepEqual(await (await get()).json(), { names: [] });
state.error = "unavailable";
assert.equal((await get()).status, 503);
state.status = "CANCELLED";
assert.deepEqual(await (await get()).json(), { names: [] });
console.log("PASS muted/companion joining, headphone gating, country/city aliases, participant authorization, live names, hidden recorders, group rooms and unavailable rooms");
