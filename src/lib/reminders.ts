import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { LessonStatus, NotificationType } from "@prisma/client";
import {
  sendLessonReminderEmails,
  type LessonReminderWindow,
} from "@/lib/email";

export interface ReminderProcessingStats {
  checked: number;
  remindersSent: {
    "24h": number;
    "12h": number;
    "1h": number;
    "10m": number;
  };
  errors: number;
}

/**
 * Checks all upcoming classes and sends automated email & in-app reminders
 * for 24 hours, 12 hours, 1 hour, and 10 minutes before scheduled time.
 * Deduplicated via lesson.attendanceLogs.reminderLogs.
 */
export async function processUpcomingLessonReminders(): Promise<ReminderProcessingStats> {
  const stats: ReminderProcessingStats = {
    checked: 0,
    remindersSent: {
      "24h": 0,
      "12h": 0,
      "1h": 0,
      "10m": 0,
    },
    errors: 0,
  };

  try {
    const now = new Date();
    const nowMs = now.getTime();

    // Query active upcoming lessons starting between (now - 15m) and (now + 26 hours)
    const minSearch = new Date(nowMs - 15 * 60 * 1000);
    const maxSearch = new Date(nowMs + 26 * 60 * 60 * 1000);

    const lessons = await db.lesson.findMany({
      where: {
        status: { in: [LessonStatus.SCHEDULED, LessonStatus.RESCHEDULED] },
        startsAt: {
          gte: minSearch,
          lte: maxSearch,
        },
      },
      include: {
        student: {
          select: { id: true, name: true, email: true, timezone: true },
        },
        teacher: {
          select: { id: true, name: true, email: true, timezone: true },
        },
        enrollment: {
          include: {
            course: { select: { title: true, instrument: true } },
          },
        },
      },
    });

    stats.checked = lessons.length;

    for (const lesson of lessons) {
      if (!lesson.student?.email || !lesson.teacher?.email) {
        continue;
      }

      const diffMinutes = (lesson.startsAt.getTime() - nowMs) / 60000;

      // Extract existing reminder logs from attendanceLogs
      let attObj: Record<string, any> = {};
      if (
        typeof lesson.attendanceLogs === "object" &&
        lesson.attendanceLogs !== null &&
        !Array.isArray(lesson.attendanceLogs)
      ) {
        attObj = { ...lesson.attendanceLogs };
      } else if (Array.isArray(lesson.attendanceLogs)) {
        attObj = { sessions: lesson.attendanceLogs };
      }

      const reminderLogs: string[] = Array.isArray(attObj.reminderLogs)
        ? [...attObj.reminderLogs]
        : [];

      let windowToSend: LessonReminderWindow | null = null;
      let inAppTitle = "";
      let studentInAppBody = "";
      let teacherInAppBody = "";

      // 1. 10 Minutes Window: starting within 15 mins to -5 mins
      if (
        diffMinutes <= 15 &&
        diffMinutes >= -5 &&
        !reminderLogs.includes("10m")
      ) {
        windowToSend = "10m";
        inAppTitle = "Class Starting in 10 Minutes!";
        studentInAppBody = `Your ${lesson.instrument} class with ${lesson.teacher.name || "Instructor"} is starting now. Click to enter room!`;
        teacherInAppBody = `Your teaching session with ${lesson.student.name || "Student"} is starting now. Studio room is active.`;
      }
      // 2. 1 Hour Window: between 15m and 65m
      else if (
        diffMinutes <= 65 &&
        diffMinutes > 15 &&
        !reminderLogs.includes("1h")
      ) {
        windowToSend = "1h";
        inAppTitle = "Class in 1 Hour";
        studentInAppBody = `Get ready! Your ${lesson.instrument} lesson with ${lesson.teacher.name || "Instructor"} begins in 1 hour.`;
        teacherInAppBody = `Get ready! Teaching session with ${lesson.student.name || "Student"} begins in 1 hour.`;
      }
      // 3. 12 Hours Window: between 65m and 750m (12.5 hrs)
      else if (
        diffMinutes <= 750 &&
        diffMinutes > 65 &&
        !reminderLogs.includes("12h")
      ) {
        windowToSend = "12h";
        inAppTitle = "Class in 12 Hours";
        studentInAppBody = `Reminder: Your ${lesson.instrument} lesson with ${lesson.teacher.name || "Instructor"} is coming up in 12 hours today.`;
        teacherInAppBody = `Reminder: You have a scheduled teaching session with ${lesson.student.name || "Student"} in 12 hours today.`;
      }
      // 4. 24 Hours Window: between 750m and 1470m (24.5 hrs)
      else if (
        diffMinutes <= 1470 &&
        diffMinutes > 750 &&
        !reminderLogs.includes("24h")
      ) {
        windowToSend = "24h";
        inAppTitle = "Class Tomorrow (24 Hours)";
        studentInAppBody = `Reminder: Your 1-on-1 ${lesson.instrument} class with ${lesson.teacher.name || "Instructor"} is scheduled for tomorrow.`;
        teacherInAppBody = `Reminder: You have a scheduled teaching session with ${lesson.student.name || "Student"} tomorrow.`;
      }

      if (windowToSend) {
        try {
          // Dispatch email notification to both student and teacher
          await sendLessonReminderEmails({
            lessonId: lesson.id,
            trackingCode: lesson.trackingCode,
            instrument: lesson.instrument,
            courseTitle: lesson.enrollment?.course?.title || null,
            startsAt: lesson.startsAt,
            durationMinutes: lesson.durationMinutes,
            window: windowToSend,
            student: {
              name: lesson.student.name || "Student",
              email: lesson.student.email,
              timezone: lesson.student.timezone || "Asia/Kolkata",
            },
            teacher: {
              name: lesson.teacher.name || "Teacher",
              email: lesson.teacher.email,
              timezone: lesson.teacher.timezone || "Asia/Kolkata",
            },
          });

          // Create in-app notifications
          await db.notification.createMany({
            data: [
              {
                userId: lesson.studentId,
                type: NotificationType.LESSON_REMINDER,
                title: inAppTitle,
                body: studentInAppBody,
                link: `/lesson/${lesson.id}`,
              },
              {
                userId: lesson.teacherId,
                type: NotificationType.LESSON_REMINDER,
                title: inAppTitle,
                body: teacherInAppBody,
                link: `/lesson/${lesson.id}`,
              },
            ],
          });

          // Mark reminder window as sent
          reminderLogs.push(windowToSend);
          attObj.reminderLogs = reminderLogs;

          await db.lesson.update({
            where: { id: lesson.id },
            data: {
              attendanceLogs: attObj as any,
            },
          });

          stats.remindersSent[windowToSend]++;
        } catch (itemErr) {
          stats.errors++;
          logger.error(
            { itemErr, lessonId: lesson.id, windowToSend },
            "Failed to dispatch lesson reminder",
          );
        }
      }
    }
  } catch (err) {
    stats.errors++;
    logger.error({ err }, "Fatal error processing lesson reminders");
  }

  return stats;
}

