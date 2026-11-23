// Run: node scripts/resource-video-check.mjs
// Real action/validation code with in-memory auth, database and Storage boundaries.
import assert from "node:assert/strict";
import { build } from "esbuild";

const state = globalThis.resourceVideoTest = {
  user: { id: "teacher-a", role: "TEACHER" }, files: new Map(), rows: new Map(), shared: new Set(),
  bucketLimit: 250 * 1024 * 1024, signedReads: 0, signedWrites: 0,
};
const mocks = {
  "@/lib/auth": "export const auth=async()=>({user:globalThis.resourceVideoTest.user});",
  "@prisma/client": 'export const Role={TEACHER:"TEACHER",STUDENT:"STUDENT",ADMIN:"ADMIN"};export const ResourceCategory={OTHER:"OTHER",SHEET_MUSIC:"SHEET_MUSIC",AUDIO_LESSON:"AUDIO_LESSON",EXERCISE:"EXERCISE"};',
  "next/cache": "export const revalidatePath=()=>{};",
  "@/lib/db": `const s=globalThis.resourceVideoTest;export const db={resource:{
    upsert:async({where,create})=>{if(!s.rows.has(where.id))s.rows.set(where.id,create);return s.rows.get(where.id);},
    findFirst:async({where})=>{const row=s.rows.get(where.id);return row&&(!where.OR||where.OR.some(c=>c.teacherId===row.teacherId||(c.shares&&s.shared.has(row.id+":"+c.shares.some.studentId))))?row:null;}
  }};`,
  "@/lib/supabase-storage": `const s=globalThis.resourceVideoTest;
    export const recordingPlaybackUrl=async url=>url;
    export const getSupabaseClient=()=>({storage:{getBucket:async()=>({data:{file_size_limit:s.bucketLimit}}),from:()=>({
      createSignedUploadUrl:async(path,options)=>{if(options.upsert)throw Error("Overwrite enabled");s.signedWrites++;return {data:{signedUrl:"https://storage.example/upload/"+path}};},
      info:async path=>({data:s.files.get(path)}),
      createSignedUrl:async path=>{s.signedReads++;return {data:{signedUrl:"https://storage.example/read/"+path}};}
    })}});`,
};
const bundled = await build({
  stdin: { contents: `export * from './src/actions/resource-videos';export * from './src/lib/resource-upload-ticket';export * from './src/lib/resource-video';`, resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "esm", write: false,
  plugins: [{ name: "test-boundaries", setup(b) {
    b.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: "mock" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: mocks[args.path], loader: "js" }));
  } }],
});
const secret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "resource-video-test-only-secret";
try {
  const api = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].contents).toString("base64"));
  const input = { fileName: "Practice.MP4", size: 80 * 1024 * 1024, title: "Vocal practice", description: "Repeat each phrase", category: "EXERCISE" };
  assert.equal(api.validateResourceVideo(input.fileName, input.size), null);
  assert.equal(api.resourceVideoType("lesson.MOV"), "video/quicktime");
  assert(api.validateResourceVideo("bad.html", 10));
  assert(api.validateResourceVideo("bad.constructor", 10));
  assert(api.validateResourceVideo("empty.mp4", 0));
  assert(api.validateResourceVideo("large.mp4", 251 * 1024 * 1024));
  state.user = { id: "student-a", role: "STUDENT" };
  assert.equal((await api.prepareResourceMediaAction(input)).success, false);
  assert.equal(state.signedWrites, 0);
  state.user = { id: "teacher-a", role: "TEACHER" };
  state.bucketLimit = 50 * 1024 * 1024;
  assert.match((await api.prepareResourceMediaAction(input)).error, /50 MB/);
  state.bucketLimit = 250 * 1024 * 1024;
  const prepared = await api.prepareResourceMediaAction(input);
  assert.equal(prepared.success, true);
  const ticket = api.verifyResourceUpload(prepared.data.ticket, state.user.id);
  assert(ticket.path.startsWith("videos/teacher-a/"));
  assert.throws(() => api.verifyResourceUpload(prepared.data.ticket, "teacher-b"));
  assert.throws(() => api.verifyResourceUpload("a" + prepared.data.ticket, "teacher-a"));
  assert.throws(() => api.verifyResourceUpload(api.signResourceUpload({ ...ticket, expires: 1 }), "teacher-a"));
  assert.equal((await api.completeResourceMediaAction(prepared.data.ticket)).success, false);
  assert.equal(state.rows.size, 0);
  state.files.set(ticket.path, { size: input.size - 1, contentType: "video/mp4" });
  assert.equal((await api.completeResourceMediaAction(prepared.data.ticket)).success, false);
  state.files.set(ticket.path, { size: input.size, contentType: "text/html" });
  assert.equal((await api.completeResourceMediaAction(prepared.data.ticket)).success, false);
  state.files.set(ticket.path, { size: input.size, contentType: "video/mp4" });
  const saved = await api.completeResourceMediaAction(prepared.data.ticket);
  assert.equal(saved.success, true);
  assert.equal((await api.completeResourceMediaAction(prepared.data.ticket)).data.id, saved.data.id);
  assert.equal(state.rows.size, 1);
  assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, true);
  state.user = { id: "teacher-b", role: "TEACHER" };
  assert.equal((await api.completeResourceMediaAction(prepared.data.ticket)).success, false);
  assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, false);
  state.user = { id: "student-a", role: "STUDENT" };
  const reads = state.signedReads;
  assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, false);
  assert.equal(state.signedReads, reads);
  state.shared.add(saved.data.id + ":student-a");
  assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, true);
  state.shared.clear();
  assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, false);
  state.user = null;
  assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, false);
  for (const [extension, mime] of Object.entries({mp3:"audio/mpeg",wav:"audio/wav",m4a:"audio/mp4",ogg:"audio/ogg",aac:"audio/aac",flac:"audio/flac",opus:"audio/ogg"})) {
    assert.equal(api.resourceAudioType(`Track.${extension.toUpperCase()}`), mime);
    assert.equal(api.isResourceAudio(`track.${extension}`), true);
    assert.equal(api.validateResourceMedia(`track.${extension}`, 30 * 1024 * 1024), null);
  }
  assert(api.validateResourceMedia("bad.html", 10));
  assert(api.validateResourceMedia("empty.wav", 0));
  assert(api.validateResourceMedia("large.wav", 251 * 1024 * 1024));
  for (const [fileName, mimeType, expected] of [["lesson.MPEG", "video/mpeg", "video/mpeg"], ["lesson.mpg", "", "video/mpeg"], ["practice.mpeg", "audio/mpeg", "audio/mpeg"], ["practice.mpga", "audio/mpeg", "audio/mpeg"]]) {
    state.user = { id: "teacher-a", role: "TEACHER" };
    const prepared = await api.prepareResourceMediaAction({ ...input, fileName, mimeType });
    assert.equal(prepared.success, true, prepared.error);
    assert.equal(prepared.data.mimeType, expected);
    const ticket = api.verifyResourceUpload(prepared.data.ticket, state.user.id);
    state.files.set(ticket.path, { size: input.size, contentType: expected });
    const saved = await api.completeResourceMediaAction(prepared.data.ticket);
    assert.equal(saved.success, true);
    assert.equal(state.rows.get(saved.data.id).mimeType, expected);
    assert.equal(api.isResourceAudio(fileName, expected), expected.startsWith("audio/"));
    assert.equal(api.isResourceVideo(fileName, expected), expected.startsWith("video/"));
    state.user = { id: "student-a", role: "STUDENT" };
    assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, false);
    state.shared.add(saved.data.id + ":student-a");
    assert.equal((await api.resourcePlaybackAction(saved.data.id)).success, true);
  }
  console.log("PASS MPEG/MPG video and MPEG/MPGA audio upload, save, and sharing");
  const pdfInput = {...input, fileName:"Music Handbook.PDF", size: Math.round(5.7 * 1024 * 1024), category:"SHEET_MUSIC"};
  state.user={id:"teacher-a",role:"TEACHER"};
  assert.equal(api.validateResourceFile(pdfInput.fileName, pdfInput.size), null);
  assert(api.validateResourceFile("large.pdf", 26 * 1024 * 1024));
  assert(api.validateResourceFile("bad.html", 100));
  const pdfPrepared=await api.prepareResourceMediaAction(pdfInput);
  assert.equal(pdfPrepared.success,true,pdfPrepared.error);
  const pdfTicket=api.verifyResourceUpload(pdfPrepared.data.ticket,state.user.id);
  assert.equal(pdfTicket.mimeType,"application/pdf");
  assert(pdfTicket.path.startsWith("files/teacher-a/"));
  assert.equal((await api.completeResourceMediaAction(pdfPrepared.data.ticket)).success,false);
  state.files.set(pdfTicket.path,{size:pdfInput.size,contentType:"application/pdf"});
  const pdfSaved=await api.completeResourceMediaAction(pdfPrepared.data.ticket);
  assert.equal(pdfSaved.success,true);
  assert.equal((await api.completeResourceMediaAction(pdfPrepared.data.ticket)).data.id,pdfSaved.data.id);
  state.user={id:"student-a",role:"STUDENT"};
  assert.equal((await api.resourcePlaybackAction(pdfSaved.data.id)).success,false);
  state.shared.add(pdfSaved.data.id+":student-a");
  assert.equal((await api.resourcePlaybackAction(pdfSaved.data.id)).success,true);
  console.log("PASS 5.7 MB PDF direct upload, storage confirmation, retry, sharing and 25 MB limit");
  const audioInput={...input,fileName:"Practice.WAV",category:"AUDIO_LESSON"};
  state.user={id:"student-a",role:"STUDENT"};
  assert.equal((await api.prepareResourceMediaAction(audioInput)).success,false);
  state.user={id:"teacher-a",role:"TEACHER"};
  const audioPrepared=await api.prepareResourceMediaAction(audioInput);
  assert.equal(audioPrepared.success,true);
  const audioTicket=api.verifyResourceUpload(audioPrepared.data.ticket,state.user.id);
  assert(audioTicket.path.startsWith("audio/teacher-a/"));
  assert.equal(audioTicket.mimeType,"audio/wav");
  assert.equal((await api.completeResourceMediaAction(audioPrepared.data.ticket)).success,false);
  state.files.set(audioTicket.path,{size:audioInput.size,contentType:"audio/wav"});
  const audioSaved=await api.completeResourceMediaAction(audioPrepared.data.ticket);
  assert.equal(audioSaved.success,true);
  assert.equal(state.rows.get(audioSaved.data.id).category,"AUDIO_LESSON");
  assert.equal((await api.completeResourceMediaAction(audioPrepared.data.ticket)).data.id,audioSaved.data.id);
  state.user={id:"student-a",role:"STUDENT"};
  assert.equal((await api.resourcePlaybackAction(audioSaved.data.id)).success,false);
  state.shared.add(audioSaved.data.id+":student-a");
  assert.equal((await api.resourcePlaybackAction(audioSaved.data.id)).success,true);
  state.shared.clear();
  assert.equal((await api.resourcePlaybackAction(audioSaved.data.id)).success,false);
  console.log("PASS audio formats, direct upload, storage confirmation, and shared-student-only playback");
  console.log("PASS video formats, size limits, and bucket limit preflight");
  console.log("PASS faculty-only uploads and owner-bound, tamper-proof, expiring tickets");
  console.log("PASS no database entry for missing, incomplete, or mismatched uploads");
  console.log("PASS idempotent finalization and teacher playback");
  console.log("PASS student playback only after sharing; revoked and unauthenticated access denied");
} finally {
  if (secret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = secret;
  delete globalThis.resourceVideoTest;
}
