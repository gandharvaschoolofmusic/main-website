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
    const lesson = await db.lesson.findUnique({
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
      (s) => s.userId === userId && s.leftAt === null,
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
      attendanceLogs: sessions as unknown as any,
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

    await db.lesson.update({
      where: { id: lessonId },
      data: updateData,
    });

    try {
      revalidateTag("admin-recordings", "max");
      revalidateTag("admin-lessons", "max");
    } catch {}

    logger.info(
      { lessonId, userId, userRole, sessionId: newSessionId },
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
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
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

    // Close any open sessions for this user
    let changed = false;
    for (const session of sessions) {
      if (session.userId === userId && session.leftAt === null) {
        session.leftAt = nowIso;
        session.durationSeconds = Math.max(
          0,
          Math.round((now.getTime() - new Date(session.joinedAt).getTime()) / 1000),
        );
        changed = true;
      }
    }

    const updateData: Record<string, unknown> = {
      ...(userRole === "TEACHER" ? { teacherLeftAt: now } : { studentLeftAt: now }),
    };

    if (changed) {
      updateData.attendanceLogs = sessions as unknown as any;
    }

    await db.lesson.update({
      where: { id: lessonId },
      data: updateData,
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
  },
  formatFn: (date: Date, fmt: string) => string,
): ParsedAttendanceResult {
  let sessions: AttendanceSession[] = [];
  if (Array.isArray(rawLogs)) {
    sessions = (rawLogs as unknown as AttendanceSession[]).filter(
      (s) => s && typeof s.joinedAt === "string",
    );
  }

  // Synthesize legacy sessions if logs are empty but joined/left timestamps exist
  if (sessions.length === 0) {
    if (fallback.teacherJoinedAt) {
      sessions.push({
        id: "legacy_teacher",
        userId: "teacher",
        userRole: "TEACHER",
        joinedAt: fallback.teacherJoinedAt.toISOString(),
        leftAt: fallback.teacherLeftAt ? fallback.teacherLeftAt.toISOString() : null,
        durationSeconds: fallback.teacherLeftAt
          ? Math.max(
              0,
              Math.round(
                (fallback.teacherLeftAt.getTime() - fallback.teacherJoinedAt.getTime()) / 1000,
              ),
            )
          : 0,
      });
    }
    if (fallback.studentJoinedAt) {
      sessions.push({
        id: "legacy_student",
        userId: "student",
        userRole: "STUDENT",
        joinedAt: fallback.studentJoinedAt.toISOString(),
        leftAt: fallback.studentLeftAt ? fallback.studentLeftAt.toISOString() : null,
        durationSeconds: fallback.studentLeftAt
          ? Math.max(
              0,
              Math.round(
                (fallback.studentLeftAt.getTime() - fallback.studentJoinedAt.getTime()) / 1000,
              ),
            )
          : 0,
      });
    }
  }

  const teacherSessions = sessions
    .filter((s) => s.userRole === "TEACHER")
    .map((s) => {
      const jDate = new Date(s.joinedAt);
      const lDate = s.leftAt ? new Date(s.leftAt) : null;
      const dur = lDate
        ? Math.max(0, Math.round((lDate.getTime() - jDate.getTime()) / 1000))
        : Math.max(0, Math.round((Date.now() - jDate.getTime()) / 1000));
      return {
        id: s.id,
        joinedAt: s.joinedAt,
        leftAt: s.leftAt,
        formattedJoined: formatFn(jDate, "h:mm:ss a"),
        formattedLeft: lDate ? formatFn(lDate, "h:mm:ss a") : "Active in room",
        durationSeconds: dur,
        isActive: s.leftAt === null,
      };
    });

  const studentSessions = sessions
    .filter((s) => s.userRole === "STUDENT")
    .map((s) => {
      const jDate = new Date(s.joinedAt);
      const lDate = s.leftAt ? new Date(s.leftAt) : null;
      const dur = lDate
        ? Math.max(0, Math.round((lDate.getTime() - jDate.getTime()) / 1000))
        : Math.max(0, Math.round((Date.now() - jDate.getTime()) / 1000));
      return {
        id: s.id,
        joinedAt: s.joinedAt,
        leftAt: s.leftAt,
        formattedJoined: formatFn(jDate, "h:mm:ss a"),
        formattedLeft: lDate ? formatFn(lDate, "h:mm:ss a") : "Active in room",
        durationSeconds: dur,
        isActive: s.leftAt === null,
      };
    });

  const totalTeacherDurationSeconds = teacherSessions.reduce(
    (acc, s) => acc + s.durationSeconds,
    0,
  );
  const totalStudentDurationSeconds = studentSessions.reduce(
    (acc, s) => acc + s.durationSeconds,
    0,
  );

  // Compute exact mutual overlap across all sessions
  interface Interval {
    start: number;
    end: number;
  }
  const overlapIntervals: Interval[] = [];

  for (const t of teacherSessions) {
    const tStart = new Date(t.joinedAt).getTime();
    const tEnd = t.leftAt ? new Date(t.leftAt).getTime() : Date.now();

    for (const s of studentSessions) {
      const sStart = new Date(s.joinedAt).getTime();
      const sEnd = s.leftAt ? new Date(s.leftAt).getTime() : Date.now();

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

