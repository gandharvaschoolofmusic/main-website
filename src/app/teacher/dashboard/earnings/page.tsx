import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { formatInViewerTimezone } from "@/lib/timezone";
import { getLessonTrackingId } from "@/lib/lesson-tracking";
import { TeacherPaymentManager, type TeacherPayoutItem } from "./TeacherPaymentManager";

export const metadata = {
  title: "Payment Management | Teacher Studio | Gandharva School of Music",
  description: "View session payout ledger, track paid vs unpaid sessions, and search by session ID.",
};

import { unstable_cache } from "next/cache";

const getCachedTeacherEarningsData = unstable_cache(
  async (userId: string) => {
    return db.user.findUnique({
      where: { id: userId },
      include: {
        teacherProfile: {
          include: {
            lessonsAsTeacher: {
              include: {
                student: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
                enrollment: {
                  include: {
                    course: {
                      select: { title: true },
                    },
                  },
                },
              },
              orderBy: { startsAt: "desc" },
              take: 100,
            },
          },
        },
      },
    });
  },
  ["teacher-earnings-data"],
  { revalidate: 30, tags: ["teacher-earnings", "teacher-lessons"] }
);

export default async function TeacherEarningsPage() {
  const user = await requireRole(Role.TEACHER);
  const teacherTimezone = user.timezone || "UTC";

  let dbUser: any = null;
  try {
    dbUser = await getCachedTeacherEarningsData(user.id);
  } catch (err) {
    console.error("Failed to load cached teacher earnings data:", err);
    dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        teacherProfile: {
          include: {
            lessonsAsTeacher: {
              include: {
                student: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
                enrollment: {
                  include: {
                    course: {
                      select: { title: true },
                    },
                  },
                },
              },
              orderBy: { startsAt: "desc" },
              take: 100,
            },
          },
        },
      },
    });
  }

  const profile = dbUser?.teacherProfile;
  const payoutPerSession = profile?.payoutPerSession || 80000;
  const payoutPerSessionRupees = payoutPerSession / 100;
  const lessons = profile?.lessonsAsTeacher || [];

  const initialItems: TeacherPayoutItem[] = lessons.map((l: any) => {
    const isPaid = l.payoutStatus === "PAID";
    const amountRupees = (l.payoutAmountMinor ? l.payoutAmountMinor : payoutPerSession) / 100;

    return {
      id: l.id,
      trackingCode: getLessonTrackingId(l),
      dateFormatted: formatInViewerTimezone(
        new Date(l.startsAt),
        teacherTimezone,
        "MMM d, yyyy 'at' h:mm a",
      ),
      studentName: l.student?.name || "Student",
      studentEmail: l.student?.email || "",
      courseOrTrial:
        l.lessonSource === "TRIAL"
          ? "Free Trial Lesson"
          : l.enrollment?.course?.title || "1:1 Course Session",
      lessonSource: l.lessonSource,
      duration: `${l.durationMinutes}m`,
      amountRupees,
      payoutStatus: isPaid ? "PAID" : "UNPAID",
      payoutPaidAtFormatted: l.payoutPaidAt
        ? formatInViewerTimezone(new Date(l.payoutPaidAt), teacherTimezone, "MMM d, yyyy")
        : null,
      payoutTransactionId: l.payoutTransactionId,
      payoutNotes: l.payoutNotes,
      lessonStatus: l.status,
    };
  });

  return (
    <TeacherPaymentManager
      initialItems={initialItems}
      payoutPerSessionRupees={payoutPerSessionRupees}
      teacherUpiId={profile?.upiId}
    />
  );
}
