import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role, Discipline, CourseLevel } from "@prisma/client";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { SplitHeading } from "@/components/ui/SplitHeading";
import {
  StudentEnrolledCoursesSection,
  type EnrolledCourseItem,
  type CourseRequestItem,
} from "@/components/courses/StudentEnrolledCoursesSection";

export const metadata = {
  title: "Course Catalog | Student Portal | Gandharva School of Music",
  description:
    "Explore accredited diploma and certificate courses in classical instruments, vocals, and dance.",
};

export const dynamic = "force-dynamic";

export default async function StudentCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string; level?: string }>;
}) {
  const user = await requireRole(Role.STUDENT);
  const { discipline, level } = await searchParams;

  const validDiscipline =
    discipline && Object.values(Discipline).includes(discipline.toUpperCase() as Discipline)
      ? (discipline.toUpperCase() as Discipline)
      : undefined;

  const VALID_LEVELS = ["FOUNDATION", "BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
  const upperLevel = level ? level.toUpperCase() : undefined;
  const validLevel =
    upperLevel && (VALID_LEVELS as readonly string[]).includes(upperLevel)
      ? (upperLevel as CourseLevel)
      : undefined;

  const [courses, allPublishedCourses, allMyEnrollments, myRequests] = await Promise.all([
    db.course.findMany({
      where: {
        isPublished: true,
        ...(validDiscipline ? { discipline: validDiscipline } : {}),
        ...(validLevel ? { level: validLevel } : {}),
      },
      orderBy: { priceMinorUnits: "asc" },
    }),
    db.course.findMany({
      where: { isPublished: true },
      select: { id: true, discipline: true, level: true },
    }),
    db.enrollment.findMany({
      where: { studentId: user.id },
      include: { course: true },
      orderBy: { startedAt: "desc" },
    }),
    db.courseEnrollmentRequest.findMany({
      where: { studentId: user.id },
      include: { course: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const teacherIds = allMyEnrollments
    .map((e: any) => e.teacherId)
    .filter(Boolean) as string[];

  const dbTeachers =
    teacherIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, name: true },
        })
      : [];

  const teacherMap = new Map<string, string>();
  for (const t of dbTeachers) {
    teacherMap.set(t.id, t.name || "Assigned Teacher");
  }

  const formattedEnrollments: EnrolledCourseItem[] = allMyEnrollments.map((e: any) => ({
    id: e.id,
    courseTitle: e.course.title,
    courseSlug: e.course.slug,
    discipline: e.course.discipline,
    instrument: e.course.instrument,
    sessionsTotal: e.course.sessionCount,
    sessionsRemaining: e.sessionsRemaining,
    status: e.status,
    paymentPlan: e.paymentPlan,
    emiStatus: e.emiStatus,
    teacherName: e.teacherId ? teacherMap.get(e.teacherId) || null : null,
    startedAt: new Date(e.startedAt).toISOString(),
  }));

  const formattedRequests: CourseRequestItem[] = myRequests.map((r: any) => ({
    id: r.id,
    courseTitle: r.course.title,
    courseSlug: r.course.slug,
    discipline: r.course.discipline,
    instrument: r.course.instrument,
    paymentPlan: r.paymentPlan,
    status: r.status,
    studentNotes: r.studentNotes,
    adminNotes: r.adminNotes,
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  // Build filter URLs maintaining or clearing parameters cleanly
  const getFilterUrl = (newDiscipline?: string | null, newLevel?: string | null) => {
    const params = new URLSearchParams();
    const d = newDiscipline === null ? undefined : (newDiscipline !== undefined ? newDiscipline : discipline);
    const l = newLevel === null ? undefined : (newLevel !== undefined ? newLevel : level);
    if (d) params.set("discipline", String(d).toLowerCase());
    if (l) params.set("level", String(l).toLowerCase());
    const query = params.toString();
    return query ? `/student/dashboard/courses?${query}` : `/student/dashboard/courses`;
  };

  const levelOptions = [
    { key: "FOUNDATION", label: "Foundation" },
    { key: "BEGINNER", label: "Beginner" },
    { key: "INTERMEDIATE", label: "Intermediate" },
    { key: "ADVANCED", label: "Advanced" },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Active Enrolled Courses & Course Requests Status */}
      <StudentEnrolledCoursesSection
        enrollments={formattedEnrollments}
        requests={formattedRequests}
      />

      {/* Header & Filter Navigation */}
      <div className="flex flex-col gap-5 border-b border-surface-muted/80 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <SplitHeading
              as="h1"
              firstClause="Course"
              accentClause="Catalog"
              size="lg"
            />
          </div>

          {(discipline || level) && (
            <a
              href="/student/dashboard/courses"
              className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-alt/50 hover:bg-bg-alt border border-surface-muted text-xs font-bold text-body hover:text-heading transition-all self-start sm:self-auto cursor-pointer active:scale-[0.98]"
            >
              <span>Reset All Filters</span>
            </a>
          )}
        </div>

        {/* Dual Filter Controls Bar */}
        <div className="p-3.5 rounded-2xl bg-white border border-surface-muted/90 shadow-xs space-y-3">
          {/* Row 1: Discipline Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-body-muted w-24 shrink-0">
              Discipline:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <a
                href={getFilterUrl(null, undefined)}
                className={`btn-tactile px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 ${
                  !discipline
                    ? "bg-primary text-white shadow-xs"
                    : "text-body hover:text-heading hover:bg-bg-alt/40 border border-transparent"
                }`}
              >
                <span>All Disciplines</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    !discipline ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {allPublishedCourses.filter(c => validLevel ? c.level === validLevel : true).length}
                </span>
              </a>
              <a
                href={getFilterUrl("instrument", undefined)}
                className={`btn-tactile px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 ${
                  discipline?.toLowerCase() === "instrument"
                    ? "bg-primary text-white shadow-xs"
                    : "text-body hover:text-heading hover:bg-bg-alt/40 border border-transparent"
                }`}
              >
                <span>Instruments</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    discipline?.toLowerCase() === "instrument" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {allPublishedCourses.filter(c => c.discipline === Discipline.INSTRUMENT && (validLevel ? c.level === validLevel : true)).length}
                </span>
              </a>
              <a
                href={getFilterUrl("vocals", undefined)}
                className={`btn-tactile px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 ${
                  discipline?.toLowerCase() === "vocals"
                    ? "bg-primary text-white shadow-xs"
                    : "text-body hover:text-heading hover:bg-bg-alt/40 border border-transparent"
                }`}
              >
                <span>Vocals</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    discipline?.toLowerCase() === "vocals" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {allPublishedCourses.filter(c => c.discipline === Discipline.VOCALS && (validLevel ? c.level === validLevel : true)).length}
                </span>
              </a>
              <a
                href={getFilterUrl("dance", undefined)}
                className={`btn-tactile px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 ${
                  discipline?.toLowerCase() === "dance"
                    ? "bg-primary text-white shadow-xs"
                    : "text-body hover:text-heading hover:bg-bg-alt/40 border border-transparent"
                }`}
              >
                <span>Dance</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    discipline?.toLowerCase() === "dance" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {allPublishedCourses.filter(c => c.discipline === Discipline.DANCE && (validLevel ? c.level === validLevel : true)).length}
                </span>
              </a>
            </div>
          </div>

          {/* Row 2: Level Filter (Foundation, Beginner, Intermediate, Advanced) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2.5 border-t border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-body-muted w-24 shrink-0">
              Proficiency:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <a
                href={getFilterUrl(undefined, null)}
                className={`btn-tactile px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 ${
                  !level
                    ? "bg-accent text-white shadow-xs"
                    : "text-body hover:text-heading hover:bg-bg-alt/40 border border-slate-200/60 bg-white"
                }`}
              >
                <span>All Levels</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    !level ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {allPublishedCourses.filter(c => validDiscipline ? c.discipline === validDiscipline : true).length}
                </span>
              </a>

              {levelOptions.map(({ key, label }) => {
                const isSelected = level?.toUpperCase() === key;
                const count = allPublishedCourses.filter(
                  (c) => (validDiscipline ? c.discipline === validDiscipline : true) && String(c.level).toUpperCase() === key
                ).length;

                return (
                  <a
                    key={key}
                    href={getFilterUrl(undefined, key)}
                    className={`btn-tactile px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-accent text-white shadow-xs"
                        : "text-body hover:text-heading hover:bg-bg-alt/40 border border-slate-200/60 bg-white"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-surface-muted rounded-2xl bg-bg-alt/20 space-y-3">
          <p className="text-heading font-bold text-sm">No courses found matching this criteria.</p>
          <p className="text-body text-xs max-w-sm mx-auto">
            Try adjusting your discipline or proficiency level filter to discover available courses.
          </p>
          {(discipline || level) && (
            <div className="pt-2">
              <a
                href="/student/dashboard/courses"
                className="btn-tactile inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98]"
              >
                Clear Filters
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              basePath="/student/dashboard/courses"
            />
          ))}
        </div>
      )}
    </div>
  );
}

