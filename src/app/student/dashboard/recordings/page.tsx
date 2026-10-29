import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import {
  StudentRecordingsClient,
  StudentLectureItem,
  StudentRecordingPart,
} from "@/components/dashboard/StudentRecordingsClient";
import { getLessonTrackingId } from "@/lib/lesson-tracking";

export const metadata = {
  title: "Lecture Recordings | Student Dashboard | Gandharva School of Music",
  description:
    "Private vault of your recorded 1-on-1 live music lectures and practice lessons.",
};

const getCachedStudentRecordings = unstable_cache(
  async (studentId: string) => {
    return db.lesson.findMany({
      where: {
        studentId, // STRICT ISOLATION: Only this student's lectures
        OR: [
          { recordings: { some: {} } },
          { recordingUrl: { not: null } },
        ],
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        enrollment: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                instrument: true,
                level: true,
              },
            },
          },
        },
        trialRequest: {
          select: {
            id: true,
            instrument: true,
            category: true,
          },
        },
        recordings: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: {
        startsAt: "desc",
      },
    });
  },
  ["student-recordings-data"],
  { revalidate: 30, tags: ["student-recordings"] }
);

export default async function StudentRecordingsPage() {
  const user = await requireRole(Role.STUDENT);

  let dbLessons: any[] = [];
  try {
    dbLessons = await getCachedStudentRecordings(user.id);
  } catch (err) {
    console.error("Failed to fetch cached student recordings:", err);
    dbLessons = await db.lesson.findMany({
      where: {
        studentId: user.id,
        OR: [
          { recordings: { some: {} } },
          { recordingUrl: { not: null } },
        ],
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        enrollment: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                instrument: true,
                level: true,
              },
            },
          },
        },
        trialRequest: {
          select: {
            id: true,
            instrument: true,
            category: true,
          },
        },
        recordings: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: {
        startsAt: "desc",
      },
    });
  }

  // Format into client-friendly structure
  const formattedLectures: StudentLectureItem[] = dbLessons.map((l: any) => {
    const trackingCode = getLessonTrackingId({
      id: l.id,
      trackingCode: l.trackingCode,
    });

    const courseTitle =
      l.enrollment?.course?.title ||
      (l.trialRequest
        ? `${l.trialRequest.instrument} Trial Class`
        : l.instrument
        ? `${l.instrument} 1-on-1 Class`
        : "Live Music Lecture");

    // Gather recording parts
    const parts: StudentRecordingPart[] = (l.recordings || []).map((r: any) => ({
      id: r.id,
      fileUrl: r.fileUrl,
      fileId: r.fileId,
      fileName: r.fileName,
      fileSizeBytes: r.fileSizeBytes || 0,
      durationSeconds: r.durationSeconds || null,
      createdAt: new Date(r.createdAt).toISOString(),
    }));

    // If recordings array is empty but lesson has legacy recordingUrl
    if (parts.length === 0 && l.recordingUrl) {
      parts.push({
        id: `legacy-${l.id}`,
        fileUrl: l.recordingUrl,
        fileId: l.recordingFileId || null,
        fileName: `${trackingCode}.mp4`,
        fileSizeBytes: 0,
        durationSeconds: l.recordingDurationSeconds || l.durationMinutes * 60,
        createdAt: new Date(l.startsAt).toISOString(),
      });
    }

    const primaryUrl = parts[0]?.fileUrl || l.recordingUrl || "";

    const totalDurationSeconds = parts.reduce(
      (acc: number, p: StudentRecordingPart) => acc + (p.durationSeconds || 0),
      0
    ) || (l.durationMinutes ? l.durationMinutes * 60 : 0);

    const totalFileSizeBytes = parts.reduce(
      (acc: number, p: StudentRecordingPart) => acc + (p.fileSizeBytes || 0),
      0
    );

    return {
      id: l.id,
      trackingCode,
      instrument: l.instrument || l.enrollment?.course?.instrument || "Music",
      courseTitle,
      courseSlug: l.enrollment?.course?.slug || null,
      startsAt: new Date(l.startsAt).toISOString(),
      durationMinutes: l.durationMinutes || 60,
      status: l.status,
      teacher: {
        id: l.teacher.id,
        name: l.teacher.name || "Faculty Teacher",
        email: l.teacher.email || "",
        image: l.teacher.image || null,
      },
      recordings: parts,
      primaryRecordingUrl: primaryUrl,
      totalDurationSeconds,
      totalFileSizeBytes,
    };
  });

  return <StudentRecordingsClient initialLectures={formattedLectures} />;
}
