// Exercise the real status action with isolated database/auth boundaries.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const source = await readFile("src/actions/admin.ts", "utf8");
const action = source.slice(source.indexOf("export async function updateTrialLeadStatusAction("), source.indexOf("export async function convertTrialToEnrollmentAction("));
const state = globalThis.trialClosureTest = { allowed: true, lead: null, updates: 0 };
const compiled = await transform(`
  const s=globalThis.trialClosureTest;
  const Role={ADMIN:'ADMIN'};
  const TrialRequestStatus={PENDING:'PENDING',ALLOTTED:'ALLOTTED',CANCELLED:'CANCELLED',NOT_CONVERTED:'NOT_CONVERTED'};
  const requireRole=async()=>{if(!s.allowed)throw Error('Unauthorized');};
  const revalidatePath=()=>{};
  const logger={error:()=>{}};
  const db={trialRequest:{
    findUnique:async()=>s.lead,
    updateMany:async({where,data})=>{if(!s.lead||s.lead.id!==where.id||s.lead.isConverted!==where.isConverted)return {count:0};s.lead={...s.lead,...data};s.updates++;return {count:1};}
  }};
  ${action}
`, { loader: "ts", format: "esm" });
try {
  const { updateTrialLeadStatusAction: update } = await import("data:text/javascript;base64," + Buffer.from(compiled.code).toString("base64"));
  for (const status of ["PENDING", "ALLOTTED"]) {
    state.lead = { id: "trial", status, isConverted: false, allottedLessonId: "lesson", studentId: "student", followUpAt: new Date(), studentNotes: "original" };
    assert.equal((await update({ trialRequestId: "trial", status: "NOT_CONVERTED", studentNotes: "retained history" })).success, true);
    assert.equal(state.lead.status, "NOT_CONVERTED");
    assert.equal(state.lead.followUpAt, null);
    assert.equal(state.lead.allottedLessonId, "lesson");
    assert.equal(state.lead.studentNotes, "retained history");
    const writes = state.updates;
    assert.equal((await update({ trialRequestId: "trial", status: "NOT_CONVERTED" })).success, true);
    assert.equal(state.updates, writes);
    assert.equal((await update({ trialRequestId: "trial", status: "PENDING" })).success, false);
    assert.equal((await update({ trialRequestId: "trial", followUpAt: new Date().toISOString() })).success, false);
  }
  state.lead = { id: "trial", status: "ALLOTTED", isConverted: true };
  assert.equal((await update({ trialRequestId: "trial", status: "NOT_CONVERTED" })).success, false);
  assert.equal(state.lead.isConverted, true);
  state.allowed = false;
  assert.equal((await update({ trialRequestId: "trial", status: "NOT_CONVERTED" })).success, false);
  console.log("PASS closing pending and allotted leads persists status, clears reminders, and preserves lesson/account data");
  console.log("PASS retries are idempotent; closed bookings reject edits and follow-ups");
  console.log("PASS enrolled students and unauthorized callers cannot close a lead");
} finally { delete globalThis.trialClosureTest; }
