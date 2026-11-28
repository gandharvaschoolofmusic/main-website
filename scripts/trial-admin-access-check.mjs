import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const state = globalThis.trialAccessCheck = {
  user: { id: "student", role: "STUDENT", timezone: "UTC" }, updates: [], bookings: [], allowed: true,
  lesson: { id: "lesson", instrument: "Piano", studentId: "student", teacherId: "teacher", startsAt: new Date(Date.now() + 86400000), durationMinutes: 60, status: "SCHEDULED", lessonSource: "TRIAL" },
};
const mocks = {
  "@/lib/auth-helpers": `export const getCurrentUser=async()=>globalThis.trialAccessCheck.user;
    export const requireLessonParticipant=async()=>{const s=globalThis.trialAccessCheck;if(!s.allowed)throw Error('Forbidden');return {lesson:s.lesson,callerRole:s.user.role==='STUDENT'?'STUDENT':'TEACHER'}};`,
  "@/lib/db": `const s=globalThis.trialAccessCheck;export const db={
    user:{findUnique:async()=>null,findFirst:async()=>null,create:async()=>({id:'new-student'}),update:async args=>{s.updates.push(args);return {}}},
    trialRequest:{findFirst:async()=>null,create:async({data})=>{s.bookings.push(data);return {id:'trial'}}},
    enrollment:{findFirst:async()=>null},studentTrialStatus:{findUnique:async()=>({lessonsUsed:0,lessonsGranted:2})}};`,
  "@/lib/password": "export const hashPassword=async()=> 'test-hash';",
  "@/lib/phone": `export const normalizePhoneNumber=x=>x; export const isValidPhoneNumber=()=>true;
    export const getPhoneLookupVariations=x=>[x];export const validateAndConsumePhoneOtp=async()=>({isValid:true});`,
  "@/actions/notifications": "export const createNotification=async()=>{};export const notifyAdmins=async()=>{};",
  "@/lib/id-generator": "export const generateNextStudentId=async()=> 'S0001';export const generateNextTrialId=async()=> 'TL00001';",
  "next/cache": "export const revalidatePath=()=>{};",
  "@/components/room/LessonRoomClient": "export function LessonRoomClient(){return null}",
};
const bundle = await build({ stdin: { contents: `export {createTrialRequestAction} from './src/actions/trial';
  export {default as LessonPage} from './src/app/lesson/[id]/page';
  export {AdminOverviewClient} from './src/app/admin/AdminOverviewClient';`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "boundaries", setup(b) {
    b.onResolve({ filter: /.*/ }, a => mocks[a.path] ? { path: a.path, namespace: "mock" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({ contents: mocks[a.path], resolveDir: process.cwd() }));
  } }],
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
const { createTrialRequestAction: book, LessonPage, AdminOverviewClient } = mod.exports;
const input = { category: "Instruments", instrument: "Piano", requestedDate: "2026-12-05", timeSlot: "10:00 AM", timezone: "America/Chicago",
  ageGroup: "Adults", studentName: "Test Student", studentEmail: "test@example.com", gender: "Female", leadSource: "Facebook" };
assert.equal((await book(input)).success, true);
assert.equal(state.updates.at(-1).data.gender, "Female");
assert.equal(state.updates.at(-1).where.id, "student");
assert.equal(state.bookings.at(-1).leadSource, "Facebook");
state.user = null;
assert.equal((await book({ ...input, studentPhone: "+15555550123", otpCode: "123456", password: "test-password", leadSource: "Google" })).success, true);
assert.equal(state.updates.at(-1).where.id, "new-student");
assert.equal(state.bookings.at(-1).leadSource, "Google");
state.user = { id: "student", role: "STUDENT", timezone: "UTC" };
const updates = state.updates.length;
assert.equal((await book({ ...input, gender: undefined, leadSource: undefined })).success, true);
assert.equal(state.updates.length, updates, "Omitted gender preserves the existing profile");
assert.equal(state.bookings.at(-1).leadSource, "Direct Web");
const count = state.bookings.length;
const oldError = console.error;
try {
  console.error = () => {};
  assert.equal((await book({ ...input, leadSource: "Unrecognized" })).success, false);
  assert.equal((await book({ ...input, gender: "Unrecognized" })).success, false);
} finally { console.error = oldError; }
assert.equal(state.bookings.length, count);

const page = async (early) => LessonPage({ params: Promise.resolve({ id: "lesson" }), searchParams: Promise.resolve({ early }) });
const isRoom = element => element.type.name === "LessonRoomClient";
assert.equal(isRoom(await page()), false, "Student early-entry rules are preserved");
state.user.role = "TEACHER";
assert.equal(isRoom(await page("true")), true);
state.user.role = "ADMIN";
for (const source of ["TRIAL", "COURSE"]) {
  state.lesson.lessonSource = source;
  const result = await page();
  assert.equal(isRoom(result), true, "Admin can enter before the scheduled opening without a query flag");
  assert.equal(result.props.lesson.isAdmin, true);
}
state.lesson.status = "CANCELLED";
assert.equal(isRoom(await page()), false);
state.lesson.status = "SCHEDULED"; state.allowed = false;
assert.equal(isRoom(await page()), false, "Participant authorization is still required");

const scheduleList = ["SCHEDULED", "JOIN_OPENS", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(status => ({ id: status, lessonId: status, status, title: "Piano", time: "12:00 IST", faculty: "Teacher", student: "Student" }));
const html = renderToStaticMarkup(createElement(AdminOverviewClient, {
  kpis: { activeStudents: 0, activeEnrollments: 0 }, todaySessionsCount: 5, scheduleList,
  funnelStages: [], collectionsBars: [], attentionItems: [], payoutReadinessPct: 0,
}));
for (const status of ["SCHEDULED", "JOIN_OPENS", "IN_PROGRESS"]) assert.ok(html.includes(`href="/lesson/${status}"`));
for (const status of ["COMPLETED", "CANCELLED"]) assert.ok(!html.includes(`href="/lesson/${status}"`));
console.log("PASS trial referral/gender persistence and validation, optional-field compatibility, admin early access for trials/courses, cancelled/unauthorized rooms, and Overview Monitor links");
