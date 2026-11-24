import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";

// Exercise the actual booking parser and admin page with DB/auth boundaries mocked.
const trialSource = await readFile("src/actions/trial.ts", "utf8");
const parser = trialSource.slice(trialSource.indexOf("function parseDateTimeToUTC("), trialSource.indexOf("/**\n * Creates a trial"));
const state = globalThis.trialTimezoneTest = { requests: [] };
const mocks = {
  "@/lib/auth-helpers": "export const requireRole=async()=>{};",
  "@/lib/db": "const s=globalThis.trialTimezoneTest;export const db={trialRequest:{findMany:async()=>s.requests},user:{findMany:async()=>[]},course:{findMany:async()=>[]}};",
  "next/cache": "export const unstable_cache=fn=>fn;",
  "@/lib/db-resilience": "export const getResilientData=(_key,fn)=>fn();export const getLastKnownGood=()=>null;",
  "./AdminTrialsManager": "export const AdminTrialsManager=()=>null;",
};
const bundle = await build({
  stdin: { contents: `import {fromZonedTime} from 'date-fns-tz';${parser}\nexport {parseDateTimeToUTC};export * from './src/lib/timezone';export {default as adminPage} from './src/app/admin/trials/page';`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "boundaries", setup(b) {
    b.onResolve({ filter: /.*/ }, a => mocks[a.path] ? { path: a.path, namespace: "mock" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({ contents: mocks[a.path], loader: "js" }));
  } }],
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
const api = mod.exports;
const originalTZ = process.env.TZ;
try {
  for (const hostTZ of ["UTC", "America/Los_Angeles", "Asia/Kolkata"]) {
    process.env.TZ = hostTZ;
    for (const [day, time, utc, ist, abbreviation] of [
      ["2026-11-23", "11:30 AM", "2026-11-23T16:30:00.000Z", "Nov 23, 2026 at 10:00 PM IST", "EST"],
      ["2026-07-23", "11:30 AM", "2026-07-23T15:30:00.000Z", "Jul 23, 2026 at 9:00 PM IST", "EDT"],
      ["2026-11-23", "11:30 PM", "2026-11-24T04:30:00.000Z", "Nov 24, 2026 at 10:00 AM IST", "EST"],
    ]) {
      const instant = api.parseDateTimeToUTC(day, time, "America/New_York");
      assert.equal(instant.toISOString(), utc);
      assert.equal(api.formatToIST(instant), ist);
      assert.equal(api.fromISTInputToUtc(api.toISTInputString(instant)).toISOString(), utc);
      assert.equal(api.formatTimezoneLabel("America/New_York", instant, "India"), `United States · New York · ET (${abbreviation})`);
      state.requests = [{ id: "trial", studentId: "student", timezone: "America/New_York", requestedStartsAt: instant,
        preferredTimeSlot: time, createdAt: instant, allottedLesson: null, status: "PENDING" }];
      const page = await api.adminPage();
      const request = page.props.children.props.initialRequests[0];
      assert.equal(request.formattedTime, ist);
      assert.equal(request.requestedStartsAt, utc);
      assert.equal(request.timezone, "America/New_York");
      state.requests[0].allottedLesson = { startsAt: new Date("2026-11-25T19:00:00Z"), durationMinutes: 60 };
      const updatedPage = await api.adminPage();
      assert.equal(updatedPage.props.children.props.initialRequests[0].formattedTime, "Nov 26, 2026 at 12:30 AM IST");
    }
    console.log(`PASS booking UTC storage, admin IST, DST, next-day rollover, rescheduled lesson and IST input round-trip with host timezone ${hostTZ}`);
  }
  assert.equal(api.formatTimezoneLabel("Asia/Calcutta", "2026-11-23T16:30:00Z"), "India · Kolkata · IST");
  assert.equal(api.formatTimezoneLabel("invalid", new Date()), "Timezone unavailable");
  console.log("PASS timezone country/city labels and IST alias");
} finally {
  if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
  delete globalThis.trialTimezoneTest;
}
