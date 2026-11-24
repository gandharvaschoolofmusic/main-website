// Browser regression test for recording split-screen composition using the real SDK and MediaRecorder.
import http from "node:http";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { build } from "esbuild";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const bundle = await build({ entryPoints: ["scripts/lesson-layout-browser.jsx"], bundle: true, write: false, outdir: "test-output", jsx: "automatic",
  plugins: [{ name: "template-connection-boundary", setup(b) {
    b.onResolve({ filter: /^livekit-client$/ }, a => a.importer.endsWith("LessonRecordingTemplate.tsx") ? { path: a.path, namespace: "template-test" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "template-test" }, () => ({ resolveDir: process.cwd(), contents: `
      import { Room as RealRoom } from "livekit-client";
      export * from "livekit-client";
      export class Room extends RealRoom { constructor(...args) { super(...args); window.configureRecordingRoom?.(this); } }
    ` }));
  } }],
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_ENABLE_CLIENT_RECORDER": '"false"' } });
const css = { css: bundle.outputFiles.find(file => file.path.endsWith(".css")).text };
const server = http.createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/preview") { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{--font-dm-sans:Arial,sans-serif;background:#111;margin:0}main{width:100vw;height:100vh}</style><main></main>' + (req.url === "/preview" ? '<script>window.layoutPreviewOnly=true</script>' : '') + '<script src="/test.js"></script>'); }
  else if (req.url === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles.find(file => file.path.endsWith(".js")).contents); }
  else if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css); }
  else res.writeHead(404).end();
});
const profile = await mkdtemp(path.join(tmpdir(), "lesson-layout-browser-"));
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
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 810, deviceScaleFactor: 1, mobile: false });
  await command("Runtime.enable");
  await command("Page.navigate", { url: "http://127.0.0.1:" + server.address().port });
  let result;
  for (let i = 0; i < 600; i++) {
    result = (await command("Runtime.evaluate", { expression: "window.videoTestResult", returnByValue: true })).result?.value;
    if (result || exceptions.length) break; await delay(100);
  }
  if (!result || result.error) {
    const diagnostic = (await command("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true })).result?.value;
    throw Error([result?.error || "Browser check timed out", ...exceptions, diagnostic].filter(Boolean).join("\n"));
  }
  for (const width of [1440, 768, 390]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: Math.round(width * 9 / 16), deviceScaleFactor: 1, mobile: false });
    await delay(200);
    const aspect = (await command("Runtime.evaluate", { expression: "(() => { const r = document.querySelector('.lesson-stage').getBoundingClientRect(); return r.width / r.height; })()", returnByValue: true })).result.value;
    if (Math.abs(aspect - 16 / 9) > .01) throw Error("Live stage aspect ratio differs from recording");
    const screenshot = await command("Page.captureScreenshot", { format: "png" });
    const output = path.join(tmpdir(), `lesson-layout-${width}.png`);
    await (await import("node:fs/promises")).writeFile(output, Buffer.from(screenshot.data, "base64"));
    console.log("Screenshot " + output);
  }
  for (const check of result.checks) console.log("PASS " + check);
  if (process.env.LAYOUT_INSPECTOR) {
    // This is the requested full-frame video stage: labels overlay its edges, it
    // has no page heading/posters, and saturated sources identify feeds in tests.
    const inspector = spawn(process.execPath, [process.env.LAYOUT_INSPECTOR, `http://127.0.0.1:${server.address().port}/preview`, "--app", "--allow", "edge-text,no-title,no-poster,colour-sprawl", "--out", path.join(tmpdir(), "lesson-layout-inspect")], { windowsHide: true, stdio: "inherit" });
    const [code] = await once(inspector, "exit");
    if (code) throw Error("Layout inspector reported findings");
  }

} finally {
  socket?.close();
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  server.closeAllConnections(); server.close();
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith("lesson-layout-browser-")) await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
}
