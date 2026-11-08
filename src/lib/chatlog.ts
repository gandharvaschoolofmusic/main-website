import { formatInViewerTimezone } from "@/lib/timezone";

export interface LessonChatMessageItem {
  id: string;
  senderId?: string;
  senderName: string;
  senderRole?: "TEACHER" | "STUDENT" | "ADMIN" | "SYSTEM" | string;
  message: string;
  timestamp: string; // ISO 8601 string
}

export interface AttendanceSessionTimeline {
  id: string;
  joinedAt: string;
  leftAt: string | null;
  formattedJoined?: string;
  formattedLeft?: string;
  durationSeconds?: number;
}

export interface GenerateChatlogOptions {
  sessionCode: string;
  sessionNumber?: number;
  courseTitle?: string | null;
  instrument?: string | null;
  startsAt: string | Date;
  status: string;
  teacherName: string;
  teacherEmail?: string | null;
  studentName: string;
  studentEmail?: string | null;
  teacherDurationSeconds?: number | null;
  studentDurationSeconds?: number | null;
  overlapDurationSeconds?: number | null;
  teacherSessions?: AttendanceSessionTimeline[];
  studentSessions?: AttendanceSessionTimeline[];
  chatLogs?: LessonChatMessageItem[] | null;
  timezone?: string;
}

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function generateChatlogText(options: GenerateChatlogOptions): string {
  const {
    sessionCode,
    sessionNumber,
    courseTitle,
    instrument,
    startsAt,
    status,
    teacherName,
    teacherEmail,
    studentName,
    studentEmail,
    teacherDurationSeconds,
    studentDurationSeconds,
    overlapDurationSeconds,
    teacherSessions = [],
    studentSessions = [],
    chatLogs = [],
    timezone = "Asia/Kolkata",
  } = options;

  const startDate = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const formattedScheduled = !isNaN(startDate.getTime())
    ? formatInViewerTimezone(startDate, timezone, "EEEE, MMMM d, yyyy 'at' h:mm a zzz")
    : String(startsAt);
  const generationTimestamp = formatInViewerTimezone(new Date(), timezone, "MMMM d, yyyy 'at' h:mm:ss a zzz");

  const lines: string[] = [];

  lines.push("================================================================================");
  lines.push("              GANDHARVA SCHOOL OF MUSIC - CLASSROOM CHATLOG ARCHIVE             ");
  lines.push("================================================================================");
  lines.push("");
  lines.push(`Session Tracking Code:   ${sessionCode}`);
  if (sessionNumber) {
    lines.push(`Class Session:           Class #${sessionNumber}`);
  }
  if (courseTitle) {
    lines.push(`Course:                  ${courseTitle}`);
  }
  if (instrument) {
    lines.push(`Discipline / Instrument: ${instrument}`);
  }
  lines.push(`Scheduled Date & Time:   ${formattedScheduled}`);
  lines.push(`Session Status:          ${status}`);
  lines.push(`Log Generated At:        ${generationTimestamp}`);
  lines.push("");
  lines.push("--------------------------------------------------------------------------------");
  lines.push("PARTICIPANTS");
  lines.push("--------------------------------------------------------------------------------");
  lines.push(`Faculty Instructor:      ${teacherName}${teacherEmail ? ` <${teacherEmail}>` : ""}`);
  lines.push(`Student:                 ${studentName}${studentEmail ? ` <${studentEmail}>` : ""}`);
  lines.push("");

  lines.push("--------------------------------------------------------------------------------");
  lines.push("ATTENDANCE & ACTIVITY TIMESTAMPS");
  lines.push("--------------------------------------------------------------------------------");
  lines.push(
    `• Instructor Total Time in Room: ${formatDurationSeconds(teacherDurationSeconds)} (${teacherSessions.length} join${
      teacherSessions.length === 1 ? "" : "s"
    })`,
  );
  if (teacherSessions.length > 0) {
    teacherSessions.forEach((s, idx) => {
      const joinStr =
        s.formattedJoined ||
        (s.joinedAt ? formatInViewerTimezone(new Date(s.joinedAt), timezone, "h:mm:ss a") : "—");
      const leftStr =
        s.formattedLeft ||
        (s.leftAt ? formatInViewerTimezone(new Date(s.leftAt), timezone, "h:mm:ss a") : "In Room / Est.");
      const dur = formatDurationSeconds(s.durationSeconds);
      lines.push(`    [Join #${idx + 1}]  ${joinStr} -> ${leftStr}  (${dur})`);
    });
  } else {
    lines.push("    (No instructor room join events recorded)");
  }

  lines.push("");
  lines.push(
    `• Student Total Time in Room:    ${formatDurationSeconds(studentDurationSeconds)} (${studentSessions.length} join${
      studentSessions.length === 1 ? "" : "s"
    })`,
  );
  if (studentSessions.length > 0) {
    studentSessions.forEach((s, idx) => {
      const joinStr =
        s.formattedJoined ||
        (s.joinedAt ? formatInViewerTimezone(new Date(s.joinedAt), timezone, "h:mm:ss a") : "—");
      const leftStr =
        s.formattedLeft ||
        (s.leftAt ? formatInViewerTimezone(new Date(s.leftAt), timezone, "h:mm:ss a") : "In Room / Est.");
      const dur = formatDurationSeconds(s.durationSeconds);
      lines.push(`    [Join #${idx + 1}]  ${joinStr} -> ${leftStr}  (${dur})`);
    });
  } else {
    lines.push("    (No student room join events recorded)");
  }

  lines.push("");
  lines.push(
    `• Mutual Co-Presence Time:       ${formatDurationSeconds(overlapDurationSeconds)} (both teacher and student present together)`,
  );
  lines.push("");

  lines.push("================================================================================");
  lines.push("CLASSROOM CHAT LOG (TIMESTAMPS INCLUDED)");
  lines.push("================================================================================");
  lines.push("");

  const safeLogs = Array.isArray(chatLogs) ? chatLogs : [];
  if (safeLogs.length === 0) {
    lines.push("[No text chat messages were dispatched during this session]");
    lines.push("Classroom instruction and interaction were conducted via live two-way WebRTC audio and video streaming.");
  } else {
    safeLogs.forEach((msg, idx) => {
      const msgDate = new Date(msg.timestamp);
      const timeStr = !isNaN(msgDate.getTime())
        ? formatInViewerTimezone(msgDate, timezone, "hh:mm:ss a")
        : msg.timestamp;
      const roleLabel = msg.senderRole ? ` [${msg.senderRole}]` : "";
      lines.push(`[${timeStr}] ${msg.senderName}${roleLabel}:`);
      lines.push(`  ${msg.message}`);
      if (idx < safeLogs.length - 1) {
        lines.push("");
      }
    });
  }

  lines.push("");
  lines.push("================================================================================");
  lines.push("                         END OF SESSION CHATLOG TRANSCRIPT                      ");
  lines.push("================================================================================");

  return lines.join("\r\n");
}

export function triggerDownload(filename: string, textContent: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
