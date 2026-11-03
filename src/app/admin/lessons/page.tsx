import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role, LessonSource } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getResilientData, getLastKnownGood } from "@/lib/db-resilience";
import { AdminLessonsManager, AdminLessonItem } from "./AdminLessonsManager";
import { formatToIST } from "@/lib/timezone";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { getLessonTrackingId } from "@/lib/lesson-tracking";

export const metadata = {
  title: "Global Lessons | Admin Portal | Gandharva School of Music",
  description: "Global schedule inspector across all faculty members and enrolled students.",
};

const getCachedAdminLessonsData = unstable_cache(
  async () => {
    return getResilientData(`admin-lessons-ist`, async () => {
      const dbLessons = await db.lesson.findMany({
        include: {
          teacher: { select: { name: true, email: true } },
          student: { select: { name: true, email: true } },
          enrollment: {
            select: {
              id: true,
              course: {
                select: { id: true, title: true, instrument: true },
              },
            },
          },
        },
        orderBy: [
          { startsAt: "asc" },
        ],
      });

      const formattedLessons: AdminLessonItem[] = dbLessons.map((l) => ({
        id: l.id,
        trackingCode: getLessonTrackingId(l),
        startsAt: l.startsAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
        formattedTime: formatToIST(l.startsAt),
        formattedCreatedDate: formatToIST(l.createdAt, "MMM d, yyyy"),
        durationMinutes: l.durationMinutes,
        instrument: l.instrument,
        courseTitle: l.enrollment?.course?.title || null,
        status: l.status,
        lessonSource: l.lessonSource || (l.enrollmentId ? LessonSource.ENROLLMENT : LessonSource.TRIAL),
        teacherName: l.teacher?.name || "Teacher",
        studentName: l.student?.name || "Student",
        studentEmail: l.student?.email || "",
      }));

      return formattedLessons;
    });
  },
  ["admin-lessons-data-v4"],
  { revalidate: 30, tags: ["admin-lessons", "lessons"] }
);

export default async function AdminLessonsPage() {
  await requireRole(Role.ADMIN);
  const adminTimezone = "Asia/Kolkata";

  let formattedLessons: AdminLessonItem[] = [];
  try {
    formattedLessons = await getCachedAdminLessonsData();
  } catch (err) {
    console.error("[AdminLessonsPage] Failed to load cached lessons data, using fallback:", err);
  }

  if (formattedLessons.length === 0) {
    const fallback = getLastKnownGood<AdminLessonItem[]>(`admin-lessons-ist`);
    if (fallback && fallback.length > 0) {
      formattedLessons = fallback;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent-dark font-mono">
          Classroom Monitoring
        </span>
        <SplitHeading
          firstClause="Global Lesson"
          accentClause="Operations"
          as="h1"
          size="lg"
          className="mt-1"
        />
        <p className="text-sm text-body mt-1">
          Monitor all scheduled, delivered, and cancelled live video lessons. Audit attendance or intervene as administrative host.
        </p>
      </div>

      <AdminLessonsManager initialLessons={formattedLessons} adminTimezone={adminTimezone} />
    </div>
  );
}
