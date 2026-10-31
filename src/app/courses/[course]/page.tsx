import { notFound } from "next/navigation";
import { CourseDataAll } from "@/Data/course";
import CoursePage, { CourseDataAllType } from "./Client";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import Link from "next/link";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { PriceDisplay } from "@/components/currency/PriceDisplay";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import {
  BookOpen,
  Clock,
  Award,
  CheckCircle2,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";
import { CourseEnrollmentRequestModal } from "@/components/courses/CourseEnrollmentRequestModal";
import { CourseEmiBreakdown } from "@/components/courses/CourseEmiBreakdown";

const siteURL = "https://www.gandharvaschoolofmusic.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string }>;
}): Promise<Metadata> {
  const course = (await params).course;
  // @ts-expect-error improve
  const courseInfo: CourseDataAllType = CourseDataAll[`${course}All`];

  if (courseInfo) {
    return {
      title: `Learn Online ${courseInfo.title} Courses | Gandharva School Of Music`,
      description: `Master the ${courseInfo.title} from anywhere with world-class online lessons at Gandharva School of Music. Flexible programs for kids, teens, and adults. Start your musical journey today`,
      alternates: {
        canonical: `${siteURL}/courses/${course}/`,
      },
    };
  }

  try {
    const dbCourse = await db.course.findUnique({
      where: { slug: course },
      select: { title: true, description: true },
    });
    if (dbCourse) {
      const cleanDesc = dbCourse.description.replace(/\s*<!--\s*pricing:[\s\S]*?-->/g, "").trim();
      return {
        title: `${dbCourse.title} | Gandharva School of Music`,
        description: cleanDesc.slice(0, 160),
      };
    }
  } catch {
    // ignore
  }

  return {
    title: "Course Not Found",
    description: "The course you're looking for does not exist.",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const courseSlug = (await params).course;
  // @ts-expect-error improve
  const courseInfo: CourseDataAllType = CourseDataAll[`${courseSlug}All`];

  if (courseInfo) {
    return <CoursePage params={{ courseData: courseInfo }} />;
  }

  // Fallback to Prisma DB course
  const user = await getCurrentUser();
  const course = await db.course.findUnique({
    where: { slug: courseSlug },
  });

  if (!course || !course.isPublished) {
    return notFound();
  }

  const syllabusItems = course.syllabusSummary
    .split("•")
    .map((s) => s.trim())
    .filter(Boolean);

  let isAlreadyEnrolled = false;
  let pendingRequest: {
    id: string;
    status: string;
    paymentPlan: any;
    createdAt: string;
  } | null = null;
  let isConvertedStudent = false;

  if (user) {
    const [enrollment, req, convertedTrial] = await Promise.all([
      db.enrollment.findFirst({
        where: { studentId: user.id, courseId: course.id, status: "ACTIVE" },
      }),
      db.courseEnrollmentRequest.findFirst({
        where: { studentId: user.id, courseId: course.id, status: "PENDING" },
      }),
      db.trialRequest.findFirst({
        where: { studentId: user.id, isConverted: true },
      }),
    ]);
    isAlreadyEnrolled = !!enrollment;
    isConvertedStudent = Boolean(convertedTrial);
    if (req) {
      pendingRequest = {
        id: req.id,
        status: req.status,
        paymentPlan: req.paymentPlan,
        createdAt: req.createdAt.toISOString(),
      };
    }
  }

  return (
    <div className="min-h-screen bg-bg text-body py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 text-xs font-bold text-body-muted hover:text-heading transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to All Courses
        </Link>

        <div className="bg-white border border-border-default rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="space-y-4">
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
            </div>

            <SplitHeading
              as="h1"
              size="2xl"
              firstClause={course.title}
              accentClause="Curriculum"
            />

            <p className="text-sm sm:text-base text-body leading-relaxed max-w-3xl">
              {course.description.replace(/\s*<!--\s*pricing:[\s\S]*?-->/g, "").trim()}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-bg-alt/50 border border-border-subtle space-y-1">
              <div className="flex items-center gap-2 text-accent-dark text-xs font-bold">
                <BookOpen className="w-4 h-4 text-accent" /> Curriculum
              </div>
              <div className="text-xl font-bold font-serif text-heading">
                {course.sessionCount} Sessions
              </div>
              <div className="text-[11px] text-body-muted">1-to-1 masterclasses</div>
            </div>

            <div className="p-4 rounded-2xl bg-bg-alt/50 border border-border-subtle space-y-1">
              <div className="flex items-center gap-2 text-primary text-xs font-bold">
                <Clock className="w-4 h-4 text-primary" /> Duration
              </div>
              <div className="text-xl font-bold font-serif text-heading">
                {course.durationWeeks} Weeks
              </div>
              <div className="text-[11px] text-body-muted">Paced progression</div>
            </div>

            <div className="p-4 rounded-2xl bg-bg-alt/50 border border-border-subtle space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-success text-xs font-bold">
                <GraduationCap className="w-4 h-4 text-success" /> Credential
              </div>
              <div className="text-base font-bold font-serif text-heading truncate">
                Verified Diploma
              </div>
              <div className="text-[11px] text-body-muted">Accredited completion</div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border-subtle">
            <SplitHeading
              as="h2"
              size="md"
              firstClause="Course Syllabus &"
              accentClause="Key Milestones"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {syllabusItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-bg-alt/30 border border-border-subtle text-xs text-heading font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tuition Fee, EMI Breakdown & Admission Request */}
          <div className="pt-6 border-t border-border-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-body-muted">Course Tuition:</span>
                  <CurrencySelector variant="compact" />
                </div>
                <PriceDisplay
                  priceMinorUnits={course.priceMinorUnits}
                  level={course.level}
                  sessionCount={course.sessionCount}
                  description={course.description}
                  size="3xl"
                  showOriginalStrike
                  showDiscountBadge
                  showPerSessionBadge
                />
              </div>
            </div>

            <CourseEmiBreakdown
              priceMinorUnits={course.priceMinorUnits}
              level={course.level}
              sessionCount={course.sessionCount}
              description={course.description}
            />

            <CourseEnrollmentRequestModal
              courseId={course.id}
              courseTitle={course.title}
              courseSlug={course.slug}
              sessionCount={course.sessionCount}
              durationWeeks={course.durationWeeks}
              priceMinorUnits={course.priceMinorUnits}
              description={course.description}
              level={course.level}
              isAlreadyEnrolled={isAlreadyEnrolled}
              pendingRequest={pendingRequest}
              isAuthenticated={!!user}
              isConvertedStudent={isConvertedStudent}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
