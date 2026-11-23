import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const s=globalThis.rescheduleTest={role:'STUDENT',tickets:[],notifications:[],hours:7,owner:'student-a',sessionCount:24};
const mocks={
  '@/lib/auth-helpers':'export const requireUser=async()=>({id:"student-a",role:globalThis.rescheduleTest.role,name:"Student"});',
  '@/lib/logger':'export const logger={error(){}};',
  'next/cache':'export const revalidatePath=()=>{};export const updateTag=()=>{};',
  '@/lib/db':`const s=globalThis.rescheduleTest;let queue=Promise.resolve();const tx={
    $queryRaw:async()=>[],lesson:{findFirst:async({where})=>s.owner===where.studentId?{id:where.id,studentId:s.owner,status:'SCHEDULED',startsAt:new Date(Date.now()+s.hours*3600000),enrollmentId:'enrollment-a',instrument:'Guitar',enrollment:{course:{sessionCount:s.sessionCount}}}:null},
    supportTicket:{findFirst:async({where})=>s.tickets.find(t=>t.subject===where.subject),count:async()=>s.tickets.length,create:async({data})=>{const row={id:'ticket-'+s.tickets.length,...data};s.tickets.push(row);return row;}},
    user:{findMany:async()=>[{id:'admin-a'}]},notification:{createMany:async({data})=>s.notifications.push(...data)}};
    export const db={$transaction:fn=>{const next=queue.then(()=>fn(tx));queue=next.catch(()=>{});return next;}};`
};
const out=await build({entryPoints:['src/actions/reschedule.ts'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path]}));}}]});
const module={exports:{}};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const request=id=>module.exports.requestStudentReschedule({lessonId:id,reason:'Schedule conflict',preferredSchedule:'Friday, 5 PM IST'});
s.hours=5.99;assert.equal((await request('late')).success,false);assert.equal(s.tickets.length,0);
s.hours=6.01;let result=await request('first');assert.equal(result.success,true);assert.equal(result.remaining,5);assert(s.notifications.find(n=>n.userId==='student-a').body.includes('5 of 6'));assert(s.notifications.find(n=>n.userId==='admin-a').link.startsWith('/admin/support/'));
s.tickets=Array.from({length:5},(_,i)=>({subject:'old'+i,status:'CLOSED'}));s.notifications=[];s.hours=7;
const race=await Promise.all([request('sixth'),request('seventh')]);assert.equal(race.filter(r=>r.success).length,1);assert.equal(s.tickets.length,6);assert.equal(race.find(r=>r.success).remaining,0);
assert.equal((await request('eighth')).success,false);
s.tickets=[];s.owner='other-student';assert.equal((await request('unauthorized')).success,false);s.owner='student-a';s.role='TEACHER';assert.equal((await request('teacher')).success,false);
console.log('PASS 6-hour cutoff, remaining-count notifications, admin queue, closed-ticket retention, serialized sixth/seventh requests and authorization');
