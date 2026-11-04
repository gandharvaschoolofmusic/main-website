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
import { parseAttendanceLogs } from "@/lib/attendance";
import { JOIN_WINDOW_MINUTES_AFTER } from "@/types";


export const metadata = {
  title: "Session Recordings | Admin Portal | Gandharva School of Music",
  description:
    "Hierarchical archival vault: Browse courses, enrolled students, class sessions, and Supabase cloud recordings.",
};

const getCachedCourseRecordingsData = unstable_cache(
  async (adminTimezone: string = "Asia/Kolkata"): Promise<CourseGroupItem[]> => {
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
          const att = parseAttendanceLogs(
            l.attendanceLogs,
            {
              status: l.status,
              roomClosesAt: new Date(l.startsAt.getTime() + (l.durationMinutes + JOIN_WINDOW_MINUTES_AFTER) * 60_000),
              teacherJoinedAt: l.teacherJoinedAt,
              teacherLeftAt: l.teacherLeftAt,
              studentJoinedAt: l.studentJoinedAt,
              studentLeftAt: l.studentLeftAt,
              timezone: adminTimezone,
            },
            (d, fmt) => formatInViewerTimezone(d, adminTimezone, fmt),
          );

          const mappedRecordings = l.recordings.map((r, rIdx) => {
            const rTJoined = r.teacherJoinedAt || l.teacherJoinedAt;
            const rTLeft = r.teacherLeftAt || l.teacherLeftAt || (r.createdAt && rTJoined ? r.createdAt : null);
            const rSJoined = r.studentJoinedAt || l.studentJoinedAt;
            const rSLeft = r.studentLeftAt || l.studentLeftAt || (r.createdAt && rSJoined ? r.createdAt : null);

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
              fileUrl: `/api/lessons/${r.lessonId}/playback?part=${r.id}`,
              fileId: r.fileId,
              fileSizeBytes: r.fileSizeBytes,
              durationSeconds: r.durationSeconds,
              storageBackend: r.storageBackend,
              createdAt: r.createdAt.toISOString(),
              formattedDate: formatInViewerTimezone(r.createdAt, adminTimezone, "MMM d, yyyy 'at' h:mm a zzz"),
              partNumber: rIdx + 1,
              teacherJoinedAt: rTJoined ? rTJoined.toISOString() : null,
              teacherLeftAt: rTLeft ? rTLeft.toISOString() : null,
              studentJoinedAt: rSJoined ? rSJoined.toISOString() : null,
              studentLeftAt: rSLeft ? rSLeft.toISOString() : null,
              formattedTeacherJoined: rTJoined ? formatInViewerTimezone(rTJoined, adminTimezone, "h:mm:ss a") : null,
              formattedTeacherLeft: rTLeft ? formatInViewerTimezone(rTLeft, adminTimezone, "h:mm:ss a") : null,
              formattedStudentJoined: rSJoined ? formatInViewerTimezone(rSJoined, adminTimezone, "h:mm:ss a") : null,
              formattedStudentLeft: rSLeft ? formatInViewerTimezone(rSLeft, adminTimezone, "h:mm:ss a") : null,
              teacherDurationSeconds: recTeacherDuration,
              studentDurationSeconds: recStudentDuration,
              overlapDurationSeconds: recOverlapDuration,
            };
          });

          // Vault fail-safe: if recordings table has no entries but lesson.recordingUrl is set on Lesson row
          const recordings = mappedRecordings.length > 0
            ? mappedRecordings
            : l.recordingUrl
            ? [
                {
                  id: `${l.id}-vault-recording`,
                  lessonId: l.id,
                  fileName: l.recordingUrl.split("/").pop() || `lesson-${l.id}-recording.webm`,
                  fileUrl: `/api/lessons/${l.id}/playback`,
                  fileId: l.recordingFileId,
                  fileSizeBytes: 0,
                  durationSeconds: l.recordingDurationSeconds || att.overlapDurationSeconds || att.totalTeacherDurationSeconds || null,
                  storageBackend: (l.recordingUrl.includes("supabase") ? "SUPABASE" : "LIVEKIT_EGRESS") as "SUPABASE" | "LIVEKIT_EGRESS",
                  createdAt: l.startsAt.toISOString(),
                  formattedDate: formatInViewerTimezone(l.startsAt, adminTimezone, "MMM d, yyyy 'at' h:mm a zzz"),
                  partNumber: 1,
                  teacherJoinedAt: att.primaryTeacherJoinedAt,
                  teacherLeftAt: att.primaryTeacherLeftAt,
                  studentJoinedAt: att.primaryStudentJoinedAt,
                  studentLeftAt: att.primaryStudentLeftAt,
                  formattedTeacherJoined: att.primaryTeacherJoinedAt
                    ? formatInViewerTimezone(new Date(att.primaryTeacherJoinedAt), adminTimezone, "h:mm:ss a")
                    : null,
                  formattedTeacherLeft: att.primaryTeacherLeftAt
                    ? formatInViewerTimezone(new Date(att.primaryTeacherLeftAt), adminTimezone, "h:mm:ss a")
                    : null,
                  formattedStudentJoined: att.primaryStudentJoinedAt
                    ? formatInViewerTimezone(new Date(att.primaryStudentJoinedAt), adminTimezone, "h:mm:ss a")
                    : null,
                  formattedStudentLeft: att.primaryStudentLeftAt
                    ? formatInViewerTimezone(new Date(att.primaryStudentLeftAt), adminTimezone, "h:mm:ss a")
                    : null,
                  teacherDurationSeconds: att.totalTeacherDurationSeconds,
                  studentDurationSeconds: att.totalStudentDurationSeconds,
                  overlapDurationSeconds: att.overlapDurationSeconds,
                },
              ]
            : [];

          return {
            id: l.id,
            trackingCode: getLessonTrackingId(l),
            sessionNumber: lIdx + 1,
            startsAt: l.startsAt.toISOString(),
            formattedDate: formatInViewerTimezone(l.startsAt, adminTimezone, "MMM d, yyyy"),
            formattedTime: formatInViewerTimezone(l.startsAt, adminTimezone, "h:mm a zzz"),
            status: l.status,
            durationMinutes: l.durationMinutes,
            instrument: l.instrument || c.instrument,
            teacherName: l.teacher?.name || "Teacher",
            teacherEmail: l.teacher?.email || "",
            teacherJoinedAt: att.primaryTeacherJoinedAt || (l.teacherJoinedAt ? l.teacherJoinedAt.toISOString() : null),
            teacherLeftAt: att.primaryTeacherLeftAt || (l.teacherLeftAt ? l.teacherLeftAt.toISOString() : null),
            studentJoinedAt: att.primaryStudentJoinedAt || (l.studentJoinedAt ? l.studentJoinedAt.toISOString() : null),
            studentLeftAt: att.primaryStudentLeftAt || (l.studentLeftAt ? l.studentLeftAt.toISOString() : null),
            formattedTeacherJoined: att.primaryTeacherJoinedAt
              ? formatInViewerTimezone(new Date(att.primaryTeacherJoinedAt), adminTimezone, "h:mm:ss a")
              : null,
            formattedTeacherLeft: att.primaryTeacherLeftAt
              ? formatInViewerTimezone(new Date(att.primaryTeacherLeftAt), adminTimezone, "h:mm:ss a")
              : null,
            formattedStudentJoined: att.primaryStudentJoinedAt
              ? formatInViewerTimezone(new Date(att.primaryStudentJoinedAt), adminTimezone, "h:mm:ss a")
              : null,
            formattedStudentLeft: att.primaryStudentLeftAt
              ? formatInViewerTimezone(new Date(att.primaryStudentLeftAt), adminTimezone, "h:mm:ss a")
              : null,
            teacherSessions: att.teacherSessions,
            studentSessions: att.studentSessions,
            teacherDurationSeconds: att.totalTeacherDurationSeconds,
            studentDurationSeconds: att.totalStudentDurationSeconds,
            overlapDurationSeconds: att.overlapDurationSeconds,
            recordings,
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

        const att = parseAttendanceLogs(
          tl.attendanceLogs,
          {
            status: tl.status,
            roomClosesAt: new Date(tl.startsAt.getTime() + (tl.durationMinutes + JOIN_WINDOW_MINUTES_AFTER) * 60_000),
            teacherJoinedAt: tl.teacherJoinedAt,
            teacherLeftAt: tl.teacherLeftAt,
            studentJoinedAt: tl.studentJoinedAt,
            studentLeftAt: tl.studentLeftAt,
            timezone: adminTimezone,
          },
          (d, fmt) => formatInViewerTimezone(d, adminTimezone, fmt),
        );

        const mappedRecordings = tl.recordings.map((r, rIdx) => {
          const rTJoined = r.teacherJoinedAt || tl.teacherJoinedAt;
          const rTLeft = r.teacherLeftAt || tl.teacherLeftAt || (r.createdAt && rTJoined ? r.createdAt : null);
          const rSJoined = r.studentJoinedAt || tl.studentJoinedAt;
          const rSLeft = r.studentLeftAt || tl.studentLeftAt || (r.createdAt && rSJoined ? r.createdAt : null);

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
            fileUrl: `/api/lessons/${r.lessonId}/playback?part=${r.id}`,
            fileId: r.fileId,
            fileSizeBytes: r.fileSizeBytes,
            durationSeconds: r.durationSeconds,
            storageBackend: r.storageBackend,
            createdAt: r.createdAt.toISOString(),
            formattedDate: formatInViewerTimezone(r.createdAt, adminTimezone, "MMM d, yyyy 'at' h:mm a zzz"),
            partNumber: rIdx + 1,
            teacherJoinedAt: rTJoined ? rTJoined.toISOString() : null,
            teacherLeftAt: rTLeft ? rTLeft.toISOString() : null,
            studentJoinedAt: rSJoined ? rSJoined.toISOString() : null,
            studentLeftAt: rSLeft ? rSLeft.toISOString() : null,
            formattedTeacherJoined: rTJoined ? formatInViewerTimezone(rTJoined, adminTimezone, "h:mm:ss a") : null,
            formattedTeacherLeft: rTLeft ? formatInViewerTimezone(rTLeft, adminTimezone, "h:mm:ss a") : null,
            formattedStudentJoined: rSJoined ? formatInViewerTimezone(rSJoined, adminTimezone, "h:mm:ss a") : null,
            formattedStudentLeft: rSLeft ? formatInViewerTimezone(rSLeft, adminTimezone, "h:mm:ss a") : null,
            teacherDurationSeconds: recTeacherDuration,
            studentDurationSeconds: recStudentDuration,
            overlapDurationSeconds: recOverlapDuration,
          };
        });

        // Vault fail-safe: if recordings table has no entries but lesson.recordingUrl is set on Lesson row
        const recordings = mappedRecordings.length > 0
          ? mappedRecordings
          : tl.recordingUrl
          ? [
              {
                id: `${tl.id}-vault-recording`,
                lessonId: tl.id,
                fileName: tl.recordingUrl.split("/").pop() || `lesson-${tl.id}-recording.webm`,
                fileUrl: `/api/lessons/${tl.id}/playback`,
                fileId: tl.recordingFileId,
                fileSizeBytes: 0,
                durationSeconds: tl.recordingDurationSeconds || att.overlapDurationSeconds || att.totalTeacherDurationSeconds || null,
                storageBackend: (tl.recordingUrl.includes("supabase") ? "SUPABASE" : "LIVEKIT_EGRESS") as "SUPABASE" | "LIVEKIT_EGRESS",
                createdAt: tl.startsAt.toISOString(),
                formattedDate: formatInViewerTimezone(tl.startsAt, adminTimezone, "MMM d, yyyy 'at' h:mm a zzz"),
                partNumber: 1,
                teacherJoinedAt: att.primaryTeacherJoinedAt,
                teacherLeftAt: att.primaryTeacherLeftAt,
                studentJoinedAt: att.primaryStudentJoinedAt,
                studentLeftAt: att.primaryStudentLeftAt,
                formattedTeacherJoined: att.primaryTeacherJoinedAt
                  ? formatInViewerTimezone(new Date(att.primaryTeacherJoinedAt), adminTimezone, "h:mm:ss a")
                  : null,
                formattedTeacherLeft: att.primaryTeacherLeftAt
                  ? formatInViewerTimezone(new Date(att.primaryTeacherLeftAt), adminTimezone, "h:mm:ss a")
                  : null,
                formattedStudentJoined: att.primaryStudentJoinedAt
                  ? formatInViewerTimezone(new Date(att.primaryStudentJoinedAt), adminTimezone, "h:mm:ss a")
                  : null,
                formattedStudentLeft: att.primaryStudentLeftAt
                  ? formatInViewerTimezone(new Date(att.primaryStudentLeftAt), adminTimezone, "h:mm:ss a")
                  : null,
                teacherDurationSeconds: att.totalTeacherDurationSeconds,
                studentDurationSeconds: att.totalStudentDurationSeconds,
                overlapDurationSeconds: att.overlapDurationSeconds,
              },
            ]
          : [];

        const sessionItem: SessionLessonItem = {
          id: tl.id,
          trackingCode: getLessonTrackingId(tl),
          sessionNumber: studentEntry.lessons.length + 1,
          startsAt: tl.startsAt.toISOString(),
          formattedDate: formatInViewerTimezone(tl.startsAt, adminTimezone, "MMM d, yyyy"),
          formattedTime: formatInViewerTimezone(tl.startsAt, adminTimezone, "h:mm a zzz"),
          status: tl.status,
          durationMinutes: tl.durationMinutes,
          instrument: tl.instrument,
          teacherName: tl.teacher?.name || "Teacher",
          teacherEmail: tl.teacher?.email || "",
          teacherJoinedAt: att.primaryTeacherJoinedAt || (tl.teacherJoinedAt ? tl.teacherJoinedAt.toISOString() : null),
          teacherLeftAt: att.primaryTeacherLeftAt || (tl.teacherLeftAt ? tl.teacherLeftAt.toISOString() : null),
          studentJoinedAt: att.primaryStudentJoinedAt || (tl.studentJoinedAt ? tl.studentJoinedAt.toISOString() : null),
          studentLeftAt: att.primaryStudentLeftAt || (tl.studentLeftAt ? tl.studentLeftAt.toISOString() : null),
          formattedTeacherJoined: att.primaryTeacherJoinedAt
            ? formatInViewerTimezone(new Date(att.primaryTeacherJoinedAt), adminTimezone, "h:mm:ss a")
            : null,
          formattedTeacherLeft: att.primaryTeacherLeftAt
            ? formatInViewerTimezone(new Date(att.primaryTeacherLeftAt), adminTimezone, "h:mm:ss a")
            : null,
          formattedStudentJoined: att.primaryStudentJoinedAt
            ? formatInViewerTimezone(new Date(att.primaryStudentJoinedAt), adminTimezone, "h:mm:ss a")
            : null,
          formattedStudentLeft: att.primaryStudentLeftAt
            ? formatInViewerTimezone(new Date(att.primaryStudentLeftAt), adminTimezone, "h:mm:ss a")
            : null,
          teacherSessions: att.teacherSessions,
          studentSessions: att.studentSessions,
          teacherDurationSeconds: att.totalTeacherDurationSeconds,
          studentDurationSeconds: att.totalStudentDurationSeconds,
          overlapDurationSeconds: att.overlapDurationSeconds,
          recordings,
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
  ["admin-course-recordings-hierarchy-v5"],
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
  const admin = await requireRole(Role.ADMIN);
  const adminTimezone = admin.timezone || "Asia/Kolkata";

  let courses: CourseGroupItem[] = [];
  try {
    courses = await getCachedCourseRecordingsData(adminTimezone);
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
