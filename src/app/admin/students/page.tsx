import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role, LessonStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getResilientData, getLastKnownGood } from "@/lib/db-resilience";
import {
  AdminStudentsManager,
  StudentRecord,
} from "./AdminStudentsManager";
import { isStudentInActiveTrialPeriod } from "@/lib/student-filters";
import { autoResolvePastLessons } from "@/lib/attendance";

export const metadata = {
  title: "Students | Admin Portal | Gandharva School of Music",
  description: "Directory, learning records, billing context, and complete student timeline.",
};

const getCachedAdminStudentsData = unstable_cache(
  async () => {
    return getResilientData("admin-students-v5", async () => {
    // 0. Auto-resolve concluded lessons based on verified attendance
    try {
      await autoResolvePastLessons();
    } catch (e) {
      console.warn("[getCachedAdminStudentsData] auto-resolve failed:", e);
    }

    // Run ALL queries in parallel for maximum speed
    const [dbStudents, dbCourses, dbTeachers] = await Promise.all([
      // 1. Fetch students with trimmed relational data
      db.user.findMany({
        where: { role: Role.STUDENT },
        include: {
          enrollments: {
            include: {
              payments: {
                select: {
                  id: true,
                  amountMinorUnits: true,
                  status: true,
                  createdAt: true,
                },
              },
              payment: {
                select: {
                  id: true,
                  amountMinorUnits: true,
                  status: true,
                },
              },
              course: {
                include: {
                  teachers: {
                    include: {
                      teacher: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { startedAt: "desc" },
          },
          lessonsAsStudent: {
            include: {
              teacher: {
                select: { name: true },
              },
            },
            orderBy: { startsAt: "asc" },
            take: 100,
          },
          payments: {
            include: {
              enrollment: {
                include: {
                  course: {
                    select: { title: true },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 20, // Reduced from 100
          },
          resourcesReceived: {
            include: {
              resource: {
                include: {
                  teacher: {
                    select: { name: true },
                  },
                },
              },
              course: {
                select: { title: true },
              },
            },
            orderBy: { sharedAt: "desc" },
            take: 15, // Reduced from 50
          },
          trialStatus: true,
          trialRequestsAsStudent: {
            include: {
              allottedLesson: {
                select: {
                  id: true,
                  status: true,
                  startsAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          notifications: {
            orderBy: { createdAt: "desc" },
            take: 10, // Reduced from 50
          },
          // Only load conversation metadata — messages loaded on-demand
          conversationsAsStudent: {
            include: {
              teacher: {
                select: { id: true, name: true, email: true },
              },
              _count: {
                select: { messages: true },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 10, // Only recent conversations
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // 2. Fetch active courses for enrollment modal
      db.course.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          instrument: true,
          level: true,
          sessionCount: true,
          priceMinorUnits: true,
        },
        orderBy: { title: "asc" },
      }),

      // 3. Fetch teachers for scheduling modal
      db.user.findMany({
        where: { role: Role.TEACHER, isActive: true },
        select: {
          id: true,
          name: true,
          teacherProfile: {
            select: { instruments: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // Format student records cleanly for client state
    const formattedStudents: StudentRecord[] = dbStudents.map((s) => {
      const formattedEnrollments = s.enrollments.map((e) => {
        const assignedTeacher =
          e.course.teachers[0]?.teacher?.name || null;

        const feeRupees = Math.round(
          ((e.customFeeMinorUnits ?? e.course.priceMinorUnits) || 0) / 100
        );

        // Sum all paid payments linked to this enrollment (from enrollment payments relation or primary payment)
        const paidPaymentIds = new Set<string>();
        let paidMinor = 0;
        for (const p of e.payments || []) {
          if (p.status === "PAID") {
            paidPaymentIds.add(p.id);
            paidMinor += p.amountMinorUnits;
          }
        }
        if (e.payment && e.payment.status === "PAID" && !paidPaymentIds.has(e.payment.id)) {
          paidPaymentIds.add(e.payment.id);
          paidMinor += e.payment.amountMinorUnits;
        }

        const totalPaidRupees = Math.round(paidMinor / 100);

        const outstandingRupees =
          e.status === "CANCELLED" || e.emiStatus === "FULLY_PAID"
            ? 0
            : Math.max(0, feeRupees - totalPaidRupees);

        return {
          id: e.id,
          courseId: e.courseId,
          courseTitle: e.course.title,
          courseLevel: e.course.level,
          courseInstrument: e.course.instrument,
          teacherName: assignedTeacher,
          sessionsRemaining: e.sessionsRemaining,
          totalSessions: e.course.sessionCount,
          status: e.status,
          startedAt: e.startedAt.toISOString(),
          feeRupees,
          totalPaidRupees,
          outstandingRupees,
          emiStatus: e.emiStatus,
          paymentPlan: e.paymentPlan,
        };
      });

      // Total outstanding dues for student = active enrollment dues + unlinked CREATED payments - unlinked PAID payments
      const enrollmentDues = formattedEnrollments
        .filter((e) => e.status !== "CANCELLED")
        .reduce((sum, e) => sum + e.outstandingRupees, 0);

      const unlinkedCreatedRupees = s.payments
        .filter((p) => p.status === "CREATED" && !p.enrollmentId)
        .reduce((sum, p) => sum + Math.round(p.amountMinorUnits / 100), 0);

      const unlinkedPaidRupees = s.payments
        .filter((p) => p.status === "PAID" && !p.enrollmentId)
        .reduce((sum, p) => sum + Math.round(p.amountMinorUnits / 100), 0);

      const totalOutstandingRupees = Math.max(
        0,
        enrollmentDues + unlinkedCreatedRupees - unlinkedPaidRupees
      );

      return {
        id: s.id,
        customId: s.customId || null,
        name: s.name || "Student",
        email: s.email,
        phone: s.phone,
        country: s.country,
        timezone: s.timezone || "Asia/Kolkata",
        guardianName: s.guardianName,
        guardianPhone: s.guardianPhone,
        age: s.age,
        gender: s.gender,
        address: s.address,
        createdAt: s.createdAt.toISOString(),
        isActive: s.isActive,
        outstandingRupees: totalOutstandingRupees,
        enrollments: formattedEnrollments,
        lessons: s.lessonsAsStudent.map((l) => ({
          id: l.id,
          instrument: l.instrument,
          startsAt: l.startsAt.toISOString(),
          durationMinutes: l.durationMinutes,
          status: l.status,
          teacherName: l.teacher?.name || null,
          trackingCode: l.trackingCode,
          recordingUrl: l.recordingUrl,
        })),
        payments: s.payments.map((p) => ({
          id: p.id,
          enrollmentId: p.enrollmentId || null,
          amountRupees: Math.round(p.amountMinorUnits / 100),
          status: p.status,
          gateway: p.gateway,
          gatewayPaymentId: p.gatewayPaymentId,
          notes: p.notes,
          courseTitle: p.enrollment?.course?.title || null,
          createdAt: p.createdAt.toISOString(),
        })),
        resources: s.resourcesReceived.map((r) => ({
        id: r.id,
        title: r.resource.title,
        description: r.resource.description || null,
        category: r.resource.category,
        fileName: r.resource.fileName || null,
        fileUrl: r.resource.fileUrl,
        fileSizeBytes: r.resource.fileSizeBytes,
        sharedAt: r.sharedAt.toISOString(),
        teacherName: r.resource.teacher?.name || null,
        courseTitle: r.course?.title || null,
        teacherNote: r.teacherNote || null,
      })),
      trials: s.trialRequestsAsStudent.map((t) => ({
        id: t.id,
        instrument: t.instrument,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        isConverted: t.isConverted,
        allottedLessonStatus: t.allottedLesson?.status || null,
      })),
      notifications: s.notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.body,
        type: n.type,
        createdAt: n.createdAt.toISOString(),
      })),
      conversations: (s.conversationsAsStudent || []).map((c: any) => ({
        id: c.id,
        teacherId: c.teacherId,
        teacherName: c.teacher?.name || "Assigned Faculty",
        teacherEmail: c.teacher?.email || "",
        instrument: c.instrument,
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c._count?.messages || 0,
        messages: [], // Messages loaded on-demand via API to reduce initial payload
      })),
    };
  });

    const courseOptions = dbCourses.map((c) => ({
      id: c.id,
      title: c.title,
      instrument: c.instrument,
      level: c.level,
      sessionCount: c.sessionCount,
      priceMinorUnits: c.priceMinorUnits,
    }));

    const teacherOptions = dbTeachers.map((t) => ({
      id: t.id,
      name: t.name || "Teacher",
      instruments: t.teacherProfile?.instruments || [],
    }));

    // Exclude students who are currently in their trial period until trial is completed or enrolled
    const eligibleStudents = formattedStudents.filter(
      (s) => !isStudentInActiveTrialPeriod(s)
    );

    return {
      formattedStudents: eligibleStudents,
      courseOptions,
      teacherOptions,
    };
    });
  },
  ["admin-students-data-v5"],
  { revalidate: 30, tags: ["admin-students", "students"] }
);

export default async function AdminStudentsPage() {
  await requireRole(Role.ADMIN);

  let data = {
    formattedStudents: [] as StudentRecord[],
    courseOptions: [] as { id: string; title: string; instrument: string; level: string; sessionCount: number; priceMinorUnits: number }[],
    teacherOptions: [] as { id: string; name: string; instruments: string[] }[],
  };

  try {
    data = await getCachedAdminStudentsData();
  } catch (err) {
    console.error("[AdminStudentsPage] Failed to load cached students data, using fallback:", err);
    const fallback = getLastKnownGood<typeof data>("admin-students-v4");
    if (fallback) data = fallback;
  }

  // Safety net: if formattedStudents is empty, check resilient cache for last known good data
  if (!data.formattedStudents || data.formattedStudents.length === 0) {
    const fallback = getLastKnownGood<typeof data>("admin-students-v4");
    if (fallback && fallback.formattedStudents.length > 0) {
      data = fallback;
    }
  }

  return (
    <AdminStudentsManager
      initialStudents={data.formattedStudents}
      courses={data.courseOptions}
      teachers={data.teacherOptions}
    />
  );
}
