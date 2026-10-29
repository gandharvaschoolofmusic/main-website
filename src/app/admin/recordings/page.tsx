import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import {
  AdminRecordingsManager,
  CourseGroupItem,
  EnrolledStudentItem,
  SessionLessonItem,
  DriveConfigStatus,
} from "./AdminRecordingsManager";
import { formatInViewerTimezone } from "@/lib/timezone";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { getLessonTrackingId } from "@/lib/lesson-tracking";


export const metadata = {
  title: "Session Recordings | Admin Portal | Gandharva School of Music",
  description:
    "Hierarchical archival vault: Browse courses, enrolled students, class sessions, and Supabase cloud recordings.",
};

const getCachedCourseRecordingsData = unstable_cache(
  async (): Promise<CourseGroupItem[]> => {
    // 1. Fetch courses with enrollments, lessons, and recordings
    const dbCourses = await db.course.findMany({
      include: {
        enrollments: {
          include: {
            student: {
              select: { id: true, name: true, email: true, image: true },
            },
            lessons: {
              include: {
                teacher: { select: { id: true, name: true, email: true } },
                recordings: {
                  orderBy: { createdAt: "asc" },
                },
              },
              orderBy: { startsAt: "asc" },
            },
          },
        },
      },
      orderBy: { title: "asc" },
    });

    // 2. Fetch individual trial lessons
    const dbTrialLessons = await db.lesson.findMany({
      where: {
        OR: [
          { enrollmentId: null },
          { lessonSource: "TRIAL" },
        ],
      },
      include: {
        student: {
          select: { id: true, name: true, email: true, image: true },
        },
        teacher: { select: { id: true, name: true, email: true } },
        recordings: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { startsAt: "desc" },
    });

    const coursesList: CourseGroupItem[] = [];

    // Map regular courses
    for (const c of dbCourses) {
      const studentsMap = new Map<string, EnrolledStudentItem>();

      for (const e of c.enrollments) {
        if (!e.student) continue;

        const studentLessons: SessionLessonItem[] = e.lessons.map((l, lIdx) => {
          const tJoined = l.teacherJoinedAt;
          const tLeft = l.teacherLeftAt;
          const sJoined = l.studentJoinedAt;
          const sLeft = l.studentLeftAt;

          const teacherDurationSeconds =
            tJoined && tLeft ? Math.max(0, Math.round((tLeft.getTime() - tJoined.getTime()) / 1000)) : null;
          const studentDurationSeconds =
            sJoined && sLeft ? Math.max(0, Math.round((sLeft.getTime() - sJoined.getTime()) / 1000)) : null;

          let overlapDurationSeconds: number | null = null;
          if (tJoined && tLeft && sJoined && sLeft) {
            const start = Math.max(tJoined.getTime(), sJoined.getTime());
            const end = Math.min(tLeft.getTime(), sLeft.getTime());
            if (end > start) {
              overlapDurationSeconds = Math.round((end - start) / 1000);
            }
          }

          return {
            id: l.id,
            trackingCode: getLessonTrackingId(l),
            sessionNumber: lIdx + 1,
            startsAt: l.startsAt.toISOString(),
            formattedDate: formatInViewerTimezone(l.startsAt, "UTC", "MMM d, yyyy"),
            formattedTime: formatInViewerTimezone(l.startsAt, "UTC", "h:mm a zzz"),
            status: l.status,
            durationMinutes: l.durationMinutes,
            instrument: l.instrument || c.instrument,
            teacherName: l.teacher?.name || "Teacher",
            teacherEmail: l.teacher?.email || "",
            teacherJoinedAt: tJoined ? tJoined.toISOString() : null,
            teacherLeftAt: tLeft ? tLeft.toISOString() : null,
            studentJoinedAt: sJoined ? sJoined.toISOString() : null,
            studentLeftAt: sLeft ? sLeft.toISOString() : null,
            formattedTeacherJoined: tJoined ? formatInViewerTimezone(tJoined, "UTC", "h:mm:ss a") : null,
            formattedTeacherLeft: tLeft ? formatInViewerTimezone(tLeft, "UTC", "h:mm:ss a") : null,
            formattedStudentJoined: sJoined ? formatInViewerTimezone(sJoined, "UTC", "h:mm:ss a") : null,
            formattedStudentLeft: sLeft ? formatInViewerTimezone(sLeft, "UTC", "h:mm:ss a") : null,
            teacherDurationSeconds,
            studentDurationSeconds,
            overlapDurationSeconds,
            recordings: l.recordings.map((r, rIdx) => {
              const rTJoined = r.teacherJoinedAt || tJoined;
              const rTLeft = r.teacherLeftAt || tLeft || (r.createdAt && rTJoined ? r.createdAt : null);
              const rSJoined = r.studentJoinedAt || sJoined;
              const rSLeft = r.studentLeftAt || sLeft || (r.createdAt && rSJoined ? r.createdAt : null);

              const recTeacherDuration =
                rTJoined && rTLeft ? Math.max(0, Math.round((rTLeft.getTime() - rTJoined.getTime()) / 1000)) : null;
              const recStudentDuration =
                rSJoined && rSLeft ? Math.max(0, Math.round((rSLeft.getTime() - rSJoined.getTime()) / 1000)) : null;

              let recOverlapDuration: number | null = null;
              if (rTJoined && rTLeft && rSJoined && rSLeft) {
                const rStart = Math.max(rTJoined.getTime(), rSJoined.getTime());
                const rEnd = Math.min(rTLeft.getTime(), rSLeft.getTime());
                if (rEnd > rStart) {
                  recOverlapDuration = Math.round((rEnd - rStart) / 1000);
                }
              }

              return {
                id: r.id,
                lessonId: r.lessonId,
                fileName: r.fileName,
                fileUrl: r.fileUrl,
                fileId: r.fileId,
                fileSizeBytes: r.fileSizeBytes,
                durationSeconds: r.durationSeconds,
                storageBackend: r.storageBackend,
                createdAt: r.createdAt.toISOString(),
                formattedDate: formatInViewerTimezone(r.createdAt, "UTC", "MMM d, yyyy 'at' h:mm a zzz"),
                partNumber: rIdx + 1,
                teacherJoinedAt: rTJoined ? rTJoined.toISOString() : null,
                teacherLeftAt: rTLeft ? rTLeft.toISOString() : null,
                studentJoinedAt: rSJoined ? rSJoined.toISOString() : null,
                studentLeftAt: rSLeft ? rSLeft.toISOString() : null,
                formattedTeacherJoined: rTJoined ? formatInViewerTimezone(rTJoined, "UTC", "h:mm:ss a") : null,
                formattedTeacherLeft: rTLeft ? formatInViewerTimezone(rTLeft, "UTC", "h:mm:ss a") : null,
                formattedStudentJoined: rSJoined ? formatInViewerTimezone(rSJoined, "UTC", "h:mm:ss a") : null,
                formattedStudentLeft: rSLeft ? formatInViewerTimezone(rSLeft, "UTC", "h:mm:ss a") : null,
                teacherDurationSeconds: recTeacherDuration,
                studentDurationSeconds: recStudentDuration,
                overlapDurationSeconds: recOverlapDuration,
              };
            }),
          };
        });

        const totalRecs = studentLessons.reduce((acc, l) => acc + l.recordings.length, 0);
        const totalDuration = studentLessons.reduce(
          (acc, l) => acc + l.recordings.reduce((sum, r) => sum + (r.durationSeconds || 0), 0),
          0,
        );

        studentsMap.set(e.student.id, {
          id: e.student.id,
          name: e.student.name || "Student",
          email: e.student.email || "",
          image: e.student.image,
          enrollmentId: e.id,
          sessionsRemaining: e.sessionsRemaining,
          lessons: studentLessons,
          totalRecordingsCount: totalRecs,
          totalDurationSeconds: totalDuration,
        });
      }

      const students = Array.from(studentsMap.values());
      const totalRecs = students.reduce((acc, s) => acc + s.totalRecordingsCount, 0);
      const totalDuration = students.reduce((acc, s) => acc + s.totalDurationSeconds, 0);

      coursesList.push({
        id: c.id,
        title: c.title,
        slug: c.slug,
        instrument: c.instrument,
        level: String(c.level),
        discipline: String(c.discipline),
        isTrialGroup: false,
        students,
        totalStudentsCount: students.length,
        totalRecordingsCount: totalRecs,
        totalDurationSeconds: totalDuration,
      });
    }

    // Map Trial lessons into a dedicated "Individual Trial Sessions" course category
    if (dbTrialLessons.length > 0) {
      const trialStudentsMap = new Map<string, EnrolledStudentItem>();

      for (const tl of dbTrialLessons) {
        if (!tl.student) continue;

        let studentEntry = trialStudentsMap.get(tl.student.id);
        if (!studentEntry) {
          studentEntry = {
            id: tl.student.id,
            name: tl.student.name || "Trial Student",
            email: tl.student.email || "",
            image: tl.student.image,
            enrollmentId: "trial-group",
            lessons: [],
            totalRecordingsCount: 0,
            totalDurationSeconds: 0,
          };
          trialStudentsMap.set(tl.student.id, studentEntry);
        }

        const tJoined = tl.teacherJoinedAt;
        const tLeft = tl.teacherLeftAt;
        const sJoined = tl.studentJoinedAt;
        const sLeft = tl.studentLeftAt;

        const teacherDurationSeconds =
          tJoined && tLeft ? Math.max(0, Math.round((tLeft.getTime() - tJoined.getTime()) / 1000)) : null;
        const studentDurationSeconds =
          sJoined && sLeft ? Math.max(0, Math.round((sLeft.getTime() - sJoined.getTime()) / 1000)) : null;

        let overlapDurationSeconds: number | null = null;
        if (tJoined && tLeft && sJoined && sLeft) {
          const start = Math.max(tJoined.getTime(), sJoined.getTime());
          const end = Math.min(tLeft.getTime(), sLeft.getTime());
          if (end > start) {
            overlapDurationSeconds = Math.round((end - start) / 1000);
          }
        }

        const sessionItem: SessionLessonItem = {
          id: tl.id,
          trackingCode: getLessonTrackingId(tl),
          sessionNumber: studentEntry.lessons.length + 1,
          startsAt: tl.startsAt.toISOString(),
          formattedDate: formatInViewerTimezone(tl.startsAt, "UTC", "MMM d, yyyy"),
          formattedTime: formatInViewerTimezone(tl.startsAt, "UTC", "h:mm a zzz"),
          status: tl.status,
          durationMinutes: tl.durationMinutes,
          instrument: tl.instrument,
          teacherName: tl.teacher?.name || "Teacher",
          teacherEmail: tl.teacher?.email || "",
          teacherJoinedAt: tJoined ? tJoined.toISOString() : null,
          teacherLeftAt: tLeft ? tLeft.toISOString() : null,
          studentJoinedAt: sJoined ? sJoined.toISOString() : null,
          studentLeftAt: sLeft ? sLeft.toISOString() : null,
          formattedTeacherJoined: tJoined ? formatInViewerTimezone(tJoined, "UTC", "h:mm:ss a") : null,
          formattedTeacherLeft: tLeft ? formatInViewerTimezone(tLeft, "UTC", "h:mm:ss a") : null,
          formattedStudentJoined: sJoined ? formatInViewerTimezone(sJoined, "UTC", "h:mm:ss a") : null,
          formattedStudentLeft: sLeft ? formatInViewerTimezone(sLeft, "UTC", "h:mm:ss a") : null,
          teacherDurationSeconds,
          studentDurationSeconds,
          overlapDurationSeconds,
          recordings: tl.recordings.map((r, rIdx) => {
            const rTJoined = r.teacherJoinedAt || tJoined;
            const rTLeft = r.teacherLeftAt || tLeft || (r.createdAt && rTJoined ? r.createdAt : null);
            const rSJoined = r.studentJoinedAt || sJoined;
            const rSLeft = r.studentLeftAt || sLeft || (r.createdAt && rSJoined ? r.createdAt : null);

            const recTeacherDuration =
              rTJoined && rTLeft ? Math.max(0, Math.round((rTLeft.getTime() - rTJoined.getTime()) / 1000)) : null;
            const recStudentDuration =
              rSJoined && rSLeft ? Math.max(0, Math.round((rSLeft.getTime() - rSJoined.getTime()) / 1000)) : null;

            let recOverlapDuration: number | null = null;
            if (rTJoined && rTLeft && rSJoined && rSLeft) {
              const rStart = Math.max(rTJoined.getTime(), rSJoined.getTime());
              const rEnd = Math.min(rTLeft.getTime(), rSLeft.getTime());
              if (rEnd > rStart) {
                recOverlapDuration = Math.round((rEnd - rStart) / 1000);
              }
            }

            return {
              id: r.id,
              lessonId: r.lessonId,
              fileName: r.fileName,
              fileUrl: r.fileUrl,
              fileId: r.fileId,
              fileSizeBytes: r.fileSizeBytes,
              durationSeconds: r.durationSeconds,
              storageBackend: r.storageBackend,
              createdAt: r.createdAt.toISOString(),
              formattedDate: formatInViewerTimezone(r.createdAt, "UTC", "MMM d, yyyy 'at' h:mm a zzz"),
              partNumber: rIdx + 1,
              teacherJoinedAt: rTJoined ? rTJoined.toISOString() : null,
              teacherLeftAt: rTLeft ? rTLeft.toISOString() : null,
              studentJoinedAt: rSJoined ? rSJoined.toISOString() : null,
              studentLeftAt: rSLeft ? rSLeft.toISOString() : null,
              formattedTeacherJoined: rTJoined ? formatInViewerTimezone(rTJoined, "UTC", "h:mm:ss a") : null,
              formattedTeacherLeft: rTLeft ? formatInViewerTimezone(rTLeft, "UTC", "h:mm:ss a") : null,
              formattedStudentJoined: rSJoined ? formatInViewerTimezone(rSJoined, "UTC", "h:mm:ss a") : null,
              formattedStudentLeft: rSLeft ? formatInViewerTimezone(rSLeft, "UTC", "h:mm:ss a") : null,
              teacherDurationSeconds: recTeacherDuration,
              studentDurationSeconds: recStudentDuration,
              overlapDurationSeconds: recOverlapDuration,
            };
          }),
        };

        studentEntry.lessons.push(sessionItem);
        studentEntry.totalRecordingsCount += sessionItem.recordings.length;
        studentEntry.totalDurationSeconds += sessionItem.recordings.reduce(
          (sum, r) => sum + (r.durationSeconds || 0),
          0,
        );
      }

      const trialStudents = Array.from(trialStudentsMap.values());
      const trialRecs = trialStudents.reduce((acc, s) => acc + s.totalRecordingsCount, 0);
      const trialDuration = trialStudents.reduce((acc, s) => acc + s.totalDurationSeconds, 0);

      coursesList.push({
        id: "trial-sessions-group",
        title: "Individual & Trial Sessions",
        slug: "trial-sessions",
        instrument: "1-on-1 Trial",
        level: "Trial Booking",
        discipline: "Direct Lessons",
        isTrialGroup: true,
        students: trialStudents,
        totalStudentsCount: trialStudents.length,
        totalRecordingsCount: trialRecs,
        totalDurationSeconds: trialDuration,
      });
    }

    return coursesList;
  },
  ["admin-course-recordings-hierarchy-v3"],
  { revalidate: 30, tags: ["admin-recordings"] },
);

async function getDriveStatus(): Promise<DriveConfigStatus> {
  return {
    isConfigured: true,
    accessible: true,
    folderName: "Supabase Vault",
    isSharedDrive: true,
  };
}

export default async function AdminRecordingsPage() {
  await requireRole(Role.ADMIN);

  let courses: CourseGroupItem[] = [];
  try {
    courses = await getCachedCourseRecordingsData();
  } catch (err) {
    console.error("[AdminRecordingsPage] Error fetching hierarchical course recordings:", err);
  }

  const driveStatus = await getDriveStatus();

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent-dark font-mono">
          Archival Vault
        </span>
        <SplitHeading
          firstClause="Course & Session"
          accentClause="Recordings"
          as="h1"
          size="lg"
          className="mt-1"
        />
        <p className="text-sm text-body mt-1">
          Explore course curricula, select enrolled students, inspect their session timetable, and access all high-fidelity session recordings stored securely in Supabase.
        </p>
      </div>

      <AdminRecordingsManager
        courses={courses}
        driveStatus={driveStatus}
      />
    </div>
  );
}
