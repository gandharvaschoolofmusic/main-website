import assert from 'node:assert/strict';
import { build } from 'esbuild';
const state = globalThis.admissionTest = { prior: true, converted: false, enrolled: false, requests: [], tags: [], paths: [], failNotifications: false };
const mocks = {
  '@/lib/auth-helpers': 'export const requireRole=async()=>({id:"student-a",name:"Student",email:"student@example.test"});',
  '@/lib/db': `const s=globalThis.admissionTest;export const db={
    course:{findUnique:async()=>({id:'course-b',slug:'course-b',title:'Second course',isPublished:true})},
    trialRequest:{findFirst:async()=>s.converted?{id:'trial'}:null},
    enrollment:{findFirst:async({where})=>where.courseId?(s.enrolled?{id:'existing'}:null):(s.prior?{id:'first-course'}:null)},
    courseEnrollmentRequest:{findFirst:async()=>s.requests.find(r=>r.status==='PENDING')||null,create:async({data})=>{const r={id:'request-b',...data};s.requests.push(r);return r;}}
  };`,
  'next/cache': 'export const updateTag=t=>globalThis.admissionTest.tags.push(t);export const revalidatePath=p=>globalThis.admissionTest.paths.push(p);',
  '@/actions/notifications': 'const notify=async()=>{if(globalThis.admissionTest.failNotifications)throw Error("Notification service down")};export const notifyAdmins=notify;export const createNotification=notify;',
  '@/lib/logger': 'export const logger={info(){},error(){}};',
};
const bundle = await build({ entryPoints:['src/actions/courses.ts'], bundle:true, platform:'node', format:'cjs', write:false, packages:'external', plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}] });
const {createRequire}=await import('node:module');const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const submit=()=>module.exports.submitCourseEnrollmentRequestAction({courseId:'course-b',paymentPlan:'FULL_PAYMENT'});
state.failNotifications=true;
assert.equal((await submit()).success,true,'Existing student can request another course despite missing converted trial and notification failure');
assert.equal(state.requests.length,1);
assert(state.tags.includes('admin-overview'));assert(state.tags.includes('admin-enrollments'));assert(state.paths.includes('/admin'));
assert.equal((await submit()).success,false,'Pending request prevents duplicate');assert.equal(state.requests.length,1);
state.requests=[];state.enrolled=true;assert.equal((await submit()).success,false,'Already enrolled in requested course');
state.enrolled=false;state.prior=false;assert.equal((await submit()).success,false,'New student still requires trial conversion');
state.converted=true;assert.equal((await submit()).success,true,'Converted trial still eligible');
console.log('PASS second-course admission, notification failure, admin invalidation, duplicate and eligibility guards');
