import { Suspense } from "react";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import {
  AdminStudentCoursesManager,
  StudentCourseRequestRow,
  StudentCourseEnrollmentRow,
  TeacherOption,
  StudentOption,
  CourseOption,
} from "./AdminStudentCoursesManager";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Student Courses & Admissions | Admin Portal | Gandharva School of Music",
  description:
    "Review student course admission requests, approve and allot courses directly to student dashboards, manage EMI installments, and assign faculty mentors.",
};

const getCachedAdminStudentCoursesData = unstable_cache(
  async () => {
    return Promise.all([
      db.courseEnrollmentRequest.findMany({
        include: {
          student: {
            select: { id: true, name: true, email: true, phone: true },
          },
          course: {
            select: {
              id: true,
              title: true,
              discipline: true,
              instrument: true,
              sessionCount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.enrollment.findMany({
        include: {
          student: {
            select: { id: true, name: true, email: true },
          },
          course: {
            select: {
              id: true,
              title: true,
              discipline: true,
              instrument: true,
              sessionCount: true,
            },
          },
          lessons: {
            select: { id: true, status: true },
          },
        },
        orderBy: { startedAt: "desc" },
      }),
      db.user.findMany({
        where: { role: Role.TEACHER, isActive: true },
        include: {
          teacherProfile: {
            select: { instruments: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      db.user.findMany({
        where: { role: Role.STUDENT, isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      db.course.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          sessionCount: true,
          discipline: true,
          instrument: true,
          priceMinorUnits: true,
        },
        orderBy: { title: "asc" },
      }),
    ]);
  },
  ["admin-student-courses-data"],
  { revalidate: 30, tags: ["admin-courses", "student-courses", "enrollments"] },
);

export default async function AdminStudentCoursesPage() {
  await requireRole(Role.ADMIN);

  const [dbRequests, dbEnrollments, dbTeachers, dbStudents, dbCourses] =
    await getCachedAdminStudentCoursesData();

  const teacherMap = new Map<string, string>();
  for (const t of dbTeachers) {
    teacherMap.set(t.id, t.name || "Teacher");
  }

  const formattedRequests: StudentCourseRequestRow[] = dbRequests.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: r.student.name || "Student",
    studentEmail: r.student.email,
    studentPhone: r.student.phone,
    courseId: r.courseId,
    courseTitle: r.course.title,
    courseDiscipline: r.course.discipline,
    courseInstrument: r.course.instrument,
    courseSessionCount: r.course.sessionCount,
    paymentPlan: r.paymentPlan,
    status: r.status,
    studentNotes: r.studentNotes,
    adminNotes: r.adminNotes,
    preferredSchedule: r.preferredSchedule,
    allottedTeacherId: r.allottedTeacherId,
    allottedTeacherName: r.allottedTeacherId
      ? teacherMap.get(r.allottedTeacherId) || null
      : null,
    enrollmentId: r.enrollmentId,
    createdAt: r.createdAt.toISOString(),
  }));

  const formattedEnrollments: StudentCourseEnrollmentRow[] = dbEnrollments.map(
    (e) => {
      const scheduledLessonsCount = e.lessons.filter(
        (l) => l.status === "SCHEDULED",
      ).length;
      const completedLessonsCount = e.lessons.filter(
        (l) => l.status === "COMPLETED",
      ).length;

      return {
        id: e.id,
        studentId: e.studentId,
        studentName: e.student.name || "Student",
        studentEmail: e.student.email,
        courseId: e.courseId,
        courseTitle: e.course.title,
        courseDiscipline: e.course.discipline,
        courseInstrument: e.course.instrument,
        courseSessionCount: e.course.sessionCount,
        teacherId: e.teacherId,
        teacherName: e.teacherId
          ? teacherMap.get(e.teacherId) || "Assigned Teacher"
          : null,
        sessionsRemaining: e.sessionsRemaining,
        status: e.status,
        paymentPlan: e.paymentPlan,
        emiStatus: e.emiStatus,
        adminNotes: e.adminNotes,
        scheduledLessonsCount,
        completedLessonsCount,
        startedAt: e.startedAt.toISOString(),
      };
    },
  );

  const teacherOptions: TeacherOption[] = dbTeachers.map((t) => ({
    id: t.id,
    name: t.name || "Teacher",
    email: t.email,
    instruments: t.teacherProfile?.instruments || [],
  }));

  const studentOptions: StudentOption[] = dbStudents.map((s) => ({
    id: s.id,
    name: s.name || "Student",
    email: s.email,
  }));

  const courseOptions: CourseOption[] = dbCourses.map((c) => ({
    id: c.id,
    title: c.title,
    sessionCount: c.sessionCount,
    discipline: c.discipline,
    instrument: c.instrument,
    priceMinorUnits: c.priceMinorUnits,
  }));

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
          Institutional Academic Desk
        </span>
        <SplitHeading
          firstClause="Student Courses &"
          accentClause="Admissions Desk"
          as="h1"
          size="lg"
        />
        <p className="text-xs text-body mt-1 max-w-2xl leading-relaxed">
          Review student course admission requests, approve and allot courses directly to student dashboards, track EMI installments, and assign certified faculty gurus.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="p-12 text-center text-xs text-body">
            Loading student course admissions ledger...
          </div>
        }
      >
        <AdminStudentCoursesManager
          initialRequests={formattedRequests}
          initialEnrollments={formattedEnrollments}
          teachers={teacherOptions}
          students={studentOptions}
          courses={courseOptions}
        />
      </Suspense>
    </div>
  );
}
