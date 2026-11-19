// Exercise the real signup schema and action without sending OTPs or creating accounts.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const source = await readFile("src/actions/auth.ts", "utf8");
const start = source.indexOf("export async function signupAction(");
const end = source.indexOf("export async function sendPhoneOtpAction(", start);
const action = source.slice(start, source.lastIndexOf("/**", end));
const state = globalThis.teacherSignupCheck = { writes: [], otpValid: false };
try {
  const result = await build({
    stdin: { contents: `
      import { SignupSchema } from './src/schemas/auth';
      export { SignupSchema };
      const s = globalThis.teacherSignupCheck;
      const db = { user: { findUnique: async()=>null, findFirst: async()=>null },
        $transaction: async fn => fn({
          user: { create: async ({data}) => { s.writes.push(data); return {...data,id:'teacher-test'}; } },
          teacherProfile: { create: async ({data}) => { s.writes.push(data); } }
        }) };
      const normalizePhoneNumber = phone=>phone;
      const isValidPhoneNumber = ()=>true;
      const getPhoneLookupVariations = phone=>[phone];
      const AuthRateLimits = {checkSignup:()=>{}};
      const validateAndConsumePhoneOtp = async()=>({isValid:s.otpValid});
      const hashPassword = async()=> 'test-hash';
      const generateNextTeacherId = async()=> 'T-TEST';
      const createEmailVerificationToken = async()=> 'test-token';
      const sendVerificationEmail = async()=> ({});
      const logger = {info:()=>{},error:()=>{}};
      const notifyAdmins = async()=>{};
      const createNotification = async()=>{};
      const NotificationType = {NEW_TEACHER_SIGNUP:'NEW_TEACHER_SIGNUP',SYSTEM:'SYSTEM'};
      const revalidatePath = ()=>{};
      const revalidateTag = ()=>{};
      const isAppError = ()=>false;
      ${action}
    `, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm",
  });
  const { SignupSchema, signupAction } = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64"));
  const valid = { name: "Test Teacher", email: "teacher@example.test", phone: "+919876543210", otpCode: "123456", password: "TestOnly123", role: "TEACHER", timezone: "Asia/Kolkata", instruments: '["Vocals"]', experience: "3" };
  const submit = values => signupAction(null, Object.entries(values).reduce((form, [key,value]) => { if (value !== undefined) form.set(key,value); return form; }, new FormData()));
  for (const role of ["STUDENT", "ADMIN", "teacher", "", undefined]) {
    assert.equal(SignupSchema.safeParse({...valid,role}).success, false);
    const response = await submit({...valid,role});
    assert.equal(response.success, false);
    assert.match(response.error, /only to teachers/);
  }
  assert.equal(state.writes.length, 0);
  assert.equal((await submit({...valid,instruments:'[]'})).success, false);
  assert.equal((await submit({...valid,experience:'-1'})).success, false);
  assert.equal((await submit(valid)).success, false, "Phone verification remains required");
  assert.equal(state.writes.length, 0);
  state.otpValid = true;
  const response = await submit(valid);
  assert.equal(response.success, true);
  assert.equal(response.data.role, "TEACHER");
  assert.equal(state.writes.length, 2);
  assert.equal(state.writes[0].role, "TEACHER");
  assert.equal(state.writes[1].approvalStatus, "PENDING");
  assert.deepEqual(state.writes[1].instruments, ["Vocals"]);
  console.log("PASS student, admin, missing, and tampered roles cannot register");
  console.log("PASS teacher credentials and phone verification remain required");
  console.log("PASS verified teacher signup creates a profile pending admin approval");
} finally {
  delete globalThis.teacherSignupCheck;
}
