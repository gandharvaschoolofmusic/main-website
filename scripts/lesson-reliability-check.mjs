// Real actions, routes, image decoding and retry code; auth/DB/storage are controlled boundaries.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const s = globalThis.lessonReliability = {
  user: { id: "teacher", role: "TEACHER", name: "Teacher" }, images: new Map(), objects: new Map(), logs: [],
  storageFailure: false, dbFailure: false, invalidations: 0,
};
const lesson = { id: "lesson-a", teacherId: "teacher", studentId: "student", teacherProfile: {},
  startsAt: new Date(), groupRoomId: null, teacherJoinedAt: new Date(), studentJoinedAt: new Date() };
s.lesson = lesson;
const mocks = {
  "@/lib/recording-s3": "export const projectStorageS3Object=()=>null;",
  "@/lib/auth": "export const auth=async()=>({user:globalThis.lessonReliability.user});",
  "@/lib/auth-helpers": "export const requireUser=async()=>{const u=globalThis.lessonReliability.user;if(!u)throw Error('Unauthorized');return u;};",
  "@/lib/password": "export const hashPassword=()=>{};export const verifyPassword=()=>{};",
  "@/lib/email": "export const sendEmailUpdateVerificationEmail=()=>{};export const sendNewChatMessageEmail=async()=>{};",
  "@/lib/logger": "export const logger={info:()=>{},error:()=>{},warn:()=>{}};",
  "@/lib/attendance": "export const parseAttendanceLogs=()=>({});",
  "@/lib/lesson-tracking": "export const getLessonTrackingId=()=>'';",
  "@/types": "export const JOIN_WINDOW_MINUTES_AFTER=15;",
  "next/cache": "export const revalidatePath=()=>{};export const revalidateTag=()=>{globalThis.lessonReliability.invalidations++};",
  "@/lib/db": `const s=globalThis.lessonReliability;export const db={user:{
    findUnique:async({where})=>({image:s.images.get(where.id)||null}),
    update:async({where,data})=>{if(s.dbFailure)throw Error('DB failed');s.images.set(where.id,data.image);}
  },lesson:{findUnique:async()=>({...s.lesson,chatLogs:[...s.logs]})},
  $executeRaw:async(strings,...values)=>{
    if(s.dbFailure)throw Error('DB failed');
    if(!strings.join('').includes('UPDATE "Lesson"')||!strings.join('').includes('::jsonb'))throw Error('Non-atomic write');
    const entry=JSON.parse(values[0])[0];
    if(s.logs.some(x=>x.id===entry.id&&x.senderId===entry.senderId))return 0;
    s.logs.push(entry);return 1;
  }};`,
  "@/lib/supabase-storage": `const s=globalThis.lessonReliability;export const getSupabaseClient=()=>({storage:{from:bucket=>({
    upload:async(path,buffer,options)=>{if(s.storageFailure)return {error:{message:'offline'}};s.objects.set(path,{buffer,options});return {data:{path}};},
    remove:async paths=>{paths.forEach(p=>s.objects.delete(p));return {};},
    createSignedUrl:async path=>s.objects.has(path)?{data:{signedUrl:'https://storage.example/'+path}}:{error:{message:'missing'}}
  })}});`,
};
const bundle = await build({ stdin: { contents: `export * from './src/actions/profile';export {POST as chatPost,GET as chatGet} from './src/app/api/lessons/[id]/chat/route';export {GET as avatarGet} from './src/app/api/avatars/[id]/route';export * from './src/lib/archive-lesson-chat';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "boundaries", setup(b) {
    b.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: "mock" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: mocks[args.path], loader: "js" }));
  } }],
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, mod, mod.exports);
const api = mod.exports;
const jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#784096" } }).jpeg().toBuffer();
const form = (data=jpeg,type="image/jpeg") => { const f=new FormData();f.set("file",new Blob([data],{type}),"photo.jpg");return f; };
for (const role of ["TEACHER", "STUDENT"]) {
  s.user = { id: role.toLowerCase(), role };
  const upload = await api.uploadAvatarAction(form());
  assert.equal(upload.success,true); assert.match(upload.image,/^\/api\/avatars\//);
  const object = [...s.objects.values()].at(-1);
  const meta = await sharp(object.buffer).metadata();assert.equal(meta.format,"webp");assert(meta.width<=512);
  const req = { nextUrl: new URL(upload.image,"https://example.org") };
  const response=await api.avatarGet(req,{params:Promise.resolve({id:s.user.id})});assert.equal(response.status,307);
  const old=upload.image;
  s.storageFailure=true;assert.equal((await api.uploadAvatarAction(form())).success,false);assert.equal(s.images.get(s.user.id),old);s.storageFailure=false;
  const objects=s.objects.size;s.dbFailure=true;assert.equal((await api.uploadAvatarAction(form())).success,false);assert.equal(s.objects.size,objects);s.dbFailure=false;
  assert.equal((await api.uploadAvatarAction(form(Buffer.from('<script/>')))).success,false);
  assert.equal((await api.uploadAvatarAction(form(Buffer.alloc(750001)))).success,false);
  assert.equal((await api.removeAvatarAction()).success,true);assert.equal(s.images.get(s.user.id),null);
  assert.equal((await api.avatarGet(req,{params:Promise.resolve({id:s.user.id})})).status,404);
}
console.log("PASS teacher/student avatars: decode, resize, storage, rollback, removal and invalid files");
const params={params:Promise.resolve({id:lesson.id})};
const post=body=>api.chatPost(new Request('https://example.org/chat',{method:'POST',body:JSON.stringify(body)}),params);
s.user=null;assert.equal((await post({message:'hello'})).status,401);
s.user={id:'outsider',role:'STUDENT'};assert.equal((await post({message:'hello'})).status,403);
s.user={id:'teacher',role:'TEACHER',name:'Real teacher'};
assert.equal((await post({message:' '})).status,400);
assert.equal((await post({message:'hello',messageId:'<invalid>'})).status,400);
await Promise.all(Array.from({length:20},(_,i)=>post({message:'message '+i,messageId:'id-'+i,senderName:'Forged',timestamp:'2000-01-01'})));
assert.equal(s.logs.length,20);assert.equal(s.logs[0].senderName,'Real teacher');assert(s.logs[0].timestamp.startsWith(String(new Date().getFullYear())));
await post({message:'message 0',messageId:'id-0'});assert.equal(s.logs.length,20);assert.equal(s.invalidations,20);
const logs=await (await api.chatGet({nextUrl:new URL('https://example.org/chat')},params)).json();assert.equal(logs.chatLogs.length,20);
console.log("PASS chat authorization, server identity/time, atomic append, deduplication and archive GET");
const realFetch=globalThis.fetch;
let calls=[];
try {
  globalThis.fetch=async(_url,opts)=>{calls.push(JSON.parse(opts.body));if(calls.length===1)throw Error('lost response');return new Response(null,{status:200});};
  await api.archiveLessonChat('lesson-a','hello','retry-id');assert.equal(calls.length,2);assert.equal(calls[0].messageId,calls[1].messageId);
  calls=[];globalThis.fetch=async()=>{calls.push(1);return Response.json({error:'Forbidden'},{status:403});};
  await assert.rejects(()=>api.archiveLessonChat('lesson-a','hello','bad'),/Forbidden/);assert.equal(calls.length,1);
  globalThis.fetch=async()=>new Response(null,{status:503});
  await assert.rejects(()=>api.archiveLessonChat('lesson-a','hello','retry-id'),/could not be saved/);
} finally {globalThis.fetch=realFetch;delete globalThis.lessonReliability;}
console.log("PASS retry after lost response, no permission retries, visible error after exhausted retries");
