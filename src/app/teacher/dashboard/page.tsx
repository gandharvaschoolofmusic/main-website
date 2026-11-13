import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { Role } from "@prisma/client";
import { PublishStatusButton } from "@/components/teacher/PublishStatusButton";
import { formatInViewerTimezone, getTimezoneAbbr, formatDeterministicDate } from "@/lib/timezone";
import { TeacherLessonList, TeacherDashboardLesson } from "@/components/dashboard/TeacherLessonList";
import { Calendar, Clock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Upcoming Sessions | Teacher Studio | Gandharva School of Music",
  description: "View scheduled live music lessons, enter video rooms, and manage students.",
};

export default async function TeacherDashboardPage() {
  const user = await requireRole(Role.TEACHER);

  let profile: any = null;
  try {
    profile = await db.teacherProfile.findUnique({
      where: { userId: user.id },
      include: {
        availabilityRules: {
          select: { id: true },
        },
        lessonsAsTeacher: {
          include: {
            student: {
              select: {
                name: true,
                email: true,
                timezone: true,
              },
            },
            enrollment: {
              select: {
                course: {
                  select: { title: true },
                },
              },
            },
          },
          orderBy: { startsAt: "desc" },
          take: 60,
        },
      },
    });
  } catch (err) {
    console.error("Failed to load teacher dashboard profile:", err);
  }

  // Ensure newly registered teacher has a teacherProfile record
  if (!profile) {
    try {
      profile = await db.teacherProfile.create({
        data: {
          userId: user.id,
          bio: "",
          instruments: [],
          expertInstruments: [],
          moderateInstruments: [],
          yearsTeaching: 0,
          hourlyRate: 50000,
          payoutPerSession: 50000,
          currency: "INR",
          languages: ["English"],
          isPublished: false,
          approvalStatus: "PENDING",
        },
        include: {
          availabilityRules: { select: { id: true } },
          lessonsAsTeacher: true,
        },
      });
    } catch (createErr) {
      console.warn("Failed to auto-create missing teacherProfile in TeacherDashboardPage:", createErr);
    }
  }

  const isEmailVerified = !!user.emailVerified;
  const isPublished = !!profile?.isPublished;
  const rulesCount = profile?.availabilityRules?.length || 0;
  const hasBio = !!profile?.bio && profile.bio.trim().length >= 20;
  const hasInstruments = (profile?.instruments?.length || 0) > 0;
  const hasRate = (profile?.hourlyRate || 0) > 0;
  const hasAvailability = rulesCount > 0;

  const isApproved = profile?.approvalStatus === "APPROVED";
  const canPublish =
    isEmailVerified && hasBio && hasInstruments && hasRate && hasAvailability && isApproved;

  let blockReason = "";
  if (!isEmailVerified) blockReason = "Verify email first";
  else if (profile?.approvalStatus === "PENDING") blockReason = "Profile pending administrative review";
  else if (profile?.approvalStatus === "REJECTED") blockReason = `Application rejected: "${profile.rejectionReason || "Contact administration"}"`;
  else if (!hasBio) blockReason = "Bio must be at least 20 chars";
  else if (!hasInstruments) blockReason = "Add at least 1 instrument";
  else if (!hasRate) blockReason = "Set an hourly rate";
  else if (!hasAvailability) blockReason = "Configure weekly availability";

  const allLessons = profile?.lessonsAsTeacher || [];
  const scheduledLessons = allLessons.filter((l: any) => l.status === "SCHEDULED" || l.status === "RESCHEDULED");
  const completedLessons = allLessons.filter((l: any) => l.status === "COMPLETED");

  const formattedLessons: TeacherDashboardLesson[] = allLessons.map((l: any) => {
    const startsAtDate = new Date(l.startsAt);
    const isStartsValid = !isNaN(startsAtDate.getTime());
    const endsAtDate = isStartsValid
      ? new Date(startsAtDate.getTime() + (l.durationMinutes || 60) * 60_000)
      : new Date();

    const isTeacherJoinedValid = l.teacherJoinedAt && !isNaN(new Date(l.teacherJoinedAt).getTime());
    const isStudentJoinedValid = l.studentJoinedAt && !isNaN(new Date(l.studentJoinedAt).getTime());
    const isCancelledValid = l.cancelledAt && !isNaN(new Date(l.cancelledAt).getTime());

    return {
      id: l.id,
      instrument: l.instrument || "Music",
      startsAt: isStartsValid ? startsAtDate.toISOString() : new Date().toISOString(),
      endsAt: !isNaN(endsAtDate.getTime()) ? endsAtDate.toISOString() : new Date().toISOString(),
      durationMinutes: l.durationMinutes || 60,
      status: l.status,
      lessonSource: l.lessonSource as "TRIAL" | "ENROLLMENT",
      studentTimezone: l.student?.timezone || "UTC",
      courseTitle: l.enrollment?.course?.title,
      groupRoomId: l.groupRoomId,
      formattedTime: isStartsValid
        ? formatInViewerTimezone(
            startsAtDate,
            user.timezone || "UTC",
            "EEE, MMM d, yyyy 'at' h:mm a",
          )
        : "Date TBD",
      timezoneAbbr: isStartsValid ? getTimezoneAbbr(startsAtDate, user.timezone || "UTC") : "UTC",
      studentName: l.student?.name || "Student",
      studentEmail: l.student?.email || "",
      teacherJoinedAt: isTeacherJoinedValid ? new Date(l.teacherJoinedAt).toISOString() : null,
      studentJoinedAt: isStudentJoinedValid ? new Date(l.studentJoinedAt).toISOString() : null,
      cancelledBy: l.cancelledBy,
      cancelledAt: isCancelledValid ? new Date(l.cancelledAt).toISOString() : null,
      recordingUrl: l.recordingUrl,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border-default bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/teacher/dashboard/profile"
            className="relative group shrink-0"
            title="Edit Profile Picture"
          >
            {user.image ? (
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-md">
                <Image
                  src={user.image}
                  alt={user.name || "Teacher"}
                  fill
                  sizes="80px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-serif font-bold text-2xl shadow-md group-hover:scale-105 transition-transform">
                {user.name?.slice(0, 2).toUpperCase() || "FC"}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-xs border border-surface-muted text-[10px] text-body group-hover:text-primary transition-colors">
              📷
            </div>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-accent-dark font-sans">
                Gandharva Teacher Studio
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                  isPublished
                    ? "bg-success-muted text-success border-success/30"
                    : "bg-accent-subtle text-accent-dark border-accent/30"
                }`}
              >
                {isPublished ? "Public Profile Active" : "Draft / Unpublished"}
              </span>

              {profile?.approvalStatus === "APPROVED" ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Approved Teacher</span>
                </span>
              ) : profile?.approvalStatus === "REJECTED" ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-300">
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  <span>Revision Required</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
                  <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                  <span>Review Pending</span>
                </span>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-heading mt-1.5">
              Welcome back, {user.name || "Instructor"}
            </h1>
            <p className="mt-1 text-xs text-body">
              Teaching Timezone: <span className="text-heading font-bold">{user.timezone || "UTC"}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/teacher/dashboard/availability"
            className="rounded-xl border border-border-default bg-bg-alt/40 hover:bg-bg-alt/70 px-4 py-2.5 text-xs font-bold text-heading transition-all shadow-xs btn-tactile"
          >
            Manage Schedule
          </Link>
          <PublishStatusButton
            initialPublished={isPublished}
            canPublish={canPublish}
            blockReason={blockReason}
          />
        </div>
      </div>

      {/* ─── FACULTY APPROVAL STATE BANNERS ─────────────────────────────────────── */}
      {profile?.approvalStatus === "PENDING" && (
        <div className="relative overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 border border-amber-300 shadow-xs">
                <Clock className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    Application Under Review
                  </span>
                  <span className="text-xs text-body">
                    Submitted {formatDeterministicDate(profile?.createdAt)}
                  </span>
                </div>
                <h2 className="font-serif text-lg font-bold text-heading">
                  Teacher Accreditation Pending Administrative Approval
                </h2>
                <p className="text-xs text-body max-w-2xl leading-relaxed">
                  Welcome to Gandharva School of Music! Your teaching profile is currently being reviewed by our Academic Board.
                  While review is in progress, you can polish your credentials, set your weekly schedule, and link your remuneration UPI ID.
                  Publishing your profile and accepting student bookings will unlock automatically once your accreditation is confirmed.
                </p>
              </div>
            </div>
            <Link
              href="/teacher/dashboard/profile"
              className="btn-tactile inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>Review Credentials</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Progress Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-amber-200/60 text-xs">
            <div className="flex items-center gap-2 text-heading">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  hasBio && hasInstruments ? "bg-emerald-600 text-white" : "bg-neutral-200 text-body"
                }`}
              >
                {hasBio && hasInstruments ? "✓" : "1"}
              </span>
              <span className={hasBio && hasInstruments ? "text-emerald-800 font-semibold" : "text-body"}>
                Bio & Disciplines ({hasBio && hasInstruments ? "Complete" : "Incomplete"})
              </span>
            </div>
            <div className="flex items-center gap-2 text-heading">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  hasAvailability ? "bg-emerald-600 text-white" : "bg-neutral-200 text-body"
                }`}
              >
                {hasAvailability ? "✓" : "2"}
              </span>
              <span className={hasAvailability ? "text-emerald-800 font-semibold" : "text-body"}>
                Weekly Availability ({hasAvailability ? `${rulesCount} rules` : "Not configured"})
              </span>
            </div>
            <div className="flex items-center gap-2 text-heading">
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">
                3
              </span>
              <span className="text-amber-900 font-semibold">
                Admin Board Review (In Progress)
              </span>
            </div>
          </div>
        </div>
      )}

      {profile?.approvalStatus === "REJECTED" && (
        <div className="relative overflow-hidden rounded-3xl border border-rose-300 bg-rose-50/90 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-xs">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-700 text-white text-[10px] font-bold uppercase tracking-wider">
                  Action Required
                </span>
                <span className="text-xs text-rose-800 font-medium">Teacher Application Feedback</span>
              </div>
              <h2 className="font-serif text-lg font-bold text-heading">
                Updates Requested by Academic Administration
              </h2>
              <p className="text-xs text-rose-900/90 max-w-2xl leading-relaxed">
                {profile.rejectionReason
                  ? `Note from Admin: "${profile.rejectionReason}"`
                  : "Your teacher profile was reviewed and needs updates to qualifications or instruments before being approved."}
              </p>
            </div>
          </div>
          <Link
            href="/teacher/dashboard/profile"
            className="btn-tactile inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <span>Update Credentials</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border-default bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-body-muted">
            <span className="text-xs font-medium">Upcoming Sessions</span>
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-heading font-serif tabular-nums">
            {scheduledLessons.length}
          </p>
          <p className="text-[11px] text-body-muted mt-0.5">Scheduled live lessons</p>
        </div>

        <div className="rounded-2xl border border-border-default bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-body-muted">
            <span className="text-xs font-medium">Completed Lessons</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-bold text-heading font-serif tabular-nums">
            {completedLessons.length}
          </p>
          <p className="text-[11px] text-body-muted mt-0.5">Sessions delivered</p>
        </div>

        <div className="rounded-2xl border border-border-default bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-body-muted">
            <span className="text-xs font-medium">Weekly Blocks</span>
            <Clock className="w-4 h-4 text-accent-dark" />
          </div>
          <p className="mt-2 text-2xl font-bold text-heading font-serif tabular-nums">
            {rulesCount}
          </p>
          <p className="text-[11px] text-body-muted mt-0.5">Configured slots</p>
        </div>
      </div>

      {/* Main Section: Lesson List */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold font-serif text-heading">
            Upcoming and Past Sessions
          </h2>
          <p className="text-xs text-body-muted">
            Sessions with Trial vs Course tags. Live video room unlocks 10 minutes prior to scheduled start time.
          </p>
        </div>

        <TeacherLessonList
          lessons={formattedLessons}
          userTimezone={user.timezone || "UTC"}
          initialServerTime={Date.now()}
        />
      </div>
    </div>
  );
}
