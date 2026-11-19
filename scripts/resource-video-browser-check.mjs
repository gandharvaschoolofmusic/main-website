// Browser regression test, with real components and mock application/storage endpoints.
import http from "node:http";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const mocks = {
  "@/actions/resources": `export const uploadResourceAction=async()=>({success:false});export const deleteResourceAction=async()=>({success:true});export const unshareResourceAction=async()=>({success:true});export const markResourceViewedAction=async()=>{window.videoTest.viewed++;return {success:true};};export const shareResourceAction=async input=>{window.videoTest.shared=input;return {success:true,data:{sharedCount:1}};};`,
  "@/actions/resource-videos": `export const prepareResourceVideoAction=async()=>({success:true,data:{uploadUrl:location.origin+"/upload",ticket:"test-ticket",mimeType:"video/webm"}});export const completeResourceVideoAction=async()=>++window.videoTest.saves===1?{success:false,error:"Save interrupted. Please try again."}:{success:true,data:{id:"video",title:"Vocal practice",fileUrl:"/video"}};export const resourcePlaybackAction=async()=>window.videoTest.failPlayback?{success:false,error:"Temporarily unavailable"}:{success:true,data:{url:window.videoTest.url}};`,
};
const bundle = await build({ entryPoints: ["scripts/resource-video-browser.jsx"], bundle: true, write: false, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" }, plugins: [{ name: "mock-actions", setup(b) {
    b.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: "mock" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: mocks[args.path] }));
  } }] });
const css = await postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), { from: path.resolve("src/app/globals.css") });
let uploads = 0, bytes = 0;
const server = http.createServer(async (req, res) => {
  if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{--font-dm-sans:Arial,sans-serif;background:#faf7fc;padding:24px}main{max-width:1100px;margin:auto}</style><main></main><script src="/test.js"></script>'); }
  else if (req.url === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].contents); }
  else if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css); }
  else if (req.url === "/upload" && req.method === "PUT") { uploads++; for await (const chunk of req) bytes += chunk.length; res.end('{}'); }
  else if (req.url === "/stats") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ uploads, bytes })); }
  else res.writeHead(404).end();
});
const profile = await mkdtemp(path.join(tmpdir(), "resource-video-browser-"));
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
    const diagnostic = (await command("Runtime.evaluate", { expression: "document.querySelector('dialog')?.innerText", returnByValue: true })).result?.value;
    throw Error([result?.error || "Browser check timed out", ...exceptions, diagnostic].filter(Boolean).join("\n"));
  }
  for (const check of result.checks) console.log("PASS " + check);
  for (const [name, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: name === "mobile" });
    await delay(200);
    const layout = (await command("Runtime.evaluate", { expression: "(()=>{const d=document.querySelector('dialog').getBoundingClientRect();return {left:d.left,right:d.right,width:innerWidth,bottom:d.bottom,height:innerHeight};})()", returnByValue: true })).result.value;
    if (layout.left < 0 || layout.right > layout.width || layout.bottom > layout.height) throw Error(name + " player overflows viewport");
    const screenshot = await command("Page.captureScreenshot", { format: "png" });
    const file = path.join(tmpdir(), `resource-video-${name}.png`);
    await writeFile(file, Buffer.from(screenshot.data, "base64"));
    console.log("SCREENSHOT " + file);
  }
} finally {
  socket?.close();
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  server.closeAllConnections(); server.close();
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith("resource-video-browser-")) await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
}
