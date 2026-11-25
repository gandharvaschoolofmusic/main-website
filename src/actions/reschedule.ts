"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { revalidatePath, updateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { formatToIST } from "@/lib/timezone";

class ReschedulePolicyError extends Error {}

// Retain closed tickets as the request ledger: resolving a request does not reset the allowance.
export async function requestStudentReschedule(input: { lessonId: string; reason: string; preferredSchedule: string }): Promise<{ success: boolean; error?: string; message?: string; remaining?: number | null; ticketId?: string }> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return { success: false, error: "Only students can send this request." };
    if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 2000 || typeof input.preferredSchedule !== "string" || input.preferredSchedule.length > 500) {
      return { success: false, error: "Enter a reason (up to 2,000 characters) and a preferred schedule (up to 500 characters)." };
    }
    const result = await db.$transaction(async tx => {
      // Serialize requests from multiple tabs/devices before reading the allowance.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const lesson = await tx.lesson.findFirst({ where: { id: input.lessonId, studentId: user.id }, include: { enrollment: { include: { course: true } } } });
      if (!lesson || !["SCHEDULED", "RESCHEDULED"].includes(lesson.status) || lesson.startsAt <= new Date()) {
        throw new ReschedulePolicyError("Only your upcoming scheduled classes can be requested for rescheduling.");
      }
      if (lesson.startsAt.getTime() - Date.now() < 6 * 60 * 60 * 1000) {
        throw new ReschedulePolicyError("Reschedule requests must be sent at least 6 hours before the lesson starts.");
      }
      const studentName = user.name?.trim() || "Student";
      const lessonTitle = lesson.enrollment?.course.title || lesson.instrument || "Music lesson";
      const currentClassTime = formatToIST(lesson.startsAt);
      const sessionReference = lesson.trackingCode || lesson.id;
      const preferredSchedule = input.preferredSchedule.trim() || "Please coordinate with me";
      const reason = input.reason.trim();
      const normalizedReason = reason.replace(/\s+/g, " ");
      const shortReason = normalizedReason.slice(0, 180);
      const reasonForNotification = shortReason.length < normalizedReason.length ? `${shortReason}…` : shortReason;
      const prefix = `Reschedule [${lesson.enrollmentId || `trial-${lesson.id}`}] `;
      const subject = `${prefix}${lesson.id} at ${lesson.startsAt.toISOString()}`;
      const existing = await tx.supportTicket.findFirst({ where: { userId: user.id, subject } });
      if (existing) throw new ReschedulePolicyError("A reschedule request has already been submitted for this class time. Check Support for its status.");
      const limit = lesson.enrollment?.course.sessionCount === 24 ? 6 : null;
      const used = await tx.supportTicket.count({ where: { userId: user.id, category: "LESSON", subject: { startsWith: prefix } } });
      if (limit !== null && used >= limit) throw new ReschedulePolicyError("You have used all 6 reschedule requests for this 24-class enrollment. Please attend your scheduled classes or contact administration.");
      const remaining = limit === null ? null : limit - used - 1;
      const allowance = remaining === null ? "" : ` You have ${remaining} of 6 reschedule requests remaining for this 24-class enrollment.`;
      const ticket = await tx.supportTicket.create({ data: {
        userId: user.id, subject, category: "LESSON", status: "OPEN",
        messages: { create: { senderId: user.id, senderRole: "STUDENT", body: `Please reschedule ${lessonTitle} (session ${sessionReference}). Current class: ${currentClassTime}.\nReason: ${reason}\nPreferred schedule: ${preferredSchedule}\nThe original class remains scheduled until administration confirms a change.${allowance}` } },
      } });
      const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await tx.notification.createMany({ data: [
        { userId: user.id, type: "SYSTEM" as const, title: "Reschedule request received", body: `Your ${lessonTitle} session ${sessionReference} on ${currentClassTime} is awaiting admin approval. Preferred time: ${preferredSchedule}.${allowance} Your original class remains scheduled until confirmed.`, link: `/student/dashboard/support/${ticket.id}` },
        ...admins.map(admin => ({
          userId: admin.id,
          type: "NEW_SUPPORT_TICKET" as const,
          title: `Session reschedule request from ${studentName}`,
          body: `${lessonTitle} · Session ${sessionReference} · Current: ${currentClassTime}. Preferred: ${preferredSchedule}. Reason: ${reasonForNotification}.${allowance}`,
          link: `/admin/support/${ticket.id}`,
        })),
      ] });
      return { success: true, remaining, ticketId: ticket.id, message: `Request sent to administration.${allowance} Your class remains scheduled until confirmed.` };
    });
    updateTag("admin-overview");
    updateTag("admin-support");
    revalidatePath("/admin/support");
    revalidatePath("/student/dashboard/support");
    return result;
  } catch (error) {
    logger.error({ error }, "Student reschedule request failed");
    return { success: false, error: error instanceof ReschedulePolicyError ? error.message : "Could not send your request. Please try again." };
  }
}
