import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getResilientData, getLastKnownGood } from "@/lib/db-resilience";
import { AdminCoursesManager, AdminCourseItem } from "./AdminCoursesManager";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Course Catalog Management | Admin Portal | Gandharva School of Music",
  description: "Create and edit academy music courses, syllabi, tuition pricing, and accreditation.",
};

const getCachedAdminCoursesData = unstable_cache(
  async () => {
    return getResilientData("admin-courses-v2", async () => {
      const [dbCourses, dbTeachers] = await Promise.all([
      db.course.findMany({
        include: {
          _count: {
            select: { enrollments: true, lessons: true },
          },
          teachers: {
            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  teacherProfile: {
                    select: { instruments: true },
                  },
                },
              },
            },
          },
          lessons: {
            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { lessonNumber: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.user.findMany({
        where: { role: Role.TEACHER, isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          teacherProfile: {
            select: { instruments: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const formattedTeachers = dbTeachers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      instruments: t.teacherProfile?.instruments || [],
    }));

    const formattedCourses: AdminCourseItem[] = dbCourses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      discipline: c.discipline,
      instrument: c.instrument,
      level: c.level,
      accreditation: c.accreditation,
      description: c.description,
      syllabusSummary: c.syllabusSummary,
      priceMinorUnits: c.priceMinorUnits,
      emiPrice3MinorUnits: c.emiPrice3MinorUnits,
      emiPrice6MinorUnits: c.emiPrice6MinorUnits,
      allowEmi: c.allowEmi,
      sessionCount: c.sessionCount,
      durationWeeks: c.durationWeeks,
      structurePdfUrl: c.structurePdfUrl || null,
      startDate: c.startDate ? c.startDate.toISOString() : null,
      endDate: c.endDate ? c.endDate.toISOString() : null,
      isPublished: c.isPublished,
      enrollmentsCount: c._count.enrollments,
      lessonsCount: c._count.lessons,
      allottedTeachers: c.teachers.map((ct) => ({
        id: ct.teacher.id,
        name: ct.teacher.name,
        email: ct.teacher.email,
        instruments: ct.teacher.teacherProfile?.instruments || [],
      })),
      lessons: c.lessons.map((l) => ({
        id: l.id,
        lessonNumber: l.lessonNumber,
        title: l.title,
        description: l.description,
        durationMinutes: l.durationMinutes,
        scheduledStartsAt: l.scheduledStartsAt ? l.scheduledStartsAt.toISOString() : null,
        teacherId: l.teacherId,
        teacherName: l.teacher?.name || null,
      })),
    }));

    return {
      formattedCourses,
      formattedTeachers,
    };
    });
  },
  ["admin-courses-data-v2"],
  { revalidate: 30, tags: ["admin-courses", "courses"] }
);

export default async function AdminCoursesPage() {
  await requireRole(Role.ADMIN);

  let data = {
    formattedCourses: [] as AdminCourseItem[],
    formattedTeachers: [] as { id: string; name: string | null; email: string; instruments: string[] }[],
  };

  try {
    data = await getCachedAdminCoursesData();
  } catch (err) {
    console.error("[AdminCoursesPage] Failed to load cached courses data, using fallback:", err);
    const fallback = getLastKnownGood<typeof data>("admin-courses-v2");
    if (fallback) data = fallback;
  }

  // Safety net: if formattedCourses is empty, check resilient cache for last known good data
  if (!data.formattedCourses || data.formattedCourses.length === 0) {
    const fallback = getLastKnownGood<typeof data>("admin-courses-v2");
    if (fallback && fallback.formattedCourses.length > 0) {
      data = fallback;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
          Academy Curriculum
        </span>
        <SplitHeading
          firstClause="Course Catalog"
          accentClause="Management"
          as="h1"
          size="lg"
        />
      </div>

      <AdminCoursesManager
        initialCourses={data.formattedCourses}
        facultyTeachers={data.formattedTeachers}
      />
    </div>
  );
}
