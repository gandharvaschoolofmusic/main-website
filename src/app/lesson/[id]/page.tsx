import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentUser, requireLessonParticipant } from "@/lib/auth-helpers";
import { formatInViewerTimezone, getTimezoneAbbr } from "@/lib/timezone";
import { JOIN_WINDOW_MINUTES_BEFORE, JOIN_WINDOW_MINUTES_AFTER } from "@/types";
import { LessonRoomClient } from "@/components/room/LessonRoomClient";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { Clock, Calendar, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert } from "lucide-react";

interface LessonPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ early?: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Live Studio Classroom | Gandharva School of Music",
  description: "1-to-1 live acoustic music lesson room calibrated for pristine musical audio.",
};

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const { id: lessonId } = await params;
  const query = searchParams ? await searchParams : {};
  const isEarlyRequested = query?.early === "true";

  const viewer = await getCurrentUser();
  if (!viewer?.id) {
    redirect(`/login?callbackUrl=/lesson/${lessonId}`);
  }

  // 1. Participant authorization
  let lessonData;
  try {
    lessonData = await requireLessonParticipant(lessonId, viewer.id);
  } catch (err: unknown) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-bg via-bg-alt/25 to-bg flex items-center justify-center p-4 sm:p-6">
        <div className="relative max-w-md w-full overflow-hidden rounded-2xl bg-white p-7 sm:p-9 text-center space-y-6 shadow-xl shadow-stone-900/10">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-primary" />
          
          <div className="flex justify-center">
            <Image
              src="/cropped-Add-a-subheading-5-png-scaled.webp"
              alt="Gandharva School of Music"
              width={160}
              height={44}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-serif text-heading">
              Access Restricted
            </h2>
            <p className="text-xs sm:text-sm text-body leading-relaxed">
              You are not a registered participant for this lesson room. Please sign in with the student or teacher account assigned to this session.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-primary via-cta to-accent hover:opacity-95 text-white text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95"
            >
              <span>Return to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { lesson, callerRole } = lessonData;
  const userTimezone = viewer.timezone || "UTC";

  // 2. Fetch partner name
  const isGroupLesson = !!lesson.groupRoomId;
  const partnerId =
    callerRole === "TEACHER" ? lesson.studentId : lesson.teacherId;
  const partner = await db.user.findUnique({
    where: { id: partnerId },
    select: { name: true, email: true },
  });

  let partnerName: string;
  if (isGroupLesson && callerRole === "TEACHER") {
    // Teacher sees "Group Session" instead of one student's name
    partnerName = "Group Session";
  } else {
    partnerName = partner?.name || (callerRole === "TEACHER" ? "Student" : "Teacher");
  }

  const dashboardHref =
    callerRole === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard";

  // 3. Status checks: CANCELLED
  if (lesson.status === "CANCELLED") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-bg via-bg-alt/25 to-bg flex items-center justify-center p-4 sm:p-6">
        <div className="relative max-w-md w-full overflow-hidden rounded-2xl bg-white p-7 sm:p-9 text-center space-y-6 shadow-xl shadow-stone-900/10">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-primary to-cta" />

          <div className="flex justify-center">
            <Image
              src="/cropped-Add-a-subheading-5-png-scaled.webp"
              alt="Gandharva School of Music"
              width={160}
              height={44}
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-amber-600 font-mono">
              Session Notice
            </span>
            <h2 className="text-2xl font-bold font-serif text-heading">
              Lesson Cancelled
            </h2>
            <p className="text-xs sm:text-sm text-body leading-relaxed">
              This {lesson.instrument} session was cancelled and the live classroom is currently inactive. Any trial or enrollment credits have been preserved.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={dashboardHref}
              className="inline-flex w-full items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-primary via-cta to-accent hover:opacity-95 text-white text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Access Window Time Enforcement
  const now = new Date();
  const startsAt = new Date(lesson.startsAt);
  const endsAt = new Date(startsAt.getTime() + lesson.durationMinutes * 60_000);

  const earlyOpenTime = new Date(
    startsAt.getTime() - JOIN_WINDOW_MINUTES_BEFORE * 60_000,
  );
  const expiryTime = new Date(
    endsAt.getTime() + JOIN_WINDOW_MINUTES_AFTER * 60_000,
  );

  // Too early — only teachers and admins can enter early via pre-flight
  const canEnterEarly = callerRole === "TEACHER" || viewer.role === "ADMIN";
  if (now < earlyOpenTime && !(isEarlyRequested && canEnterEarly)) {
    const formattedStartTime = formatInViewerTimezone(
      startsAt,
      userTimezone,
      "EEEE, MMMM d 'at' h:mm a",
    );
    const tzAbbr = getTimezoneAbbr(startsAt, userTimezone);
    const minutesRemaining = Math.ceil(
      (earlyOpenTime.getTime() - now.getTime()) / 60_000,
    );

    return (
      <div className="min-h-screen bg-gradient-to-b from-bg via-bg-alt/25 to-bg flex items-center justify-center p-4 sm:p-6">
        <div className="relative max-w-md w-full overflow-hidden rounded-2xl bg-white p-7 sm:p-9 text-center space-y-6 shadow-xl shadow-stone-900/10">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-cta to-accent" />

          <div className="flex justify-center">
            <Image
              src="/cropped-Add-a-subheading-5-png-scaled.webp"
              alt="Gandharva School of Music"
              width={160}
              height={44}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock className="h-7 w-7" />
          </div>

          <div className="space-y-1.5">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-cta font-mono">
              Classroom Waiting Room
            </span>
            <h1 className="text-2xl font-bold font-serif text-heading">
              {lesson.instrument} with {partnerName}
            </h1>
            <p className="text-xs sm:text-sm text-body">
              Scheduled for <strong className="text-heading font-semibold">{formattedStartTime} ({tzAbbr})</strong>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-alt/70 text-xs text-body space-y-1 text-left shadow-sm">
            <p className="text-heading font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Room Opens 10 Minutes Before Start
            </p>
            <p className="text-[11px] text-body/80 leading-relaxed">
              Scheduled to begin in approximately {minutesRemaining} minute{minutesRemaining === 1 ? "" : "s"}. You can enter now to test your microphone, camera, and instrument audio pre-flight settings.
            </p>
          </div>

          <div className="pt-2 space-y-2.5">
            {canEnterEarly ? (
              <Link
                href={`/lesson/${lesson.id}?early=true`}
                className="inline-flex w-full items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-primary via-cta to-accent hover:opacity-95 text-white text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95"
              >
                <span>Enter Pre-Flight Audio Check</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="p-3 rounded-xl bg-primary-subtle border border-primary/20 text-xs text-body text-center">
                The room will open automatically when it&apos;s time. Please check back in <strong className="text-heading">{minutesRemaining} minute{minutesRemaining === 1 ? "" : "s"}</strong>.
              </div>
            )}

            <Link
              href={dashboardHref}
              className="inline-flex w-full items-center justify-center py-2.5 px-4 rounded-xl bg-surface-muted/30 hover:bg-surface-muted/60 text-heading text-xs font-semibold transition-all active:scale-95"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Too late (session concluded)
  if (now > expiryTime && viewer.role !== "ADMIN") {
    const formattedEndTime = formatInViewerTimezone(
      endsAt,
      userTimezone,
      "EEEE, MMMM d 'at' h:mm a",
    );
    const tzAbbr = getTimezoneAbbr(endsAt, userTimezone);

    return (
      <div className="min-h-screen bg-gradient-to-b from-bg via-bg-alt/25 to-bg flex items-center justify-center p-4 sm:p-6">
        <div className="relative max-w-md w-full overflow-hidden rounded-2xl bg-white p-7 sm:p-9 text-center space-y-6 shadow-xl shadow-stone-900/10">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-cta" />

          <div className="flex justify-center">
            <Image
              src="/cropped-Add-a-subheading-5-png-scaled.webp"
              alt="Gandharva School of Music"
              width={160}
              height={44}
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-emerald-600 font-mono">
              Session Concluded
            </span>
            <h2 className="text-2xl font-bold font-serif text-heading">
              Lesson Completed
            </h2>
            <p className="text-xs sm:text-sm text-body leading-relaxed">
              This live session concluded on {formattedEndTime} ({tzAbbr}). The live classroom is now closed.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={dashboardHref}
              className="inline-flex w-full items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-primary via-cta to-accent hover:opacity-95 text-white text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95"
            >
              <span>Return to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active / Pre-flight Window: Render Live Lesson Studio
  return (
    <LessonRoomClient
      lesson={{
        id: lesson.id,
        instrument: lesson.instrument,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationMinutes: lesson.durationMinutes,
        partnerName,
        isTeacher: callerRole === "TEACHER",
        callerRole,
        lessonSource: lesson.lessonSource,
      }}
    />
  );
}
