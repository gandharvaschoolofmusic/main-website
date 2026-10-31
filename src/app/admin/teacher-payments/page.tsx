import { Suspense } from "react";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role, LessonStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { formatInViewerTimezone } from "@/lib/timezone";
import { getLessonTrackingId } from "@/lib/lesson-tracking";
import {
  AdminTeacherPaymentsManager,
  AdminSessionPayoutItem,
} from "./AdminTeacherPaymentsManager";

export const metadata = {
  title: "Teacher Payments | Institutional Administration | Gandharva",
  description:
    "Manage teacher session payouts, disburse remuneration via UPI ID, and track completed session payment status.",
};

const getCachedAdminTeacherPaymentsData = unstable_cache(
  async (adminTimezone: string) => {
    const lessons = await db.lesson.findMany({
      where: {
        status: LessonStatus.COMPLETED,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teacherProfile: {
          select: {
            payoutPerSession: true,
            upiId: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        enrollment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { startsAt: "desc" },
    });

    const formattedSessions: AdminSessionPayoutItem[] = lessons.map((l) => {
      const isPaid = l.payoutStatus === "PAID";
      const payoutPerSessionMinor =
        l.teacherProfile?.payoutPerSession || 50000;
      const rateRupees = payoutPerSessionMinor / 100;
      const amountRupees = (l.payoutAmountMinor || payoutPerSessionMinor) / 100;

      return {
        id: l.id,
        trackingCode: getLessonTrackingId(l),
        startsAt: l.startsAt.toISOString(),
        dateFormatted: formatInViewerTimezone(
          l.startsAt,
          adminTimezone,
          "MMM d, yyyy 'at' h:mm a",
        ),
        durationMinutes: l.durationMinutes,
        lessonStatus: l.status,
        lessonSource: l.lessonSource,
        courseTitle:
          l.lessonSource === "TRIAL"
            ? "Free Trial Lesson"
            : l.enrollment?.course?.title || "1:1 Private Course Lesson",
        studentId: l.student.id,
        studentName: l.student.name || "Student",
        studentEmail: l.student.email,
        teacherId: l.teacher.id,
        teacherName: l.teacher.name || "Faculty Instructor",
        teacherEmail: l.teacher.email,
        teacherUpiId: l.teacherProfile?.upiId,
        payoutRateRupees: rateRupees,
        payoutStatus: isPaid ? "PAID" : "UNPAID",
        payoutPaidAtFormatted: l.payoutPaidAt
          ? formatInViewerTimezone(l.payoutPaidAt, adminTimezone, "MMM d, yyyy")
          : null,
        payoutTransactionId: l.payoutTransactionId,
        payoutNotes: l.payoutNotes,
        payoutAmountRupees: amountRupees,
      };
    });

    return formattedSessions;
  },
  ["admin-teacher-payments-data-v1"],
  { revalidate: 30, tags: ["admin-teacher-payments", "teacher-payments"] }
);

export default async function AdminTeacherPaymentsPage() {
  const admin = await requireRole(Role.ADMIN);
  const adminTimezone = admin.timezone || "Asia/Kolkata";

  let formattedSessions: AdminSessionPayoutItem[] = [];
  try {
    formattedSessions = await getCachedAdminTeacherPaymentsData(adminTimezone);
  } catch (err) {
    console.error("[AdminTeacherPaymentsPage] Failed to load cached teacher payments, using fallback:", err);
  }

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-body animate-pulse">
          Loading faculty session payments ledger...
        </div>
      }
    >
      <AdminTeacherPaymentsManager initialSessions={formattedSessions} />
    </Suspense>
  );
}
