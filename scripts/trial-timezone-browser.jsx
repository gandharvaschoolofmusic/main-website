import React from "react";
import { createRoot } from "react-dom/client";
import { AdminTrialsManager } from "../src/app/admin/trials/AdminTrialsManager";
import { BookTrialClient } from "../src/app/book-trial/BookTrialClient";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 100; i++) { if (check()) return; await delay(50); }
  throw Error(message);
}
const checks = [];
const insist = (condition, message) => { if (!condition) throw Error(message); checks.push(message); };
const button = text => [...document.querySelectorAll("button")].find(el => el.textContent.trim() === text);
const root = createRoot(document.querySelector("main"));
async function run() {
  window.trialTest = { calls: [], bookings: [] };
  const lead = { id: "timezone-test", studentId: "student", studentName: "Timezone Test", studentEmail: "test@example.test",
    country: "India", timezone: "America/New_York", category: "Instruments", instrument: "Piano", preferredTimeSlot: "11:30 AM",
    requestedStartsAt: "2026-11-23T16:30:00.000Z", formattedTime: "Old student-time cache", ageGroup: "ADULT", status: "PENDING",
    createdAt: "2026-11-20T10:00:00Z", isContacted: false, isConverted: false,
  };
  const renderAdmin = (item, key) => root.render(<AdminTrialsManager key={key} initialRequests={[item]} teachers={[{ id: "teacher", name: "Teacher", instruments: ["Piano"] }]} courses={[]} initialKpis={{}} />);
  renderAdmin(lead, "winter");
  await until(() => button("Drawer"), "Admin table did not load");
  insist(document.body.textContent.includes("10:00 PM IST"), "admin table converts New York time to IST despite an American browser timezone");
  button("Drawer").click();
  await until(() => document.querySelector('[aria-label="Close drawer"]'), "Drawer did not open");
  insist(document.body.textContent.includes("United States · New York · ET (EST)"), "drawer identifies timezone country, city and Eastern abbreviation");
  insist(document.body.textContent.includes("11:30 AM EST") && document.body.textContent.includes("10:00 PM IST"), "drawer distinguishes student local time from admin IST time");
  document.querySelector('[aria-label="Close drawer"]').click();
  await delay(50);
  button("+ Allot teacher").click();
  await until(() => document.querySelector('input[type="time"]'), "Allotment form did not open");
  const date = document.querySelector('input[type="date"]');
  const time = document.querySelector('input[type="time"]');
  insist(date.value === "2026-11-23" && time.value === "22:00", "allotment inputs use IST, not browser local time or a UTC date");
  time.closest("form").requestSubmit();
  await until(() => window.trialTest.calls.length, "Allotment action was not called");
  insist(window.trialTest.calls[0].scheduledStartsAt === lead.requestedStartsAt, "saving unchanged IST inputs preserves the booked UTC instant");

  renderAdmin({ ...lead, requestedStartsAt: "2026-11-24T04:30:00.000Z", preferredTimeSlot: "11:30 PM" }, "rollover");
  await until(() => document.body.textContent.includes("Nov 24, 2026 at 10:00 AM IST"), "IST next-day date was not displayed");
  checks.push("late American bookings display the correct next-day IST date");

  root.render(<BookTrialClient currentUser={{ id: "student", name: "Student", email: "test@example.test", timezone: "America/New_York", phone: "+16466217008", phoneVerified: true }} />);
  await until(() => document.querySelector(".trial-course"), "Booking form did not load");
  document.querySelector(".trial-course").click(); await delay(50);
  button("Choose a time").click();
  await until(() => document.querySelector(".trial-time-note"), "Student schedule did not open");
  insist(document.querySelector(".trial-time-note").textContent.includes("United States · New York · ET"), "student booking screen labels the same timezone it submits");
  button("Your details").click();
  await until(() => document.querySelector("form.trial-details"), "Student details did not open");
  document.querySelector("form.trial-details").requestSubmit();
  await until(() => window.trialTest.bookings.length, "Student booking was not submitted: " + document.body.textContent.slice(-700));
  insist(window.trialTest.bookings[0].timezone === "America/New_York", "student booking submits the displayed saved timezone rather than browser timezone");

  renderAdmin(lead, "screenshot");
  await until(() => button("Drawer"), "Final drawer row missing");
  button("Drawer").click();
  await until(() => document.querySelector('[aria-label="Close drawer"]'), "Final drawer missing");
  return checks;
}
run().then(checks => ({ checks }), error => ({ error: error.stack })).then(result => { window.trialTestResult = result; });
