import Link from "next/link";
import { getTeacherConflictLessonIds } from "@/lib/teacher-conflicts";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role, LessonSource } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getResilientData, getLastKnownGood } from "@/lib/db-resilience";
import { AdminLessonsManager, AdminLessonItem } from "./AdminLessonsManager";
import { formatToIST } from "@/lib/timezone";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { getLessonTrackingId } from "@/lib/lesson-tracking";
import { autoResolvePastLessons } from "@/lib/attendance";

export const metadata = {
  title: "Global Lessons | Admin Portal | Gandharva School of Music",
  description: "Global schedule inspector across all faculty members and enrolled students.",
};

async function loadLessons(lessonIds?: string[]): Promise<AdminLessonItem[]> {
  const dbLessons = await db.lesson.findMany({
    where: lessonIds ? { id: { in: lessonIds } } : undefined,
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

  return dbLessons.map((l) => ({
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
}

const getCachedAdminLessonsData = unstable_cache(
  async () => {
    return getResilientData(`admin-lessons-ist`, async () => {
      // Auto-resolve past concluded lessons based on verified attendance rules
      try {
        await autoResolvePastLessons();
      } catch (err) {
        console.warn("[AdminLessonsPage] autoResolvePastLessons error:", err);
      }

      return loadLessons();
    });
  },
  ["admin-lessons-data-v4"],
  { revalidate: 30, tags: ["admin-lessons", "lessons"] }
);

async function loadGlobalLessons() {
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
  return formattedLessons;
}

export default async function AdminLessonsPage({ searchParams }: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  await requireRole(Role.ADMIN);
  const adminTimezone = "Asia/Kolkata";

  const conflictsOnly = (await searchParams).filter === "teacher-conflicts";
  const formattedLessons = conflictsOnly
    ? await loadLessons(await getTeacherConflictLessonIds())
    : await loadGlobalLessons();

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent-dark font-mono">
          Classroom Monitoring
        </span>
        <SplitHeading
          firstClause={conflictsOnly ? "Teacher" : "Global Lesson"}
          accentClause={conflictsOnly ? "Conflicts" : "Operations"}
          as="h1"
          size="lg"
          className="mt-1"
        />
        <p className="text-sm text-body mt-1">
          {conflictsOnly
            ? "Lessons with overlapping times for the same teacher, from today onward (IST)."
            : "Monitor all scheduled, delivered, and cancelled live video lessons. Audit attendance or intervene as administrative host."}
        </p>
        {conflictsOnly && <Link href="/admin/lessons" className="text-sm underline">View all lessons</Link>}
      </div>

      {conflictsOnly && formattedLessons.length === 0 ? (
        <p className="text-sm text-body">No teacher scheduling conflicts found.</p>
      ) : (
        <AdminLessonsManager
          key={conflictsOnly ? "conflicts" : "global"}
          initialLessons={formattedLessons}
          adminTimezone={adminTimezone}
        />
      )}
    </div>
  );
}
