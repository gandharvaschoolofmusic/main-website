const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Gandharva School of Music - Class Notification Email Templates Specification</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e1e24;
      background: #ffffff;
      font-size: 11.5px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4 {
      font-family: "Georgia", "Times New Roman", serif;
      color: #240046;
      font-weight: 700;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    .cover {
      min-height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 10px 20px 10px;
    }
    .cover-top {
      border-bottom: 3px solid #3C096C;
      padding-bottom: 25px;
    }
    .brand-tag {
      display: inline-block;
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #7B2CBF;
      margin-bottom: 15px;
    }
    .cover-title {
      font-size: 32px;
      line-height: 1.2;
      color: #10002B;
      margin-bottom: 14px;
    }
    .cover-subtitle {
      font-size: 14px;
      color: #555;
      line-height: 1.6;
      max-width: 650px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 30px 0;
      background: #FAF8F5;
      border: 1px solid #EBE4DA;
      border-radius: 12px;
      padding: 20px 25px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #888;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #222;
    }
    .section-title {
      font-size: 20px;
      color: #240046;
      border-bottom: 2px solid #E8E0F0;
      padding-bottom: 8px;
      margin: 20px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-num {
      display: inline-block;
      width: 24px;
      height: 24px;
      line-height: 24px;
      text-align: center;
      background: #3C096C;
      color: #fff;
      font-size: 11px;
      font-family: sans-serif;
      font-weight: 700;
      border-radius: 6px;
    }
    .badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .badge-purple { background: #F3EEFA; color: #3C096C; }
    .badge-amber { background: #FEF3C7; color: #B45309; }
    .badge-green { background: #DCFCE7; color: #15803D; }
    .badge-red { background: #FEE2E2; color: #B91C1C; }
    .badge-blue { background: #E0F2FE; color: #0369A1; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 10.5px;
    }
    th {
      background: #240046;
      color: #ffffff;
      padding: 8px 10px;
      text-align: left;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #ECECEC;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #FCFBF9;
    }
    .template-card {
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      background: #FAFAFA;
      padding: 16px;
      margin: 14px 0;
      page-break-inside: avoid;
    }
    .template-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #D1D5DB;
    }
    .template-name {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }
    .info-table {
      width: 100%;
      margin-bottom: 12px;
    }
    .info-table td {
      padding: 4px 8px;
      font-size: 10px;
      border: none;
      background: transparent !important;
    }
    .info-table td.label {
      width: 110px;
      font-weight: bold;
      color: #4B5563;
    }

    /* Email Mockup Container */
    .email-mockup {
      max-width: 520px;
      margin: 10px auto;
      background: #ffffff;
      border: 1px solid #fed7aa;
      border-radius: 12px;
      padding: 20px 18px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .email-brand-header {
      text-align: center;
      border-bottom: 1px solid #f3ece1;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .email-brand-name {
      font-size: 18px;
      font-weight: 800;
      color: #3C096C;
      letter-spacing: 0.3px;
    }
    .email-brand-sub {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #7B2CBF;
      margin-top: 1px;
    }
    .email-subject-line {
      font-size: 12px;
      font-weight: 700;
      margin-top: 8px;
    }
    .email-badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 10px;
      border-radius: 9999px;
      margin: 8px 0;
    }
    .email-details-box {
      background: #fdfbf7;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      padding: 12px 14px;
      margin: 12px 0;
      font-size: 11px;
    }
    .email-details-box p {
      margin: 4px 0;
    }
    .email-btn {
      display: inline-block;
      background: #3C096C;
      color: #ffffff !important;
      text-decoration: none;
      padding: 9px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 11.5px;
      margin: 10px 0;
      text-align: center;
    }
    .checklist-box {
      background: #fafaf9;
      border-radius: 8px;
      padding: 8px 12px;
      margin-top: 10px;
      font-size: 10px;
      color: #78716c;
    }
    .email-footer {
      border-top: 1px solid #f5f5f4;
      padding-top: 10px;
      margin-top: 14px;
      text-align: center;
      color: #a8a29e;
      font-size: 9.5px;
    }
    code {
      font-family: Consolas, Monaco, monospace;
      font-size: 9.5px;
      background: #F4F1EA;
      color: #9C27B0;
      padding: 1px 4px;
      border-radius: 4px;
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE ==================== -->
  <div class="cover page-break">
    <div class="cover-top">
      <div class="brand-tag">Gandharva School of Music &bull; Official Specification</div>
      <div class="cover-title">Class Notification &amp; Lifecycle<br>Email Templates Catalog</div>
      <div class="cover-subtitle">
        Complete operational specification, trigger architecture, and visual rendering guide for all automated classroom reminder windows (24h, 12h, 1h, 10m), reschedule events with .ics attachments, cancellation protections, and real-time messaging notifications.
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">System Subsystem</span>
        <span class="meta-value">Email Notification &amp; Reminder Engine</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Document Version</span>
        <span class="meta-value">v2.4 Production Release</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Automated Schedulers</span>
        <span class="meta-value">Vercel Cron (*/5 * * * *) &amp; Background Workers</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Timezone Strategy</span>
        <span class="meta-value">Dual Zone: Local Recipient Timezone + IST Standard</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Security &amp; Idempotency</span>
        <span class="meta-value">attendanceLogs.reminderLogs deduplication array</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Generated Timestamp</span>
        <span class="meta-value">November 2026 &bull; Authorized Release</span>
      </div>
    </div>

    <div>
      <h4 style="font-size: 13px; color: #3C096C; margin-bottom: 6px;">Executive Overview</h4>
      <p style="font-size: 11px; color: #444; line-height: 1.6;">
        This specification documents the 7 core email templates dispatched across the student and faculty journey. Every template incorporates Gandharva&rsquo;s signature royal purple branding, zero white line borders, high-contrast accessible typography, dynamic timezone localization, and direct one-click classroom entry routes.
      </p>
    </div>

    <div style="border-top: 1px solid #EBE4DA; padding-top: 14px; font-size: 9.5px; color: #888; display: flex; justify-content: space-between;">
      <span>Gandharva School of Music &bull; Academy Communications Specification</span>
      <span>Confidential &amp; Proprietary</span>
    </div>
  </div>

  <!-- ==================== TRIGGER & ARCHITECTURE MATRIX ==================== -->
  <div class="page-break">
    <div class="section-title">
      <span class="section-num">1</span>
      <span>Notification Engine Architecture &amp; Trigger Matrix</span>
    </div>

    <p style="font-size: 11px; color: #444; margin-bottom: 12px; line-height: 1.5;">
      All class reminders are processed via <code>processUpcomingLessonReminders()</code> targeting scheduled lessons. Deduplication prevents multiple alerts by logging dispatched windows (<code>["24h", "12h", "1h", "10m"]</code>) directly into <code>Lesson.attendanceLogs.reminderLogs</code>.
    </p>

    <table>
      <thead>
        <tr>
          <th>Template Name</th>
          <th>Trigger Event</th>
          <th>Recipients</th>
          <th>Window / Filter</th>
          <th>Special Attachments / Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1. 24h Reminder</strong></td>
          <td>Cron Scheduler (<code>*/5 * * * *</code>)</td>
          <td>Student &amp; Faculty</td>
          <td>Starts between 750m &amp; 1470m ahead</td>
          <td>Syllabus review &amp; equipment prep note</td>
        </tr>
        <tr>
          <td><strong>2. 12h Reminder</strong></td>
          <td>Cron Scheduler (<code>*/5 * * * *</code>)</td>
          <td>Student &amp; Faculty</td>
          <td>Starts between 65m &amp; 750m ahead</td>
          <td>Day-of checklist &amp; dual-time badge</td>
        </tr>
        <tr>
          <td><strong>3. 1h Reminder</strong></td>
          <td>Cron Scheduler (<code>*/5 * * * *</code>)</td>
          <td>Student &amp; Faculty</td>
          <td>Starts between 15m &amp; 65m ahead</td>
          <td>Tuning, microphone &amp; audio test checklist</td>
        </tr>
        <tr>
          <td><strong>4. 10m Reminder</strong></td>
          <td>Cron Scheduler (<code>*/5 * * * *</code>)</td>
          <td>Student &amp; Faculty</td>
          <td>Starts between -5m &amp; +15m ahead</td>
          <td><strong>Green Urgency Badge</strong> &bull; Direct Join Room button</td>
        </tr>
        <tr>
          <td><strong>5. Class Rescheduled</strong></td>
          <td>Admin/Teacher schedule change</td>
          <td>Student &amp; Faculty</td>
          <td>Triggered instantly on date/time update</td>
          <td>Previous time strikethrough + <strong>updated .ics Calendar invite</strong></td>
        </tr>
        <tr>
          <td><strong>6. Class Cancelled</strong></td>
          <td>Admin, Teacher, or Student cancellation</td>
          <td>Student &amp; Faculty</td>
          <td>Triggered instantly upon status = CANCELLED</td>
          <td>Cancellation reason + <strong>Protected Session Balance</strong> assurance</td>
        </tr>
        <tr>
          <td><strong>7. New Chat Message</strong></td>
          <td>Classroom or Direct Message received</td>
          <td>Recipient (when partner absent)</td>
          <td>Triggered if partner has not joined live room</td>
          <td>Sanitized preview snippet + One-click Live Classroom reply link</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #FAF5FF; border: 1px solid #E9D5FF; border-left: 4px solid #7B2CBF; border-radius: 8px; padding: 12px 14px; margin-top: 15px;">
      <h4 style="font-size: 11px; color: #581C87; margin-bottom: 4px;">Timezone Localization Standard:</h4>
      <p style="font-size: 10.5px; color: #4C1D95; line-height: 1.5;">
        Every template displays the lesson schedule in <strong>two distinct formats</strong>:
        <br>1. <strong>Recipient Local Time</strong> formatted using <code>formatInViewerTimezone(startsAt, recipient.timezone)</code> (e.g., <em>Wednesday, Nov 11, 2026 at 10:00 AM EST</em>).
        <br>2. <strong>Academy Standard Time</strong> formatted using <code>formatToIST(startsAt)</code> (e.g., <em>Nov 11, 2026 at 8:30 PM IST</em>).
      </p>
    </div>
  </div>

  <!-- ==================== TEMPLATE 1: 24-HOUR REMINDER ==================== -->
  <div class="page-break">
    <div class="section-title">
      <span class="section-num">2</span>
      <span>Template 1: 24-Hour Class Reminder (Tomorrow)</span>
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Trigger Window:</td>
        <td>24 hours before class start (<code>diffMinutes &gt; 750 &amp;&amp; diffMinutes &lt;= 1470</code>)</td>
        <td class="label">Idempotency:</td>
        <td><code>attendanceLogs.reminderLogs.includes("24h")</code></td>
      </tr>
      <tr>
        <td class="label">Subject (Student):</td>
        <td colspan="3"><code>Reminder: [Discipline] class with [Teacher Name] (Class Tomorrow)</code></td>
      </tr>
      <tr>
        <td class="label">Subject (Teacher):</td>
        <td colspan="3"><code>Reminder: Teaching session with [Student Name] (Class Tomorrow)</code></td>
      </tr>
    </table>

    <!-- Rendered Student Preview -->
    <div class="email-mockup">
      <div class="email-brand-header">
        <div class="email-brand-name">Gandharva</div>
        <div class="email-brand-sub">School of Music</div>
        <div class="email-subject-line" style="color: #3C096C;">Class Tomorrow</div>
      </div>

      <div style="text-align: center;">
        <span class="email-badge badge-purple">24-Hour Reminder</span>
      </div>

      <p style="font-size: 11px; color: #374151; margin-top: 6px;">
        Hello <strong>Rohan Mehta</strong>, this is an automated reminder for your upcoming 1-on-1 music class with <strong>Ananya Sharma</strong>.
      </p>

      <div class="email-details-box">
        <p><strong>Discipline / Course:</strong> Carnatic Vocals (Beginner Foundation)</p>
        <p><strong>Instructor:</strong> Ananya Sharma</p>
        <p><strong>When:</strong> Thursday, November 12, 2026 at 7:00 PM EST</p>
        <p style="font-size: 10px; color: #78716c;">(Indian Standard Time: Nov 13, 2026 at 5:30 AM IST)</p>
        <p><strong>Duration:</strong> 60 minutes</p>
        <p style="font-size: 9.5px; color: #a8a29e; font-family: monospace;">Session Code: S0012-SE004</p>
      </div>

      <p style="font-size: 10.5px; color: #57534e; margin: 8px 0;">
        Your 1-on-1 class is scheduled for tomorrow. Please review any practice notes or sheet music in advance.
      </p>

      <div style="text-align: center; margin: 12px 0;">
        <span class="email-btn">Preview Lesson Room &rarr;</span>
      </div>

      <div class="checklist-box">
        <strong>Quick Checklist:</strong>
        <ul style="margin: 4px 0 0 16px;">
          <li>Use headphones/earphones for optimal acoustic clarity.</li>
          <li>Tune your instrument before classroom entry.</li>
          <li>Ensure stable Wi-Fi / broadband connection.</li>
        </ul>
      </div>

      <div class="email-footer">
        Gandharva School of Music &bull; Automated Class Reminder
      </div>
    </div>
  </div>

  <!-- ==================== TEMPLATE 2: 12-HOUR REMINDER ==================== -->
  <div class="page-break">
    <div class="section-title">
      <span class="section-num">3</span>
      <span>Template 2: 12-Hour Class Reminder (Today)</span>
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Trigger Window:</td>
        <td>12 hours before class start (<code>diffMinutes &gt; 65 &amp;&amp; diffMinutes &lt;= 750</code>)</td>
        <td class="label">Idempotency:</td>
        <td><code>attendanceLogs.reminderLogs.includes("12h")</code></td>
      </tr>
      <tr>
        <td class="label">Subject (Student):</td>
        <td colspan="3"><code>Reminder: [Discipline] class with [Teacher Name] (Class Coming Up Today)</code></td>
      </tr>
      <tr>
        <td class="label">Subject (Teacher):</td>
        <td colspan="3"><code>Reminder: Teaching session with [Student Name] (Class Coming Up Today)</code></td>
      </tr>
    </table>

    <!-- Rendered Student Preview -->
    <div class="email-mockup">
      <div class="email-brand-header">
        <div class="email-brand-name">Gandharva</div>
        <div class="email-brand-sub">School of Music</div>
        <div class="email-subject-line" style="color: #5A189A;">Class Coming Up Today</div>
      </div>

      <div style="text-align: center;">
        <span class="email-badge badge-purple">12-Hour Reminder</span>
      </div>

      <p style="font-size: 11px; color: #374151; margin-top: 6px;">
        Hello <strong>Rohan Mehta</strong>, this is an automated reminder for your upcoming 1-on-1 music class with <strong>Ananya Sharma</strong>.
      </p>

      <div class="email-details-box">
        <p><strong>Discipline / Course:</strong> Carnatic Vocals (Beginner Foundation)</p>
        <p><strong>Instructor:</strong> Ananya Sharma</p>
        <p><strong>When:</strong> Today at 7:00 PM EST</p>
        <p style="font-size: 10px; color: #78716c;">(Indian Standard Time: Tomorrow at 5:30 AM IST)</p>
        <p><strong>Duration:</strong> 60 minutes</p>
        <p style="font-size: 9.5px; color: #a8a29e; font-family: monospace;">Session Code: S0012-SE004</p>
      </div>

      <p style="font-size: 10.5px; color: #57534e; margin: 8px 0;">
        Your lesson is coming up in approximately 12 hours today. Be sure your device and music area are ready.
      </p>

      <div style="text-align: center; margin: 12px 0;">
        <span class="email-btn">Check Lesson Room &rarr;</span>
      </div>

      <div class="checklist-box">
        <strong>Quick Checklist:</strong>
        <ul style="margin: 4px 0 0 16px;">
          <li>Review previous lesson exercises and teacher feedback.</li>
          <li>Charge your laptop or tablet and position camera at hand/face level.</li>
        </ul>
      </div>

      <div class="email-footer">
        Gandharva School of Music &bull; Automated Class Reminder
      </div>
    </div>
  </div>

  <!-- ==================== TEMPLATE 3 & 4: 1-HOUR & 10-MIN REMINDERS ==================== -->
  <div class="page-break">
    <div class="section-title">
      <span class="section-num">4</span>
      <span>Template 3 &amp; 4: 1-Hour &amp; 10-Minute Immediate Reminders</span>
    </div>

    <!-- 1-Hour Template -->
    <div style="margin-bottom: 25px;">
      <div style="font-size: 12px; font-weight: bold; color: #B45309; margin-bottom: 6px;">
        &bull; 1-Hour Countdown Window (Amber Urgency)
      </div>
      <table class="info-table">
        <tr>
          <td class="label">Trigger Window:</td>
          <td>15m to 65m before class start</td>
          <td class="label">Subject Line:</td>
          <td><code>⏰ 1 Hour Reminder: [Discipline] with [Teacher Name]</code></td>
        </tr>
      </table>

      <div class="email-mockup" style="border-color: #FCD34D;">
        <div class="email-brand-header">
          <div class="email-brand-name">Gandharva</div>
          <div class="email-brand-sub">School of Music</div>
          <div class="email-subject-line" style="color: #D97706;">Class Starting in 1 Hour</div>
        </div>
        <div style="text-align: center;">
          <span class="email-badge badge-amber">Starting in 1 Hour</span>
        </div>
        <div class="email-details-box" style="background: #FFFBEB; border-color: #FDE68A;">
          <p><strong>Discipline:</strong> Electronic Keyboard &bull; <strong>Duration:</strong> 45 mins</p>
          <p><strong>Scheduled Time:</strong> Today at 6:00 PM EST (IST: Tomorrow at 4:30 AM IST)</p>
        </div>
        <div style="text-align: center;">
          <span class="email-btn" style="background: #D97706;">Get Ready &amp; Join &rarr;</span>
        </div>
      </div>
    </div>

    <!-- 10-Min Template -->
    <div>
      <div style="font-size: 12px; font-weight: bold; color: #15803D; margin-bottom: 6px;">
        &bull; 10-Minute Immediate Entry Window (Green Live Alert)
      </div>
      <table class="info-table">
        <tr>
          <td class="label">Trigger Window:</td>
          <td>-5m to +15m of start time</td>
          <td class="label">Subject Line:</td>
          <td><code>🟢 Starting Now: [Discipline] with [Teacher Name]</code></td>
        </tr>
      </table>

      <div class="email-mockup" style="border-color: #86EFAC;">
        <div class="email-brand-header">
          <div class="email-brand-name">Gandharva</div>
          <div class="email-brand-sub">School of Music</div>
          <div class="email-subject-line" style="color: #16A34A;">Class Starting in 10 Minutes!</div>
        </div>
        <div style="text-align: center;">
          <span class="email-badge badge-green">Classroom Live Now</span>
        </div>
        <div class="email-details-box" style="background: #F0FDF4; border-color: #BBF7D0;">
          <p><strong>Status:</strong> Room is currently active &amp; ready for participants.</p>
          <p><strong>Session Link:</strong> Direct access active &bull; No PIN required.</p>
        </div>
        <div style="text-align: center;">
          <span class="email-btn" style="background: #15803D;">Join Classroom Now &rarr;</span>
        </div>
        <div class="email-footer">
          Gandharva School of Music &bull; Immediate Classroom Call
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== TEMPLATE 5: CLASS RESCHEDULED ==================== -->
  <div class="page-break">
    <div class="section-title">
      <span class="section-num">5</span>
      <span>Template 5: Class Rescheduled Notification</span>
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Trigger:</td>
        <td>Admin / Faculty modifies session date or time in Calendar / Enrollment plan</td>
        <td class="label">Attachments:</td>
        <td>RFC 5545 <code>rescheduled-lesson.ics</code> calendar event</td>
      </tr>
      <tr>
        <td class="label">Subject:</td>
        <td colspan="3"><code>📅 Class Rescheduled: [Discipline] with [Teacher/Student Name]</code></td>
      </tr>
      <tr>
        <td class="label">Special Action:</td>
        <td colspan="3">Resets <code>attendanceLogs.reminderLogs = []</code> so 24h, 12h, 1h, 10m reminders fire freshly for the new time</td>
      </tr>
    </table>

    <div class="email-mockup">
      <div class="email-brand-header">
        <div class="email-brand-name">Gandharva</div>
        <div class="email-brand-sub">School of Music</div>
        <div class="email-subject-line" style="color: #D97706;">Class Rescheduled</div>
      </div>

      <p style="font-size: 11px; color: #374151; margin-top: 6px;">
        Hello <strong>Priya Sen</strong>, your upcoming music class with <strong>Vikram Iyer</strong> has been rescheduled by <strong>Academy Administration</strong>.
      </p>

      <div class="email-details-box">
        <p><strong>Discipline / Course:</strong> Hindustani Classical Violin</p>
        <p><strong>Instructor:</strong> Vikram Iyer</p>

        <div style="margin: 8px 0; padding: 6px 10px; background: #FFF1F2; border-left: 3px solid #E11D48; border-radius: 4px;">
          <p style="margin: 0; font-size: 10px; color: #9F1239;">
            <strong>Previous Time:</strong> <span style="text-decoration: line-through;">Wed, Nov 11, 2026 at 4:00 PM IST</span>
          </p>
        </div>

        <div style="margin: 8px 0; padding: 6px 10px; background: #ECFDF5; border-left: 3px solid #059669; border-radius: 4px;">
          <p style="margin: 0; font-size: 11px; color: #065F46; font-weight: bold;">
            New Scheduled Time: Friday, November 13, 2026 at 5:00 PM IST
          </p>
          <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #047857;">
            (Indian Standard Time: Nov 13, 2026 at 5:00 PM IST)
          </p>
        </div>

        <p><strong>Duration:</strong> 60 minutes</p>
        <p style="font-size: 9.5px; color: #a8a29e; font-family: monospace;">Session Code: S0015-SE003</p>
      </div>

      <div style="text-align: center; margin: 12px 0;">
        <span class="email-btn">Go to Lesson Room &rarr;</span>
      </div>

      <p style="color: #78716c; font-size: 10px; text-align: center; line-height: 1.4;">
        An updated calendar invitation (.ics) is attached to this email so your Google Calendar, Outlook, or Apple Calendar stays up to date.
      </p>

      <div class="email-footer">
        Gandharva School of Music &bull; Schedule Update Notification
      </div>
    </div>
  </div>

  <!-- ==================== TEMPLATE 6: CLASS CANCELLED ==================== -->
  <div class="page-break">
    <div class="section-title">
      <span class="section-num">6</span>
      <span>Template 6: Class Cancelled Notification</span>
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Trigger:</td>
        <td>Admin cancels class, or participant invokes <code>cancelLessonAction</code></td>
        <td class="label">Parties Notified:</td>
        <td>Both Student and Teacher simultaneously</td>
      </tr>
      <tr>
        <td class="label">Subject:</td>
        <td colspan="3"><code>Lesson Cancelled: [Discipline] with [Teacher/Student Name]</code></td>
      </tr>
      <tr>
        <td class="label">Business Rule:</td>
        <td colspan="3">Student balance is preserved; cancellation reason is prominently logged</td>
      </tr>
    </table>

    <div class="email-mockup" style="border-color: #FED7AA;">
      <div class="email-brand-header">
        <div class="email-brand-name">Gandharva</div>
        <div class="email-brand-sub">School of Music</div>
        <div class="email-subject-line" style="color: #EA580C;">Class Cancelled</div>
      </div>

      <p style="font-size: 11px; color: #374151; margin-top: 6px;">
        Hello <strong>Rohan Mehta</strong>, your upcoming music class with <strong>Ananya Sharma</strong> has been cancelled by <strong>Academy Administration</strong>.
      </p>

      <div class="email-details-box">
        <p><strong>Discipline / Course:</strong> Carnatic Vocals (Beginner Foundation)</p>
        <p><strong>Instructor:</strong> Ananya Sharma</p>
        <p><strong>Scheduled Time:</strong> Thursday, November 12, 2026 at 7:00 PM EST</p>
        <p style="font-size: 10px; color: #78716c;">(IST: Nov 13, 2026 at 5:30 AM IST)</p>
        <p><strong>Cancelled By:</strong> Academy Administration (admin)</p>
        <p style="margin: 6px 0 0 0; font-size: 10.5px; color: #9A3412;">
          <strong>Reason:</strong> Instructor attending annual university masterclass examination.
        </p>
        <p style="margin: 4px 0 0 0; font-size: 9.5px; color: #a8a29e; font-family: monospace;">Session Code: S0012-SE004</p>
      </div>

      <p style="color: #57534e; font-size: 10.5px; margin: 10px 0; line-height: 1.4;">
        Your class credit remains protected. You can browse other available slots or view your dashboard anytime to schedule your next session.
      </p>

      <div style="text-align: center; margin: 12px 0;">
        <span class="email-btn">Go to Student Dashboard &rarr;</span>
      </div>

      <div class="email-footer">
        Gandharva School of Music &bull; Cancellation Alert
      </div>
    </div>
  </div>

  <!-- ==================== TEMPLATE 7: CHAT NEW MESSAGE ==================== -->
  <div class="page-break">
    <div class="section-title">
      <span class="section-num">7</span>
      <span>Template 7: Chat New Message Notification</span>
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Trigger:</td>
        <td>Direct message sent, or message posted in live classroom when partner hasn't joined</td>
        <td class="label">Security:</td>
        <td>Strict PII filter active (phone/email links restricted)</td>
      </tr>
      <tr>
        <td class="label">Subject:</td>
        <td colspan="3"><code>💬 New Message from [Sender Name] on Gandharva Music</code></td>
      </tr>
      <tr>
        <td class="label">Call to Action:</td>
        <td colspan="3">Direct route to <code>/lesson/[lessonId]</code> or <code>/messages?conversationId=[id]</code></td>
      </tr>
    </table>

    <div class="email-mockup" style="border-color: #E9D5FF;">
      <div class="email-brand-header">
        <div class="email-brand-name">Gandharva</div>
        <div class="email-brand-sub">School of Music</div>
        <div class="email-subject-line" style="color: #7B2CBF;">New Message Received</div>
      </div>

      <p style="font-size: 11px; color: #374151; margin-top: 6px;">
        Hello <strong>Rohan Mehta</strong>, you have received a new message from <strong>Ananya Sharma</strong> (teacher):
      </p>

      <div style="background-color: #FAF5FF; border: 1px solid #E9D5FF; border-left: 4px solid #7B2CBF; border-radius: 8px; padding: 12px 14px; margin: 12px 0;">
        <div style="font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #7B2CBF; font-weight: bold; margin-bottom: 4px;">
          Message from Ananya Sharma:
        </div>
        <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #2E1065; font-style: italic;">
          &ldquo;I am waiting in the live classroom with the tanpura drone ready. Please join whenever you are ready!&rdquo;
        </p>
      </div>

      <div style="text-align: center; margin: 14px 0 10px 0;">
        <span class="email-btn">Open Live Classroom &amp; Reply &rarr;</span>
      </div>

      <p style="color: #a8a29e; font-size: 9.5px; text-align: center; line-height: 1.4; margin-top: 8px;">
        Personal contact details and external links remain restricted in chat for safety.
      </p>

      <div class="email-footer">
        Gandharva School of Music &bull; Messaging Notification
      </div>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 9.5px; color: #888; border-top: 1px solid #ECECEC; padding-top: 14px;">
      <strong>End of Specification &bull; Gandharva School of Music Notification Templates &bull; Authorized Release</strong>
    </div>
  </div>

</body>
</html>
`;

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const tempHtmlPath = path.join(rootDir, "email_templates_documentation.html");
  const outputPdfPath = path.join(rootDir, "Gandharva_Email_Notification_Templates.pdf");
  const tempProfileDir = path.join(process.env.TEMP || "C:\\temp", "edge-email-pdf-" + Date.now());

  fs.writeFileSync(tempHtmlPath, htmlContent, "utf8");
  console.log("HTML email documentation generated at:", tempHtmlPath);

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

  const psCommand = `powershell -NoProfile -Command "Start-Process -FilePath '${edgePath}' -ArgumentList '--headless', '--disable-gpu', '--user-data-dir=${tempProfileDir}', '--print-to-pdf=${outputPdfPath}', '${tempHtmlPath}' -Wait"`;

  console.log("Running headless Edge to render high-fidelity PDF...");
  execSync(psCommand, { stdio: "inherit" });

  if (fs.existsSync(outputPdfPath)) {
    const publicDir = path.join(rootDir, "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const publicPdfPath = path.join(publicDir, "Gandharva_Email_Notification_Templates.pdf");
    fs.copyFileSync(outputPdfPath, publicPdfPath);

    const stats = fs.statSync(outputPdfPath);
    console.log(`\nSUCCESS: PDF Generated Successfully!`);
    console.log(`Path: ${outputPdfPath}`);
    console.log(`Public Path: ${publicPdfPath}`);
    console.log(`File Size: ${(stats.size / 1024).toFixed(1)} KB`);
  } else {
    console.error("PDF generation failed: Output file not found.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Error generating PDF:", err);
  process.exit(1);
});
