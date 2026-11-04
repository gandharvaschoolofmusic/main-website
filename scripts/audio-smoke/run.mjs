// Run with "node scripts/audio-smoke/run.mjs". Set CHROME_PATH on non-Windows hosts.
// Uses two short-lived tokens scoped to a fresh audio-smoke room on the configured server.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { build } from "esbuild";
import dotenv from "dotenv";
import { AccessToken } from "livekit-server-sdk";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;
if (!url || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
  throw new Error("Configure the LiveKit URL, API key and secret before running the audio check.");
}
const instance = randomUUID();
const room = "audio-smoke-" + instance;
async function token(identity) {
  const access = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, ttl: "2m" });
  access.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
  return access.toJwt();
}
const session = { url, teacherToken: await token("teacher"), studentToken: await token("student") };
const bundle = await build({
  entryPoints: ["scripts/audio-smoke/participants.jsx"], bundle: true, write: false,
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env.LOG_LEVEL": "undefined" },
});
const prefix = "/" + instance + "/";
let finish;
const result = new Promise(resolve => { finish = resolve; });
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url === prefix) {
    res.setHeader("Content-Type", "text/html");
    res.end('<main></main><script src="probe.js"></script>');
  } else if (req.url === prefix + "probe.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].contents);
  } else if (req.url === prefix + "session") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(session));
  } else if (req.url === prefix + "result" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.end("OK");
    finish(JSON.parse(body));
  } else {
    res.writeHead(404).end();
  }
});
const browser = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!browser) throw new Error("Set CHROME_PATH to an installed Chromium browser.");
const profile = await mkdtemp(path.join(tmpdir(), "lesson-audio-probe-"));
let child;
let timer;
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  child = spawn(browser, [
    "--headless=new", "--no-first-run", "--disable-extensions", "--disable-background-networking",
    "--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream", "--mute-audio", "--user-data-dir=" + profile,
    "http://127.0.0.1:" + server.address().port + prefix,
  ], { windowsHide: true, stdio: "ignore" });
  const response = await Promise.race([
    result,
    once(child, "exit").then(() => ({ error: "Browser exited before reporting results" })),
    new Promise(resolve => { timer = setTimeout(() => resolve({ error: "Audio check timed out" }), 100000); }),
  ]);
  if (response.error) throw new Error(response.error);
  for (const item of response.checks) console.log("PASS " + item);
} finally {
  clearTimeout(timer);
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  server.closeAllConnections();
  server.close();
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith("lesson-audio-probe-")) {
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
  }
}
