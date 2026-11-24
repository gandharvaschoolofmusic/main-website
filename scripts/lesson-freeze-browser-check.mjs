// Browser regression test for recording backpressure using the real SDK and MediaRecorder.
import http from "node:http";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { build } from "esbuild";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const bundle = await build({ entryPoints: ["scripts/lesson-freeze-browser.jsx"], bundle: true, write: false, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_ENABLE_CLIENT_RECORDER": '"false"' } });
const css = { css: await readFile("src/components/room/meet-room.css", "utf8") };
const server = http.createServer(async (req, res) => {
  if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{--font-dm-sans:Arial,sans-serif;background:#faf7fc;padding:24px}main{max-width:1100px;margin:auto}</style><main></main><script src="/test.js"></script>'); }
  else if (req.url === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].contents); }
  else if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css); }
  else res.writeHead(404).end();
});
const profile = await mkdtemp(path.join(tmpdir(), "lesson-freeze-browser-"));
let child, socket;
try {
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  child = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-first-run", "--disable-extensions", "--autoplay-policy=no-user-gesture-required", "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let port;
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { await delay(100); } }
  if (!port) throw Error("Browser did not start");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  await new Promise(resolve => { socket.onopen = resolve; });
  let serial = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = event => { const message = JSON.parse(event.data); if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } };
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, message => message.error ? reject(Error(message.error.message)) : resolve(message.result)); socket.send(JSON.stringify({ id, method, params })); });
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await command("Runtime.enable");
  await command("Page.navigate", { url: "http://127.0.0.1:" + server.address().port });
  let result;
  for (let i = 0; i < 450; i++) {
    result = (await command("Runtime.evaluate", { expression: "window.videoTestResult", returnByValue: true })).result?.value;
    if (result || exceptions.length) break; await delay(100);
  }
  if (!result || result.error) {
    const diagnostic = (await command("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true })).result?.value;
    throw Error([result?.error || "Browser check timed out", ...exceptions, diagnostic].filter(Boolean).join("\n"));
  }
  for (const check of result.checks) console.log("PASS " + check);

} finally {
  socket?.close();
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  server.closeAllConnections(); server.close();
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith("lesson-freeze-browser-")) await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
}
