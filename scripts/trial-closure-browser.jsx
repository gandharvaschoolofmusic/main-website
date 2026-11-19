import React from "react";
import { createRoot } from "react-dom/client";
import { AdminTrialsManager, getLeadStageKey } from "../src/app/admin/trials/AdminTrialsManager";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 100; i++) { if (check()) return; await delay(100); }
  throw Error(message);
}
const button = text => [...document.querySelectorAll("button")].find(el => el.textContent.trim() === text);
const status = () => document.querySelector('[aria-label="Trial booking status"]');
const filter = () => [...document.querySelectorAll("select")].find(el => el.querySelector('option[value="ALL_ACTIVE"]'));
const change = (element, value) => { element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); };
const insist = (value, message) => { if (!value) throw Error(message); };

async function run() {
  window.trialTest = { calls: [], fail: true };
  const lead = {
    id: "closure-test", customId: "TLTEST", studentId: "test-student", studentName: "Trial Test Student",
    studentEmail: "test@example.test", category: "ADULT", instrument: "Western Vocals",
    requestedStartsAt: new Date(Date.now() + 86400000).toISOString(), formattedTime: "Nov 20, 2026 at 6:00 PM",
    preferredTimeSlot: "6:00 PM", ageGroup: "ADULT", status: "ALLOTTED", lessonStatus: "COMPLETED",
    isContacted: true, isConverted: false, studentNotes: "Beginner",
    followUpAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  };
  const root = createRoot(document.querySelector("main"));
  const render = (item, key) => root.render(<AdminTrialsManager key={key} initialRequests={[item]} teachers={[]} courses={[]} initialKpis={{}} />);
  render(lead, "initial");
  await until(() => button("Drawer"), "Trial row not rendered");
  button("Drawer").click();
  await until(status, "Trial drawer did not open");
  change(status(), "NOT_CONVERTED");
  await delay(100);
  button("Save Changes").click();
  await until(() => document.body.textContent.includes("Simulated saving failure"), "Failure was not displayed");
  insist(!!status() && filter().value === "ALL_ACTIVE", "Failed save closed the drawer or removed the lead");
  window.trialTest.fail = false;
  button("Save Changes").click();
  await until(() => !status(), "Successful save did not close the drawer");
  insist(!button("Drawer"), "Closed booking remains in active list");
  insist(!button("Convert to Enrolled Student"), "Closed overview card is still actionable");
  const saved = window.trialTest.calls.at(-1);
  insist(saved.status === "NOT_CONVERTED", "Wrong status sent to server");
  insist(JSON.parse(saved.studentNotes).activities.some(item => item.status === "NOT_CONVERTED"), "Closure activity missing");
  const archived = { ...lead, status: "NOT_CONVERTED", studentNotes: saved.studentNotes, followUpAt: null };
  insist(getLeadStageKey(archived) === "NOT_CONVERTED", "Completed lesson overrode the closed status");
  render(archived, "reload");
  await delay(100);
  await until(() => filter()?.value === "ALL_ACTIVE", "Reload did not restore active filter");
  change(filter(), "NOT_CONVERTED");
  await until(() => button("Drawer"), "Closed filter did not retain booking history");
  button("Drawer").click();
  await until(status, "Archived booking did not open");
  insist(status().value === "NOT_CONVERTED" && status().disabled, "Closed status is editable");
  insist(button("Save Changes").hidden, "Closed booking still offers saving");
  insist(document.body.textContent.includes("This booking is closed"), "Closed explanation missing");
  return ["failed save keeps the card open and the booking active", "Not Converted saves closure history, closes the drawer, and leaves the active list", "closed status persists across reload and overrides completed lesson status", "closed bookings remain visible in history with editing disabled"];
}
run().then(checks => ({ checks }), error => ({ error: error.message })).then(result => { window.trialTestResult = result; });
