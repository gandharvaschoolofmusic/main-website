import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { TeacherStudentsList, StudentItem } from "@/components/dashboard/TeacherStudentsList";
import { formatInViewerTimezone } from "@/lib/timezone";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "My Students | Teacher Studio | Gandharva School of Music",
  description: "View enrolled and trial students, curriculum progress, and private teaching notes.",
};

import { unstable_cache } from "next/cache";

const getCachedTeacherStudentsData = unstable_cache(
  async (userId: string) => {
    return Promise.all([
      db.enrollment.findMany({
        where: { teacherId: userId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              timezone: true,
            },
          },
          course: {
            select: {
              title: true,
              sessionCount: true,
              instrument: true,
            },
          },
          lessons: {
            select: {
              status: true,
              startsAt: true,
            },
            orderBy: { startsAt: "asc" },
          },
        },
        orderBy: { startedAt: "desc" },
      }),
      db.lesson.findMany({
        where: {
          teacherId: userId,
          lessonSource: "TRIAL",
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              timezone: true,
            },
          },
        },
        orderBy: { startsAt: "desc" },
        take: 50,
      }),
    ]);
  },
  ["teacher-students-data"],
  { revalidate: 30, tags: ["teacher-students", "student-enrollments"] }
);

export default async function TeacherStudentsPage() {
  const user = await requireRole(Role.TEACHER);
  const teacherTimezone = user.timezone || "UTC";

  // Fetch enrolled students and trial students in parallel (cached 30s)
  let enrollments: any[] = [];
  let trialLessons: any[] = [];

  try {
    [enrollments, trialLessons] = await getCachedTeacherStudentsData(user.id);
  } catch (err) {
    console.error("Failed to load cached teacher students data:", err);
    [enrollments, trialLessons] = await Promise.all([
      db.enrollment.findMany({
        where: { teacherId: user.id },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              timezone: true,
            },
          },
          course: {
            select: {
              title: true,
              sessionCount: true,
              instrument: true,
            },
          },
          lessons: {
            select: {
              status: true,
              startsAt: true,
            },
            orderBy: { startsAt: "asc" },
          },
        },
        orderBy: { startedAt: "desc" },
      }),
      db.lesson.findMany({
        where: {
          teacherId: user.id,
          lessonSource: "TRIAL",
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              timezone: true,
            },
          },
        },
        orderBy: { startsAt: "desc" },
        take: 50,
      }),
    ]);
  }

  const studentMap = new Map<string, StudentItem>();

  // Process enrolled students
  for (const enr of enrollments) {
    const totalSessions = enr.course?.sessionCount || 0;
    const completedSessions = (enr.lessons || []).filter(
      (l: any) => l.status === "COMPLETED",
    ).length;

    const upcomingLesson = (enr.lessons || []).find(
      (l: any) => l.status === "SCHEDULED" && new Date(l.startsAt) >= new Date(),
    );

    const nextFormatted = upcomingLesson
      ? formatInViewerTimezone(
          new Date(upcomingLesson.startsAt),
          teacherTimezone,
          "EEE, MMM d 'at' h:mm a",
        )
      : null;

    const key = `${enr.studentId}-${enr.courseId}`;
    studentMap.set(key, {
      studentId: enr.studentId,
      studentName: enr.student?.name || "Student",
      studentEmail: enr.student?.email || "",
      studentTimezone: enr.student?.timezone || "UTC",
      courseTitle: enr.course?.title || "Music Course",
      type: "COURSE",
      sessionsCompleted: completedSessions,
      sessionsTotal: totalSessions,
      nextLessonFormatted: nextFormatted,
      instrument: enr.course?.instrument || "Music",
    });
  }

  // Process trial students (only if not already listed or as trial card)
  for (const tl of trialLessons) {
    const key = `${tl.studentId}-trial`;
    if (!studentMap.has(key)) {
      const isCompleted = tl.status === "COMPLETED";
      const isUpcoming =
        tl.status === "SCHEDULED" && new Date(tl.startsAt) >= new Date();

      studentMap.set(key, {
        studentId: tl.studentId,
        studentName: tl.student?.name || "Student",
        studentEmail: tl.student?.email || "",
        studentTimezone: tl.student?.timezone || "UTC",
        courseTitle: "Free Trial Lesson",
        type: "TRIAL",
        sessionsCompleted: isCompleted ? 1 : 0,
        sessionsTotal: 1,
        nextLessonFormatted: isUpcoming
          ? formatInViewerTimezone(
              new Date(tl.startsAt),
              teacherTimezone,
              "EEE, MMM d 'at' h:mm a",
            )
          : null,
        instrument: tl.instrument,
      });
    }
  }

  const studentsList: StudentItem[] = Array.from(studentMap.values());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
            Studio Roster
          </span>
          <SplitHeading
            firstClause="My Students &"
            accentClause="Learning Progress"
            as="h1"
            size="lg"
          />
          <p className="text-xs text-body mt-1 max-w-2xl">
            Track enrolled course students and trial attendees, monitor session completion, and maintain private lesson notes.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-border-default shadow-xs text-body">
          <span>Total Active Roster:</span>
          <span className="text-primary font-bold font-numeric text-sm">{studentsList.length}</span>
        </div>
      </div>

      <TeacherStudentsList students={studentsList} teacherId={user.id} />
    </div>
  );
}
