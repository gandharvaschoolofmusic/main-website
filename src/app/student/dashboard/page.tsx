import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { Role, EnrollmentStatus, TrialRequestStatus } from "@prisma/client";
import { formatInViewerTimezone, getTimezoneAbbr } from "@/lib/timezone";
import {
  StudentLessonList,
  StudentDashboardLesson,
} from "@/components/dashboard/StudentLessonList";
import { TrialStatusStrip } from "@/components/dashboard/TrialStatusStrip";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { getLessonTrackingId } from "@/lib/lesson-tracking";

export const metadata = {
  title: "Upcoming Sessions | Student Portal | Gandharva School of Music",
  description:
    "View scheduled live music lessons, trial status, and join video classrooms.",
};

export default async function StudentDashboardPage() {
  const user = await requireRole(Role.STUDENT);
  const studentTimezone = user.timezone || "UTC";

  // Fetch trial status, active enrollment, lessons, and trial requests in parallel
  let trialStatus: any = null;
  let activeEnrollment: any = null;
  let dbLessons: any[] = [];
  let trialRequests: any[] = [];

  try {
    [trialStatus, activeEnrollment, dbLessons, trialRequests] = await Promise.all([
      db.studentTrialStatus.findUnique({
        where: { studentId: user.id },
      }),
      db.enrollment.findFirst({
        where: {
          studentId: user.id,
          status: EnrollmentStatus.ACTIVE,
        },
        include: {
          course: {
            select: {
              title: true,
              sessionCount: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
      }),
      db.lesson.findMany({
        where: {
          studentId: user.id,
        },
        include: {
          teacher: {
            select: {
              name: true,
              email: true,
              timezone: true,
            },
          },
          teacherProfile: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          startsAt: "desc",
        },
        take: 60,
      }),
      db.trialRequest.findMany({
        where: {
          studentId: user.id,
        },
        select: {
          id: true,
          instrument: true,
          ageGroup: true,
          requestedStartsAt: true,
          preferredTimeSlot: true,
          studentNotes: true,
          status: true,
          isConverted: true,
        },
        orderBy: { requestedStartsAt: "desc" },
        take: 5,
      }),
    ]);
  } catch (err) {
    console.error("Failed to load student dashboard data:", err);
  }

  const pendingTrialRequest =
    trialRequests.find((t: any) => t.status === TrialRequestStatus.PENDING) || null;
  const isConverted = trialRequests.some((t: any) => t.isConverted);

  const pendingTrialReqDate = pendingTrialRequest?.requestedStartsAt
    ? new Date(pendingTrialRequest.requestedStartsAt)
    : null;
  const isPendingReqDateValid = pendingTrialReqDate && !isNaN(pendingTrialReqDate.getTime());

  const formattedLessons: StudentDashboardLesson[] = dbLessons.map((l) => {
    const startsAtDate = new Date(l.startsAt);
    const isStartsValid = !isNaN(startsAtDate.getTime());
    const endsAtDate = isStartsValid
      ? new Date(startsAtDate.getTime() + (l.durationMinutes || 60) * 60_000)
      : new Date();
    const isCancelledValid = l.cancelledAt && !isNaN(new Date(l.cancelledAt).getTime());

    return {
      id: l.id,
      instrument: l.instrument || "Music",
      startsAt: isStartsValid ? startsAtDate.toISOString() : new Date().toISOString(),
      endsAt: !isNaN(endsAtDate.getTime()) ? endsAtDate.toISOString() : new Date().toISOString(),
      durationMinutes: l.durationMinutes || 60,
      status: l.status,
      lessonSource: l.lessonSource,
      formattedTime: isStartsValid
        ? formatInViewerTimezone(
            startsAtDate,
            studentTimezone,
            "EEE, MMM d, yyyy 'at' h:mm a",
          )
        : "Date TBD",
      timezoneAbbr: isStartsValid ? getTimezoneAbbr(startsAtDate, studentTimezone) : "UTC",
      teacherName: l.teacher?.name || "Teacher",
      teacherProfileId: l.teacherProfile?.id || "",
      trackingCode: getLessonTrackingId(l),
      cancelledBy: l.cancelledBy,
      cancelledAt: isCancelledValid ? new Date(l.cancelledAt).toISOString() : null,
      recordingUrl: l.recordingUrl,
    };
  });

  return (
    <div className="space-y-6">
      {/* 1. High-Priority Trial Indicator (hidden for active enrolled students) */}
      {!activeEnrollment && (
        <TrialStatusStrip
          data={{
            trialStatus: trialStatus
              ? {
                  status: trialStatus.status,
                  lessonsGranted: trialStatus.lessonsGranted,
                  lessonsUsed: trialStatus.lessonsUsed,
                }
              : null,
            pendingTrialRequest: pendingTrialRequest
              ? {
                  id: pendingTrialRequest.id,
                  instrument: pendingTrialRequest.instrument,
                  ageGroup: pendingTrialRequest.ageGroup,
                  requestedStartsAt: isPendingReqDateValid ? pendingTrialReqDate.toISOString() : new Date().toISOString(),
                  preferredTimeSlot: pendingTrialRequest.preferredTimeSlot,
                  notes: pendingTrialRequest.studentNotes,
                }
              : null,
            isConverted,
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-2">
        <div className="flex items-center gap-4">
          <Link
            href="/student/dashboard/profile"
            className="relative group shrink-0"
            title="Edit Profile Picture"
          >
            {user.image ? (
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-md">
                <Image
                  src={user.image}
                  alt={user.name || "Student"}
                  fill
                  sizes="64px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary to-cta flex items-center justify-center text-white font-serif font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                {user.name?.slice(0, 2).toUpperCase() || "ST"}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-xs border border-surface-muted text-[10px] text-body group-hover:text-primary transition-colors">
              📷
            </div>
          </Link>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
              Sessions and Classes
            </span>
            <SplitHeading
              as="h1"
              firstClause="Upcoming"
              accentClause="Lessons"
              size="lg"
              className="mt-0.5"
            />
            <p className="text-xs sm:text-sm text-body mt-1">
              Displaying all times in your local timezone:{" "}
              <strong className="text-heading font-semibold">{studentTimezone}</strong>
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/student/dashboard/courses"
            className="btn-tactile inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cta hover:bg-cta-hover text-sm font-bold text-white shadow-md shadow-cta/25 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Browse and Buy Courses</span>
          </Link>
        </div>
      </div>

      {/* Main Tabbed Lesson List */}
      <StudentLessonList
        lessons={formattedLessons}
        userTimezone={studentTimezone}
        initialServerTime={Date.now()}
      />

      {/* Practice Notes & Syllabus Advice */}
      <div className="rounded-2xl border border-surface-muted/80 bg-white p-6 shadow-sm space-y-2">
        <h2 className="font-serif text-lg font-bold text-heading">
          Lesson Notes and Practice Goals
        </h2>
        <p className="text-xs sm:text-sm text-body leading-relaxed">
          Recap notes, practice assignments, and technical exercises provided
          by your faculty mentors will be logged here as your lessons conclude.
        </p>
      </div>
    </div>
  );
}

