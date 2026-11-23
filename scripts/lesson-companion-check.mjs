import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const output=await build({entryPoints:['src/lib/livekit.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'boundaries',setup(b){b.onResolve({filter:/recording-s3|@\/lib\/logger/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.includes('logger')?'export const logger={info(){},warn(){}}':'export const getS3UploadConfig=()=>null;export const recordingS3Object=()=>null;'}));}}]});
const module={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
// Test credentials only; never loads .env files or contacts LiveKit.
process.env.LIVEKIT_API_KEY='test-key';process.env.LIVEKIT_API_SECRET='test-secret-minimum-32-characters-long';process.env.LIVEKIT_URL='wss://test.livekit.cloud';
const base={lessonId:'lesson-a',userId:'teacher-a',userName:'Teacher',role:'TEACHER',instrument:'Guitar',durationMinutes:60};
const main=await module.exports.generateLessonRoomToken(base);
const first=await module.exports.generateLessonRoomToken({...base,companion:true});
const second=await module.exports.generateLessonRoomToken({...base,companion:true});
const decode=t=>JSON.parse(Buffer.from(t.token.split('.')[1],'base64url'));
assert.equal(main.identity,'teacher-a');assert.notEqual(main.identity,first.identity);assert.notEqual(first.identity,second.identity);
assert.equal(decode(main).video.roomAdmin,true);
for(const token of [first,second]){const claims=decode(token);assert.equal(claims.video.room,'lesson-lesson-a');assert.equal(claims.video.canSubscribe,false);assert.equal(claims.video.roomAdmin,false);assert.deepEqual(claims.video.canPublishSources,['camera','screen_share']);assert.equal(JSON.parse(claims.metadata).userId,'teacher-a');}
console.log('PASS distinct auxiliary identities, room binding, camera/screen-only grants, no microphone, subscriptions or room-admin privileges');
