import { Suspense } from "react";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import {
  AdminEnrollmentsManager,
  EnrollmentRecord,
  CourseCatalogOption,
  FacultyOption,
  StudentOption,
  TrialLeadOption,
  AdminCourseEnrollmentRequestItem,
} from "./AdminEnrollmentsManager";

export const metadata = {
  title: "Create Enrollment & 1:1 Scheduling | Admin Portal | Gandharva School of Music",
  description: "Convert qualified trials into scheduled billable learning plans, allot faculty, and manage 1-on-1 timetables.",
};

const getCachedAdminEnrollmentsData = unstable_cache(
  async () => {
    let dbCourses: any[] = [];
    let dbTeachers: any[] = [];
    let dbStudents: any[] = [];
    let dbTrialLeads: any[] = [];
    let dbEnrollments: any[] = [];
    let dbCourseRequests: any[] = [];

    try {
      // Run ALL queries in parallel — cuts total time from sum(all) to max(slowest)
      [dbCourses, dbTeachers, dbStudents, dbTrialLeads, dbEnrollments, dbCourseRequests] =
        await Promise.all([
        // 1. Fetch catalog
        db.course.findMany({
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            instrument: true,
            level: true,
            sessionCount: true,
            priceMinorUnits: true,
            durationWeeks: true,
          },
          orderBy: { title: "asc" },
        }),

        // 2. Fetch faculty teachers
        db.user.findMany({
          where: { role: Role.TEACHER },
          include: {
            teacherProfile: {
              select: {
                instruments: true,
                payoutPerSession: true,
              },
            },
          },
          orderBy: { name: "asc" },
        }),

        // 3. Fetch students roster — only students converted via Trial CRM
        db.user.findMany({
          where: {
            role: Role.STUDENT,
            trialRequestsAsStudent: { some: { isConverted: true } },
          },
          select: {
            id: true,
            customId: true,
            name: true,
            email: true,
            phone: true,
            timezone: true,
            guardianName: true,
            guardianPhone: true,
            country: true,
            age: true,
          },
          orderBy: { name: "asc" },
        }),

        // 4. Fetch converted trial leads (capped at 50)
        db.trialRequest.findMany({
          where: { isConverted: true },
          select: {
            id: true,
            studentId: true,
            studentName: true,
            studentEmail: true,
            instrument: true,
            status: true,
            isConverted: true,
            preferredTimeSlot: true,
            allottedTeacherId: true,
          },
          orderBy: { convertedAt: "desc" },
          take: 50,
        }),

        // 5. Fetch enrollments with lessons limited to recent 20 per enrollment
        db.enrollment.findMany({
          where: {
            student: {
              trialRequestsAsStudent: { some: { isConverted: true } },
            },
          },
          include: {
            student: {
              select: {
                id: true,
                customId: true,
                name: true,
                email: true,
                phone: true,
                timezone: true,
                guardianName: true,
                guardianPhone: true,
                country: true,
                age: true,
              },
            },
            course: {
              select: {
                id: true,
                title: true,
                instrument: true,
                level: true,
                sessionCount: true,
                priceMinorUnits: true,
                durationWeeks: true,
              },
            },
            lessons: {
              select: {
                id: true,
                trackingCode: true,
                startsAt: true,
                durationMinutes: true,
                status: true,
                teacherId: true,
              },
              orderBy: { startsAt: "asc" },
              take: 30, // Cap lessons per enrollment to reduce payload
            },
            payment: {
              select: {
                id: true,
                amountMinorUnits: true,
                status: true,
                gatewayPaymentId: true,
              },
            },
            payments: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                amountMinorUnits: true,
                currency: true,
                gateway: true,
                gatewayPaymentId: true,
                gatewayOrderId: true,
                status: true,
                notes: true,
                createdAt: true,
              },
              take: 20, // Cap payment records per enrollment
            },
          },
          orderBy: { startedAt: "desc" },
        }),

        // 6. Fetch course admission requests
        db.courseEnrollmentRequest.findMany({
          where: {
            student: {
              trialRequestsAsStudent: { some: { isConverted: true } },
            },
          },
          include: {
            student: {
              select: {
                id: true,
                customId: true,
                name: true,
                email: true,
              },
            },
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                discipline: true,
                instrument: true,
                level: true,
                sessionCount: true,
                priceMinorUnits: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
  } catch (error) {
    console.error("[AdminEnrollmentsPage] Error querying PostgreSQL:", error);
  }

  const teacherMap = new Map<string, { name: string; payoutRupees: number }>();
  for (const t of dbTeachers) {
    teacherMap.set(t.id, {
      name: t.name || "Faculty Teacher",
      payoutRupees: Math.round((t.teacherProfile?.payoutPerSession || 50000) / 100),
    });
  }

  const formattedEnrollments: EnrollmentRecord[] = dbEnrollments.map((e: any) => {
    const assignedFaculty = e.teacherId ? teacherMap.get(e.teacherId) : null;

    return {
      id: e.id,
      studentId: e.studentId,
      studentCustomId: e.student.customId || null,
      studentName: e.student.name || "Student",
      studentEmail: e.student.email,
      studentPhone: e.student.phone,
      studentTimezone: e.student.timezone || "Asia/Kolkata",
      studentGuardianName: e.student.guardianName,
      studentGuardianPhone: e.student.guardianPhone,
      studentCountry: e.student.country,
      studentAge: e.student.age,
      courseId: e.courseId,
      courseTitle: e.course.title,
      courseInstrument: e.course.instrument,
      courseLevel: e.course.level,
      courseSessionCount: e.course.sessionCount,
      coursePriceMinorUnits: e.course.priceMinorUnits,
      courseDurationWeeks: e.course.durationWeeks,
      teacherId: e.teacherId,
      teacherName: assignedFaculty?.name || null,
      teacherPayoutRupees: assignedFaculty?.payoutRupees || 800,
      sessionsRemaining: e.sessionsRemaining,
      sessionsTotal: e.course.sessionCount,
      status: e.status,
      startedAt: e.startedAt.toISOString(),
      adminNotes: e.adminNotes,
      lessons: (e.lessons || []).map((l: any) => ({
        id: l.id,
        trackingCode: l.trackingCode || l.id,
        startsAt: l.startsAt.toISOString(),
        durationMinutes: l.durationMinutes,
        status: l.status,
        teacherId: l.teacherId,
        teacherName: (l.teacherId ? teacherMap.get(l.teacherId)?.name : null) || assignedFaculty?.name || "Assigned Faculty",
        payoutRupees: (l.teacherId ? teacherMap.get(l.teacherId)?.payoutRupees : null) || assignedFaculty?.payoutRupees || 800,
      })),
      payment: e.payment,
      payments: (e.payments && e.payments.length > 0)
        ? e.payments.map((p: any) => ({
            id: p.id,
            amountMinorUnits: p.amountMinorUnits,
            currency: p.currency,
            gateway: p.gateway,
            gatewayPaymentId: p.gatewayPaymentId,
            gatewayOrderId: p.gatewayOrderId,
            status: p.status,
            notes: p.notes,
            createdAt: p.createdAt.toISOString(),
          }))
        : e.payment
        ? [
            {
              id: e.payment.id,
              amountMinorUnits: e.payment.amountMinorUnits,
              currency: "INR",
              gateway: "manual",
              gatewayPaymentId: e.payment.gatewayPaymentId || `RCPT-INIT-${e.id.slice(-4)}`,
              gatewayOrderId: null,
              status: e.payment.status,
              notes: "Initial admission payment tranche",
              createdAt: e.startedAt.toISOString(),
            },
          ]
        : [],
    };
  });

  const formattedCourses: CourseCatalogOption[] = dbCourses.map((c) => ({
    id: c.id,
    title: c.title,
    instrument: c.instrument,
    level: c.level,
    sessionCount: c.sessionCount,
    priceMinorUnits: c.priceMinorUnits,
    durationWeeks: c.durationWeeks,
  }));

  const formattedTeachers: FacultyOption[] = dbTeachers.map((t) => ({
    id: t.id,
    name: t.name || "Faculty Teacher",
    email: t.email,
    instruments: t.teacherProfile?.instruments || [],
    payoutRupees: Math.round((t.teacherProfile?.payoutPerSession || 50000) / 100),
  }));

  const formattedStudents: StudentOption[] = dbStudents.map((s) => ({
    id: s.id,
    customId: s.customId || null,
    name: s.name || "Student",
    email: s.email,
    timezone: s.timezone || "Asia/Kolkata",
    guardianName: s.guardianName,
    age: s.age,
    phone: s.phone,
    country: s.country,
  }));

  const formattedTrialLeads: TrialLeadOption[] = dbTrialLeads.map((t) => ({
    id: t.id,
    studentId: t.studentId,
    studentName: t.studentName,
    studentEmail: t.studentEmail,
    instrument: t.instrument,
    status: t.status,
    isConverted: t.isConverted,
    preferredTimeSlot: t.preferredTimeSlot,
    allottedTeacherId: t.allottedTeacherId,
  }));

  const formattedCourseRequests: AdminCourseEnrollmentRequestItem[] = dbCourseRequests.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentCustomId: r.student?.customId || null,
    studentName: r.student.name || "Student",
    studentEmail: r.student.email,
    courseId: r.courseId,
    courseTitle: r.course.title,
    courseSlug: r.course.slug,
    courseDiscipline: r.course.discipline,
    courseInstrument: r.course.instrument,
    courseLevel: r.course.level,
    courseSessionCount: r.course.sessionCount,
    coursePriceMinorUnits: r.course.priceMinorUnits,
    paymentPlan: r.paymentPlan,
    status: r.status,
    studentNotes: r.studentNotes,
    preferredSchedule: r.preferredSchedule,
    createdAt: r.createdAt.toISOString(),
  }));

    return {
      formattedEnrollments,
      formattedCourses,
      formattedTeachers,
      formattedStudents,
      formattedTrialLeads,
      formattedCourseRequests,
    };
  },
  ["admin-enrollments-data-v2"],
  { revalidate: 30, tags: ["admin-enrollments", "enrollments"] }
);

export default async function AdminEnrollmentsPage() {
  await requireRole(Role.ADMIN);

  let data = {
    formattedEnrollments: [] as EnrollmentRecord[],
    formattedCourses: [] as CourseCatalogOption[],
    formattedTeachers: [] as FacultyOption[],
    formattedStudents: [] as StudentOption[],
    formattedTrialLeads: [] as TrialLeadOption[],
    formattedCourseRequests: [] as AdminCourseEnrollmentRequestItem[],
  };

  try {
    data = await getCachedAdminEnrollmentsData();
  } catch (err) {
    console.error("[AdminEnrollmentsPage] Failed to load cached enrollments data, using fallback:", err);
  }

  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-body">Loading enrollment planner...</div>}>
      <AdminEnrollmentsManager
        initialEnrollments={data.formattedEnrollments}
        courses={data.formattedCourses}
        teachers={data.formattedTeachers}
        students={data.formattedStudents}
        trialLeads={data.formattedTrialLeads}
        initialCourseRequests={data.formattedCourseRequests}
      />
    </Suspense>
  );
}
