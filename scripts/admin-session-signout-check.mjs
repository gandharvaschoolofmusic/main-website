// Regression coverage with isolated DB/TOTP boundaries; no real sessions are changed.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { session as authJsSession } from "../node_modules/@auth/core/lib/actions/session.js";

const state = globalThis.adminSessionCheck = {
  rows: new Map(),
  admin: { id: "admin-a", role: "ADMIN", twoFactorEnabled: true, twoFactorSecret: "test", twoFactorBackupCodes: null },
};
const mocks = {
  "react": "export const useEffect=fn=>{globalThis.adminSessionCheck.effect=fn;};",
  "@/lib/db": `const s=globalThis.adminSessionCheck; export const db={
    user:{findUnique:async()=>s.admin},
    adminDeviceSession:{
      findUnique:async({where})=>s.rows.get(where.sessionId)||null,
      updateMany:async({where,data})=>{const row=s.rows.get(where.sessionId);if(!row||(where.userId!==undefined&&row.userId!==where.userId)||(where.isRevoked!==undefined&&row.isRevoked!==where.isRevoked)||(where.lastSeenAt&&row.lastSeenAt>where.lastSeenAt.lte))return {count:0};Object.assign(row,data);return {count:1};},
      upsert:async({where,create,update})=>{const row=s.rows.get(where.sessionId);if(row){Object.assign(row,update);return row;}s.rows.set(where.sessionId,create);return create;}
    }
  };`,
  "@/lib/totp": "export const verifyTotpCode=(_secret,code)=>code==='123456';",
  "@/lib/logger": "export const logger={warn:()=>{},error:()=>{}};",
  "@prisma/client": "export const Role={ADMIN:'ADMIN',TEACHER:'TEACHER',STUDENT:'STUDENT'};",
  "next/server": "export const NextResponse={redirect:url=>({redirect:String(url)})};",
};
try {
  const compiled = await build({ stdin: { contents: `
    export {authConfig} from './src/lib/auth.config';
    export {validateSessionJwt} from './src/lib/auth-jwt';
    export {revokeAdminDeviceSession,syncAdminDeviceSession} from './src/lib/admin-device-session';
    export {AdminSessionMonitor} from './src/components/auth/AdminSessionMonitor';
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{name:"boundaries",setup(b){
      b.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:"mock"}:undefined);
      b.onLoad({filter:/.*/,namespace:"mock"},args=>({contents:mocks[args.path]}));
    }}],
  });
  const {authConfig,validateSessionJwt,revokeAdminDeviceSession,syncAdminDeviceSession,AdminSessionMonitor} = await import("data:text/javascript;base64,"+Buffer.from(compiled.outputFiles[0].contents).toString("base64"));
  const login = token => validateSessionJwt({token, user:{id:"admin-a",role:"ADMIN"},trigger:"signIn"});
  const oldToken = await login({});
  const otherToken = await login({});
  const track = token => syncAdminDeviceSession({userId:"admin-a",sessionId:token.sessionId,userAgent:"Same browser",ip:"192.0.2.1"});
  await track(oldToken);
  await track(otherToken);
  const oldLoginAt=state.rows.get(oldToken.sessionId).loginAt;
  const staleTime=new Date(Date.now()-120_000);
  state.rows.get(oldToken.sessionId).lastSeenAt=staleTime;
  await validateSessionJwt({token:{...oldToken}});
  const refreshedTime=state.rows.get(oldToken.sessionId).lastSeenAt;
  assert.ok(refreshedTime>staleTime,"Active session refreshes last seen");
  await validateSessionJwt({token:{...oldToken}});
  assert.equal(state.rows.get(oldToken.sessionId).lastSeenAt,refreshedTime,"Heartbeat writes are throttled");
  assert.equal(state.rows.get(oldToken.sessionId).loginAt,oldLoginAt,"Original login time is preserved");
  const revoke = (sessionId,totpCode="123456")=>revokeAdminDeviceSession({adminUserId:"admin-a",targetSessionId:sessionId,totpCode});
  assert.equal((await revoke(oldToken.sessionId,"000000")).success,false);
  assert.equal((await validateSessionJwt({token:{...oldToken}})).sessionId,oldToken.sessionId);
  assert.equal((await revoke("not-owned")).success,false);
  state.rows.set("other-admin",{userId:"admin-b",sessionId:"other-admin",isRevoked:false});
  assert.equal((await revoke("other-admin")).success,false);
  assert.equal((await revoke(oldToken.sessionId)).success,true);
  state.rows.get(oldToken.sessionId).lastSeenAt=staleTime;
  assert.equal(await validateSessionJwt({token:{...oldToken}}),null);
  assert.equal(state.rows.get(oldToken.sessionId).lastSeenAt,staleTime,"Revoked sessions cannot update last seen");
  assert.equal(await validateSessionJwt({token:{...oldToken},trigger:"update",session:{user:{role:"STUDENT"}}}),null);
  assert.equal((await validateSessionJwt({token:{...otherToken}})).sessionId,otherToken.sessionId);
  // An in-flight metadata touch must never revive the old login.
  await track(oldToken);
  assert.equal(await validateSessionJwt({token:{...oldToken}}),null);
  const nextToken = await login({...oldToken});
  assert.notEqual(nextToken.sessionId,oldToken.sessionId);
  await track(nextToken);
  assert.equal((await validateSessionJwt({token:{...nextToken}})).sessionId,nextToken.sessionId);
  assert.equal(state.rows.get(oldToken.sessionId).isRevoked,true);
  assert.equal(state.rows.get(nextToken.sessionId).isRevoked,false);
  const request={nextUrl:new URL("https://example.test/login"),headers:new Headers()};
  assert.equal(authConfig.callbacks.authorized({auth:{user:{role:"ADMIN"}},request}),true);
  assert.equal(authConfig.callbacks.authorized({auth:null,request}),true);
  assert.equal(authConfig.callbacks.authorized({auth:null,request:{...request,nextUrl:new URL("https://example.test/admin")}}),false);
  // Exercise the installed Auth.js response path, including deletion of chunked cookies.
  const cleared=[{name:"authjs.session-token.0",value:"",options:{maxAge:0}},{name:"authjs.session-token.1",value:"",options:{maxAge:0}}];
  const response=await authJsSession({
    session:{strategy:"jwt",maxAge:3600},cookies:{sessionToken:{name:"authjs.session-token"}},
    jwt:{decode:async()=>({...oldToken})},callbacks:{jwt:validateSessionJwt},events:{},
    logger:{error:err=>{throw err;}},
  },{value:"old-cookie",clean:()=>cleared},[]);
  assert.equal(response.body,null);
  assert.deepEqual(response.cookies,cleared);
  const original={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document};
  const events=new Map();
  const navigations=[];
  let tick,cleanup,mode="active",signal;
  try {
    globalThis.window={location:{replace:url=>navigations.push(url)},
      setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{tick=null;},
      addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
    globalThis.document={visibilityState:"visible",addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
    globalThis.fetch=async(_url,options)=>{
      signal=options.signal;
      if(mode==="offline")throw Error("offline");
      return {ok:mode!=="server-error",json:async()=>mode==="expired"?null:{user:{id:"admin-a"}}};
    };
    AdminSessionMonitor();
    cleanup=state.effect();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(navigations.length,0);
    mode="offline";await tick();
    mode="server-error";await tick();
    assert.equal(navigations.length,0,"Network failures must not sign out devices");
    mode="expired";
    globalThis.document.visibilityState="hidden";await tick();
    assert.equal(navigations.length,0);
    globalThis.document.visibilityState="visible";await events.get("visibilitychange")();
    assert.deepEqual(navigations,["/login"]);
    cleanup();cleanup=null;
    assert.equal(signal.aborted,true);
    assert.equal(events.size,0);
    assert.equal(tick,null);
  } finally {
    cleanup?.();
    for(const [key,value] of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
  console.log("PASS sign-out invalidates only the chosen session; ownership and 2FA remain enforced");
  console.log("PASS revoked cookies clear through Auth.js and login no longer redirects in a loop");
  console.log("PASS the same device can sign in with a fresh session; old cookies stay invalid");
  console.log("PASS session updates and metadata sync cannot revive a signed-out session");
  console.log("PASS open admin pages detect remote sign-out, tolerate network failures, and clean up polling");
  console.log("PASS last seen tracks active sessions, throttles writes, and preserves login time");
} finally { delete globalThis.adminSessionCheck; }
