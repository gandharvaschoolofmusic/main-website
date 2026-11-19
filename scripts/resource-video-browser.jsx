import React from "react";
import { createRoot } from "react-dom/client";
import { TeacherResourcesClient } from "../src/components/resources/TeacherResourcesClient";
import { StudentResourcesClient } from "../src/components/resources/StudentResourcesClient";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await delay(100); }
  throw Error(message);
}
function button(text) { return [...document.querySelectorAll("button")].find(el => el.textContent.trim() === text); }
function insist(condition, message) { if (!condition) throw Error(message); }

async function run() {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext("2d");
  const paint = () => {
    ctx.fillStyle = "#3C096C"; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = "#ffffff"; ctx.font = "28px sans-serif"; ctx.fillText("Vocal practice · video test", 100, 180);
    ctx.fillRect((performance.now() / 10) % 600, 320, 20, 4);
  };
  paint();
  const stream = canvas.captureStream(12);
  const recording = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks = [];
  recording.ondataavailable = event => chunks.push(event.data);
  const stopped = new Promise(resolve => { recording.onstop = resolve; });
  recording.start(); const painting = setInterval(paint, 70); await delay(800); recording.stop(); await stopped; clearInterval(painting);
  stream.getTracks().forEach(track => track.stop());
  const file = new File(chunks, "Vocal practice.webm", { type: "video/webm" });
  window.videoTest = { url: URL.createObjectURL(file), saves: 0, viewed: 0, shared: null, failPlayback: false };
  const student = { id: "student", name: "Music Student", email: "student@example.test", courseTitle: "Vocal foundations" };
  const pdf = { id: "pdf", title: "Practice notes", fileName: "notes.pdf", fileUrl: "/notes.pdf", fileId: null,
    category: "LESSON_NOTES", description: "", fileSizeBytes: 100, mimeType: "application/pdf", shares: [], createdAt: new Date().toISOString() };
  const root = createRoot(document.querySelector("main"));
  root.render(<TeacherResourcesClient initialResources={[pdf]} allottedStudents={[student]} />);
  await until(() => [...document.querySelectorAll("button")].some(el => el.textContent.includes("Upload")), "Teacher page missing");
  [...document.querySelectorAll("button")].find(el => el.textContent.includes("Upload")).click();
  await until(() => document.querySelector('input[type="file"]'), "Upload form missing");
  const input = document.querySelector('input[type="file"]');
  insist(input.accept.includes(".webm") && input.accept.includes(".mov"), "Video picker formats missing");
  const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await delay(100);
  button("Upload & Save").click();
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Save interrupted"), "Save failure was not surfaced");
  button("Upload & Save").click();
  await until(() => button("Watch video"), "Uploaded video did not appear");
  const stats = await (await fetch("/stats")).json();
  insist(stats.uploads === 1 && stats.bytes === file.size, "Retry re-uploaded the file or upload body was incorrect");
  button("Videos").click();
  await delay(100);
  insist(!document.querySelector("h4")?.textContent.includes("Practice notes"), "Video filter includes documents");
  button("Send").click(); await delay(100); button("Select All").click(); await delay(100); button("Send Resource").click();
  await until(() => window.videoTest.shared, "Sharing did not submit");
  insist(window.videoTest.shared.studentIds[0] === "student", "Wrong share recipient");
  const teacher = { id: "teacher", name: "Music Teacher", email: "teacher@example.test", image: null, teacherProfile: null };
  const video = { ...pdf, id: "video", title: "Vocal practice", fileName: file.name, fileUrl: "/video", mimeType: file.type, category: "OTHER", teacher };
  const received = [video, { ...pdf, teacher }].map(resource => ({ id: "share-" + resource.id, resourceId: resource.id,
    resource, teacherNote: "Practice each phrase slowly before your next lesson.", isViewed: false, viewedAt: null, sharedAt: new Date().toISOString(), course: null }));
  root.render(<StudentResourcesClient initialResources={received} />);
  await until(() => document.body.textContent.includes("Gandharva Student Portal"), "Student page missing");
  button("Videos").click(); await delay(100); button("Watch video").click();
  await until(() => document.querySelector("dialog video"), "Student player missing");
  const player = document.querySelector("dialog video");
  insist(player.controls && player.playsInline, "Native playback controls missing");
  insist(window.videoTest.viewed === 0, "Opening player incorrectly counted as viewed");
  await player.play();
  await until(() => window.videoTest.viewed === 1 && player.videoWidth === 640, "Video did not decode or mark viewed");
  document.querySelector('[aria-label="Close video"]').click();
  await until(() => !document.querySelector("dialog"), "Closing player left media mounted");
  insist(player.paused && !player.getAttribute("src"), "Closed player retained active media");
  window.videoTest.failPlayback = true; button("Watch video").click();
  await until(() => document.querySelector('dialog [role="alert"]'), "Playback failure has no error state");
  window.videoTest.failPlayback = false; button("Try again").click();
  await until(() => document.querySelector("dialog video"), "Playback retry did not recover");
  await document.querySelector("dialog video").play();
  return ["teacher uploads a real video directly with progress; save retry avoids duplicate uploads", "video filtering and sharing to selected students", "student video decodes with controls; viewed state changes on playback", "player cleanup, error feedback, and retry"];
}
run().then(checks => ({ checks }), error => ({ error: error.message })).then(result => {
  window.videoTestResult = result;
});
