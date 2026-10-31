import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import {
  BookOpen,
  Clock,
  Award,
  CheckCircle2,
  ArrowLeft,
  GraduationCap,
  ShieldCheck,
  Calendar,
  Users,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { CourseEnrollmentRequestModal } from "@/components/courses/CourseEnrollmentRequestModal";
import { CourseEmiBreakdown } from "@/components/courses/CourseEmiBreakdown";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { formatInViewerTimezone, getTimezoneAbbr } from "@/lib/timezone";
import { PriceDisplay } from "@/components/currency/PriceDisplay";
import { cleanDescriptionText } from "@/lib/pricing-tiers";

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireRole(Role.STUDENT);
  const studentTimezone = user.timezone || "UTC";
  const { slug } = await params;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      teachers: {
        include: {
          teacher: {
            include: {
              teacherProfile: true,
            },
          },
        },
      },
      lessons: {
        orderBy: { lessonNumber: "asc" },
        include: {
          teacher: true,
        },
      },
    },
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  // Check if student already enrolled, has pending request, and whether trial was converted
  const [existingEnrollment, pendingRequestRecord, convertedTrial] = await Promise.all([
    db.enrollment.findFirst({
      where: {
        studentId: user.id,
        courseId: course.id,
        status: "ACTIVE",
      },
    }),
    db.courseEnrollmentRequest.findFirst({
      where: {
        studentId: user.id,
        courseId: course.id,
        status: "PENDING",
      },
    }),
    db.trialRequest.findFirst({
      where: {
        studentId: user.id,
        isConverted: true,
      },
    }),
  ]);

  const isConvertedStudent = Boolean(convertedTrial);

  const pendingRequest = pendingRequestRecord
    ? {
        id: pendingRequestRecord.id,
        status: pendingRequestRecord.status,
        paymentPlan: pendingRequestRecord.paymentPlan,
        createdAt: pendingRequestRecord.createdAt.toISOString(),
      }
    : null;

  const priceFormatted = `₹${(course.priceMinorUnits / 100).toLocaleString("en-IN")}`;
  const syllabusItems = course.syllabusSummary.split("•").map((s) => s.trim()).filter(Boolean);

  const startDateFormatted = course.startDate
    ? formatInViewerTimezone(course.startDate, studentTimezone, "MMM d, yyyy")
    : null;
  const endDateFormatted = course.endDate
    ? formatInViewerTimezone(course.endDate, studentTimezone, "MMM d, yyyy")
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back Link */}
      <Link
        href="/student/dashboard/courses"
        className="inline-flex items-center gap-2 text-xs font-semibold text-body hover:text-primary transition-colors btn-tactile"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Course Catalog
      </Link>

      {/* Main Course Header Card */}
      <div className="bg-white border border-border-default rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent-subtle text-accent-dark border border-accent/30">
              {course.discipline}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-subtle text-primary border border-primary/30">
              Level: {course.level}
            </span>
            {course.accreditation && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-bg-alt text-cta border border-cta/30">
                <Award className="w-3.5 h-3.5 text-cta" />
                {course.accreditation}
              </span>
            )}
            {startDateFormatted && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                {startDateFormatted} {endDateFormatted ? `– ${endDateFormatted}` : "(Batch Start)"}
              </span>
            )}
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-heading leading-tight">
            {course.title}
          </h1>

          <p className="text-sm sm:text-base text-body leading-relaxed max-w-3xl">
            {cleanDescriptionText(course.description)}
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-bg-alt/40 border border-border-subtle space-y-1">
            <div className="flex items-center gap-2 text-accent-dark text-xs font-bold">
              <BookOpen className="w-4 h-4" /> Curriculum
            </div>
            <div className="text-xl font-bold text-heading">
              {course.sessionCount} Sessions
            </div>
            <div className="text-[11px] text-body-muted">1-on-1 masterclasses</div>
          </div>

          <div className="p-4 rounded-2xl bg-bg-alt/40 border border-border-subtle space-y-1">
            <div className="flex items-center gap-2 text-primary text-xs font-bold">
              <Clock className="w-4 h-4" /> Duration
            </div>
            <div className="text-xl font-bold text-heading">
              {course.durationWeeks} Weeks
            </div>
            <div className="text-[11px] text-body-muted">Paced learning schedule</div>
          </div>

          <div className="p-4 rounded-2xl bg-bg-alt/40 border border-border-subtle space-y-1">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-bold">
              <Calendar className="w-4 h-4" /> Schedule
            </div>
            <div className="text-sm font-bold text-heading truncate">
              {startDateFormatted ? startDateFormatted : "Flexible Start"}
            </div>
            <div className="text-[11px] text-body-muted">
              {endDateFormatted ? `Until ${endDateFormatted}` : "Self-paced batch"}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-bg-alt/40 border border-border-subtle space-y-1">
            <div className="flex items-center gap-2 text-success text-xs font-bold">
              <GraduationCap className="w-4 h-4" /> Credential
            </div>
            <div className="text-sm font-bold text-heading truncate">
              Verified Diploma
            </div>
            <div className="text-[11px] text-body-muted">Authentic certificate</div>
          </div>
        </div>

        {/* Assigned Faculty Mentors */}
        {course.teachers.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="font-serif text-lg font-bold text-heading">
                Allotted Faculty Mentors
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {course.teachers.map(({ teacher }) => (
                <div
                  key={teacher.id}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-bg-alt/50 border border-border-subtle"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {teacher.name?.[0]?.toUpperCase() || "T"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-heading truncate">
                      {teacher.name}
                    </div>
                    <div className="text-xs text-body-muted truncate">
                      {teacher.teacherProfile?.instruments?.join(", ") || course.instrument} • {teacher.teacherProfile?.yearsTeaching ? `${teacher.teacherProfile.yearsTeaching} yrs experience` : "Senior Guru"}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-border-subtle text-[10px] font-semibold text-primary">
                    Course Faculty
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Lesson Schedule / Curriculum */}
        <div className="space-y-3 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <SplitHeading
              as="h2"
              firstClause="Curriculum"
              accentClause="Modules"
              size="md"
            />
            <span className="text-xs text-body-muted">
              {course.lessons.length > 0
                ? `${course.lessons.length} curriculum modules`
                : `${course.sessionCount} sessions total`}
            </span>
          </div>

          {course.lessons.length > 0 ? (
            <div className="space-y-2">
              {course.lessons.map((lesson) => {
                return (
                  <div
                    key={lesson.id}
                    className="p-3.5 rounded-xl bg-bg-alt/30 border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary-subtle text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                        {lesson.lessonNumber}
                      </div>
                      <div>
                        <div className="font-bold text-heading text-sm">
                          {lesson.title}
                        </div>
                        {lesson.description && (
                          <p className="text-body-muted text-xs mt-0.5">
                            {lesson.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-body-muted">
                          <span className="flex items-center gap-1 text-accent-dark font-medium">
                            <Sparkles className="w-3 h-3 text-accent" />
                            1-on-1 Private Masterclass
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <UserCheck className="w-3 h-3" />
                            Allotted Faculty Mentor
                          </span>
                          <span>•</span>
                          <span>{lesson.durationMinutes} min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {syllabusItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-bg-alt/30 border border-border-subtle text-xs text-heading font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent-dark shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin Mentor Assignment Note */}
        <div className="p-4 rounded-2xl bg-primary-subtle border border-primary/20 text-xs text-heading space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-primary">
            <ShieldCheck className="w-4 h-4 text-primary" /> Dedicated 1-on-1 Faculty Allotment & Scheduling
          </p>
          <p className="text-body leading-relaxed">
            Upon enrollment, academy administration assigns a dedicated faculty mentor specifically for you and arranges your personalized 1-on-1 masterclass timetable. Every session is conducted in a private video classroom (strictly 1:1, not a group class) with unique tracking IDs for payment and attendance verification.
          </p>
        </div>

        {/* Checkout & Purchase Box */}
        <div className="pt-6 border-t border-border-subtle space-y-5">
          <div className="p-5 rounded-2xl bg-bg-alt/40 border border-border-subtle space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-heading">
              Order Summary & Inclusions
            </h3>
            <div className="divide-y divide-border-subtle/70 text-xs space-y-2">
              <div className="flex justify-between items-center pt-1 text-body">
                <span>{course.sessionCount} Private 1-on-1 Masterclass Sessions</span>
                <span className="font-semibold text-heading">Included</span>
              </div>
              <div className="flex justify-between items-center pt-2 text-body">
                <span>Dedicated Faculty Mentor Allotment</span>
                <span className="font-semibold text-heading">Included</span>
              </div>
              {course.accreditation && (
                <div className="flex justify-between items-center pt-2 text-body">
                  <span>Exam Preparation ({course.accreditation})</span>
                  <span className="font-semibold text-heading">Included</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 text-body">
                <span>Verified Gandharva Academy Diploma Certificate</span>
                <span className="font-semibold text-heading">Included</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-3 gap-2">
                <div>
                  <div className="text-sm font-bold text-heading">
                    Total Tuition Fee (All Inclusive)
                  </div>
                </div>
                <div className="sm:text-right">
                  <PriceDisplay
                    priceMinorUnits={course.priceMinorUnits}
                    level={course.level}
                    sessionCount={course.sessionCount}
                    description={course.description}
                    size="2xl"
                    showOriginalStrike
                    showDiscountBadge
                    showPerSessionBadge
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Course Tuition Breakdown */}
          <CourseEmiBreakdown
            priceMinorUnits={course.priceMinorUnits}
            level={course.level}
            sessionCount={course.sessionCount}
            description={course.description}
          />

          {/* Request Course Admission Modal / Actions */}
          <CourseEnrollmentRequestModal
            courseId={course.id}
            courseTitle={course.title}
            courseSlug={course.slug}
            sessionCount={course.sessionCount}
            durationWeeks={course.durationWeeks}
            priceMinorUnits={course.priceMinorUnits}
            description={course.description}
            level={course.level}
            isAlreadyEnrolled={!!existingEnrollment}
            pendingRequest={pendingRequest}
            isAuthenticated={true}
            isConvertedStudent={isConvertedStudent}
          />
        </div>
      </div>
    </div>
  );
}
