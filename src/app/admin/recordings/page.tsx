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
import {
  getConfiguredFolderId,
  isDriveConfigured,
  testDriveFolderAccess,
} from "@/lib/google-drive";

export const metadata = {
  title: "Session Recordings | Admin Portal | Gandharva School of Music",
  description:
    "Hierarchical archival vault: Browse courses, enrolled students, class sessions, and Google Drive recordings.",
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

        const studentLessons: SessionLessonItem[] = e.lessons.map((l, lIdx) => ({
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
          recordings: l.recordings.map((r, rIdx) => ({
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
          })),
        }));

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
          recordings: tl.recordings.map((r, rIdx) => ({
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
          })),
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
  ["admin-course-recordings-hierarchy-v2"],
  { revalidate: 30, tags: ["admin-recordings"] },
);

async function getDriveStatus(): Promise<DriveConfigStatus> {
  const configured = isDriveConfigured();
  if (!configured) {
    return { isConfigured: false, accessible: false };
  }

  try {
    const folderId = await getConfiguredFolderId();
    if (!folderId) {
      return { isConfigured: true, accessible: false };
    }

    const testResult = await testDriveFolderAccess(folderId);
    return {
      isConfigured: true,
      accessible: testResult.accessible,
      folderName: testResult.folderName,
      folderId,
      isSharedDrive: testResult.isSharedDrive,
    };
  } catch {
    return { isConfigured: true, accessible: false };
  }
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
          Explore course curricula, select enrolled students, inspect their session timetable, and access all high-fidelity session recordings stored in Google Drive.
        </p>
      </div>

      <AdminRecordingsManager
        courses={courses}
        driveStatus={driveStatus}
      />
    </div>
  );
}
