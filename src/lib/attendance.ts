import { Prisma, LessonStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";

export interface AttendanceSession {
  id: string;
  userId: string;
  userRole: "TEACHER" | "STUDENT";
  userName?: string;
  joinedAt: string; // ISO string
  leftAt: string | null; // ISO string or null if currently in room
  durationSeconds?: number;
}

export interface ParsedAttendanceResult {
  teacherSessions: {
    id: string;
    joinedAt: string;
    leftAt: string | null;
    formattedJoined: string;
    formattedLeft: string;
    durationSeconds: number;
    isActive: boolean;
  }[];
  studentSessions: {
    id: string;
    joinedAt: string;
    leftAt: string | null;
    formattedJoined: string;
    formattedLeft: string;
    durationSeconds: number;
    isActive: boolean;
  }[];
  totalTeacherDurationSeconds: number;
  totalStudentDurationSeconds: number;
  overlapDurationSeconds: number;
  primaryTeacherJoinedAt: string | null;
  primaryTeacherLeftAt: string | null;
  primaryStudentJoinedAt: string | null;
  primaryStudentLeftAt: string | null;
}

/**
 * Record a participant entering the classroom (supports multiple joins).
 */
export async function recordParticipantJoin(params: {
  lessonId: string;
  userId: string;
  userRole: "TEACHER" | "STUDENT";
  userName?: string;
}): Promise<void> {
  const { lessonId, userId, userRole, userName } = params;
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    await db.$transaction(async tx => {
      // Serialize changes to the shared attendance array across both participants.
      await tx.$queryRaw`SELECT id FROM "Lesson" WHERE id = ${lessonId} FOR UPDATE`;
      const lesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        select: {
          id: true,
          teacherJoinedAt: true,
          studentJoinedAt: true,
          attendanceLogs: true,
        },
      });

      if (!lesson) return;

      let sessions: AttendanceSession[] = [];
      if (Array.isArray(lesson.attendanceLogs)) {
        sessions = (lesson.attendanceLogs as unknown as AttendanceSession[]).filter(
          (s) => s && typeof s.joinedAt === "string",
        );
      }

      // Check for open session for this user
      const existingOpenIdx = sessions.findIndex(
        (s) => s.userRole === userRole && s.leftAt === null,
      );

      if (existingOpenIdx !== -1) {
        // User is already marked active in an open session.
        // If joined very recently (< 45s), ignore redundant ping from concurrent token & webhook.
        const openSession = sessions[existingOpenIdx];
        const timeSinceOpen = now.getTime() - new Date(openSession.joinedAt).getTime();
        if (timeSinceOpen < 45_000) {
          return;
        }
        // If previous session was left open for hours, close it and open fresh
        openSession.leftAt = nowIso;
        openSession.durationSeconds = Math.max(
          0,
          Math.round((now.getTime() - new Date(openSession.joinedAt).getTime()) / 1000),
        );
      }

      // Append new active session
      const newSessionId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sessions.push({
        id: newSessionId,
        userId,
        userRole,
        userName,
        joinedAt: nowIso,
        leftAt: null,
        durationSeconds: 0,
      });

      const updateData: Record<string, unknown> = {
        attendanceLogs: sessions as unknown as Prisma.InputJsonValue,
      };

      if (userRole === "TEACHER") {
        if (!lesson.teacherJoinedAt) {
          updateData.teacherJoinedAt = now;
        }
        updateData.teacherLeftAt = null;
      } else {
        if (!lesson.studentJoinedAt) {
          updateData.studentJoinedAt = now;
        }
        updateData.studentLeftAt = null;
      }

      await tx.lesson.update({
        where: { id: lessonId },
        data: updateData,
      });
    });

    try {
      revalidateTag("admin-recordings", "max");
      revalidateTag("admin-lessons", "max");
    } catch {}

    logger.info(
      { lessonId, userId, userRole },
      "Recorded participant room join in attendance session log",
    );
  } catch (err) {
    logger.warn({ err, lessonId, userId }, "Failed to record participant join");
  }
}

/**
 * Record a participant leaving the classroom.
 */
export async function recordParticipantLeave(params: {
  lessonId: string;
  userId: string;
  userRole: "TEACHER" | "STUDENT";
}): Promise<void> {
  const { lessonId, userId, userRole } = params;
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    await db.$transaction(async tx => {
      // Serialize changes to the shared attendance array across both participants.
      await tx.$queryRaw`SELECT id FROM "Lesson" WHERE id = ${lessonId} FOR UPDATE`;
      const lesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        select: {
          id: true,
          attendanceLogs: true,
          teacherJoinedAt: true, teacherLeftAt: true, studentJoinedAt: true, studentLeftAt: true,
        },
      });

      if (!lesson) return;

      let sessions: AttendanceSession[] = [];
      if (Array.isArray(lesson.attendanceLogs)) {
        sessions = (lesson.attendanceLogs as unknown as AttendanceSession[]).filter(
          (s) => s && typeof s.joinedAt === "string",
        );
      }

      // Close any open sessions for this user
      let changed = false;
      for (const session of sessions) {
        if (session.userRole === userRole && session.leftAt === null) {
          session.leftAt = nowIso;
          session.durationSeconds = Math.max(
            0,
            Math.round((now.getTime() - new Date(session.joinedAt).getTime()) / 1000),
          );
          changed = true;
        }
      }

      const joined = userRole === "TEACHER" ? lesson.teacherJoinedAt : lesson.studentJoinedAt;
      const left = userRole === "TEACHER" ? lesson.teacherLeftAt : lesson.studentLeftAt;
      if (!changed && (!joined || left)) return;
      const updateData: Record<string, unknown> = {
        ...(userRole === "TEACHER" ? { teacherLeftAt: now } : { studentLeftAt: now }),
      };

      if (changed) {
        updateData.attendanceLogs = sessions as unknown as Prisma.InputJsonValue;
      }

      await tx.lesson.update({
        where: { id: lessonId },
        data: updateData,
      });
    });

    try {
      revalidateTag("admin-recordings", "max");
      revalidateTag("admin-lessons", "max");
    } catch {}

    logger.info(
      { lessonId, userId, userRole },
      "Recorded participant room exit in attendance session log",
    );
  } catch (err) {
    logger.warn({ err, lessonId, userId }, "Failed to record participant exit");
  }
}

/**
 * Computes exact cumulative time and overlapping co-presence across all join/exit intervals.
 */
export function parseAttendanceLogs(
  rawLogs: unknown,
  fallback: {
    teacherJoinedAt?: Date | null;
    teacherLeftAt?: Date | null;
    studentJoinedAt?: Date | null;
    studentLeftAt?: Date | null;
    timezone?: string;
    status: string;
    roomClosesAt: Date;
  },
  formatFn: (date: Date, fmt: string) => string,
): ParsedAttendanceResult {
  let sessions: AttendanceSession[] = [];
  if (Array.isArray(rawLogs)) {
    sessions = (rawLogs as unknown as AttendanceSession[]).filter(
      (s) => s && typeof s.joinedAt === "string",
    );
  }

  // Older lessons may only have summary timestamps for one participant.
  function addLegacy(role: AttendanceSession["userRole"], joined?: Date | null, left?: Date | null) {
    if (!joined || sessions.some(s => s.userRole === role)) return;
    sessions.push({ id: `legacy_${role.toLowerCase()}`, userId: role, userRole: role,
      joinedAt: joined.toISOString(), leftAt: left?.toISOString() ?? null });
  }
  addLegacy("TEACHER", fallback.teacherJoinedAt, fallback.teacherLeftAt);
  addLegacy("STUDENT", fallback.studentJoinedAt, fallback.studentLeftAt);

  const now = Date.now();
  const roomEnd = fallback.roomClosesAt.getTime();
  const archived = fallback.status === "COMPLETED" || fallback.status === "CANCELLED" || now > roomEnd;
  function visits(role: AttendanceSession["userRole"]) {
    const rows = sessions.filter(s => s.userRole === role && Number.isFinite(Date.parse(s.joinedAt)))
      .sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt));
    const roleExit = role === "TEACHER" ? fallback.teacherLeftAt : fallback.studentLeftAt;
    const lastEvent = rows.reduce((latest, s) => Math.max(latest, Date.parse(s.joinedAt), Date.parse(s.leftAt || "") || 0), 0);
    return rows.map((s, index) => {
      const start = Date.parse(s.joinedAt);
      const recorded = s.leftAt ? Date.parse(s.leftAt) : NaN;
      const nextJoin = rows[index + 1] ? Date.parse(rows[index + 1].joinedAt) : Infinity;
      const roleEnd = roleExit && roleExit.getTime() >= start ? roleExit.getTime() : Infinity;
      const isActive = !Number.isFinite(recorded) && !archived && nextJoin === Infinity && roleEnd === Infinity;
      const inferred = Math.min(nextJoin, roleEnd, roomEnd, now,
        archived && nextJoin === Infinity && roleEnd === Infinity ? lastEvent : Infinity);
      const end = Math.max(start, Number.isFinite(recorded) ? recorded : isActive ? now : inferred);
      const leftAt = isActive ? null : new Date(end).toISOString();
      const formattedEnd = formatFn(new Date(end), "h:mm:ss a");
      return {
        id: s.id, joinedAt: s.joinedAt, leftAt, isActive,
        formattedJoined: formatFn(new Date(start), "h:mm:ss a"),
        formattedLeft: isActive ? "Active in room" : Number.isFinite(recorded) ? formattedEnd : `Est. ${formattedEnd}`,
        durationSeconds: Math.round((end - start) / 1000),
      };
    });
  }
  const teacherSessions = visits("TEACHER");
  const studentSessions = visits("STUDENT");
  function uniqueSeconds(rows: typeof teacherSessions) {
    let coveredUntil = 0;
    let milliseconds = 0;
    for (const row of rows) {
      const end = row.leftAt ? Date.parse(row.leftAt) : now;
      milliseconds += Math.max(0, end - Math.max(coveredUntil, Date.parse(row.joinedAt)));
      coveredUntil = Math.max(coveredUntil, end);
    }
    return Math.round(milliseconds / 1000);
  }
  const totalTeacherDurationSeconds = uniqueSeconds(teacherSessions);
  const totalStudentDurationSeconds = uniqueSeconds(studentSessions);

  // Compute exact mutual overlap across all sessions
  interface Interval {
    start: number;
    end: number;
  }
  const overlapIntervals: Interval[] = [];

  for (const t of teacherSessions) {
    const tStart = new Date(t.joinedAt).getTime();
    const tEnd = t.leftAt ? new Date(t.leftAt).getTime() : now;

    for (const s of studentSessions) {
      const sStart = new Date(s.joinedAt).getTime();
      const sEnd = s.leftAt ? new Date(s.leftAt).getTime() : now;

      const oStart = Math.max(tStart, sStart);
      const oEnd = Math.min(tEnd, sEnd);

      if (oEnd > oStart) {
        overlapIntervals.push({ start: oStart, end: oEnd });
      }
    }
  }

  // Merge overlapping intervals to prevent double-counting
  overlapIntervals.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const curr of overlapIntervals) {
    if (merged.length === 0) {
      merged.push({ ...curr });
    } else {
      const prev = merged[merged.length - 1];
      if (curr.start <= prev.end) {
        prev.end = Math.max(prev.end, curr.end);
      } else {
        merged.push({ ...curr });
      }
    }
  }

  const overlapDurationSeconds = merged.reduce(
    (acc, curr) => acc + Math.round((curr.end - curr.start) / 1000),
    0,
  );

  const primaryTeacherJoinedAt =
    teacherSessions.length > 0 ? teacherSessions[0].joinedAt : null;
  const primaryTeacherLeftAt =
    teacherSessions.length > 0
      ? teacherSessions[teacherSessions.length - 1].leftAt
      : null;
  const primaryStudentJoinedAt =
    studentSessions.length > 0 ? studentSessions[0].joinedAt : null;
  const primaryStudentLeftAt =
    studentSessions.length > 0
      ? studentSessions[studentSessions.length - 1].leftAt
      : null;

  return {
    teacherSessions,
    studentSessions,
    totalTeacherDurationSeconds,
    totalStudentDurationSeconds,
    overlapDurationSeconds,
    primaryTeacherJoinedAt,
    primaryTeacherLeftAt,
    primaryStudentJoinedAt,
    primaryStudentLeftAt,
  };
}

/**
 * Automatically resolves past scheduled or rescheduled lessons whose scheduled window has concluded.
 *
 * Rules:
 * - Mark as COMPLETED only if:
 *   1) Both student and teacher joined (attendance session logs or join timestamps for both roles exist), OR
 *   2) Only the teacher joined, and the teacher stayed for at least 10 minutes (>= 600 seconds).
 * - Otherwise mark as CANCELLED (do NOT automatically mark as completed just because time has passed).
 */
export async function autoResolvePastLessons(): Promise<number> {
  const now = new Date();
  const pastLessons = await db.lesson.findMany({
    where: {
      status: { in: [LessonStatus.SCHEDULED, LessonStatus.RESCHEDULED] },
      startsAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
    },
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      teacherJoinedAt: true,
      teacherLeftAt: true,
      studentJoinedAt: true,
      studentLeftAt: true,
      attendanceLogs: true,
      status: true,
    },
    take: 100,
  });

  let resolvedCount = 0;

  for (const lesson of pastLessons) {
    const duration = lesson.durationMinutes || 60;
    const endsAt = new Date(lesson.startsAt.getTime() + duration * 60 * 1000);
    if (now.getTime() < endsAt.getTime() + 5 * 60 * 1000) {
      continue;
    }

    let teacherJoined = !!lesson.teacherJoinedAt;
    let studentJoined = !!lesson.studentJoinedAt;
    let teacherSeconds = 0;

    if (Array.isArray(lesson.attendanceLogs)) {
      const logs = lesson.attendanceLogs as unknown as AttendanceSession[];
      for (const log of logs) {
        if (log && typeof log === "object") {
          if (log.userRole === "TEACHER") {
            teacherJoined = true;
            if (typeof log.durationSeconds === "number" && log.durationSeconds > 0) {
              teacherSeconds += log.durationSeconds;
            } else if (log.joinedAt && log.leftAt) {
              const diff = (new Date(log.leftAt).getTime() - new Date(log.joinedAt).getTime()) / 1000;
              if (diff > 0) teacherSeconds += diff;
            }
          }
          if (log.userRole === "STUDENT") {
            studentJoined = true;
          }
        }
      }
    }

    if (teacherSeconds === 0 && lesson.teacherJoinedAt) {
      const exitTime = lesson.teacherLeftAt || endsAt;
      teacherSeconds = Math.max(0, (exitTime.getTime() - lesson.teacherJoinedAt.getTime()) / 1000);
    }

    const bothJoined = teacherJoined && studentJoined;
    const teacherTenMins = teacherJoined && teacherSeconds >= 600;

    if (bothJoined || teacherTenMins) {
      await db.lesson.update({
        where: { id: lesson.id },
        data: {
          status: LessonStatus.COMPLETED,
          teacherLeftAt: lesson.teacherLeftAt || now,
          studentLeftAt: studentJoined ? (lesson.studentLeftAt || now) : null,
        },
      });
    } else {
      await db.lesson.update({
        where: { id: lesson.id },
        data: {
          status: LessonStatus.CANCELLED,
          cancelledBy: "system_auto_resolve",
          cancelledAt: now,
        },
      });
    }
    resolvedCount++;
  }

  return resolvedCount;
}
