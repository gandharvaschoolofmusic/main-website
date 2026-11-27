import { formatInViewerTimezone } from "@/lib/timezone";
import Link from "next/link";
import { Sparkles, ArrowRight, Clock } from "lucide-react";

export type TrialStatusData = {
  trialStatus: {
    status: string;
    lessonsGranted: number;
    lessonsUsed: number;
  } | null;
  activeEnrollment?: {
    id: string;
    courseTitle: string;
    sessionsRemaining: number;
    totalSessions: number;
  } | null;
  pendingTrialRequest?: {
    id: string;
    instrument: string;
    ageGroup: string;
    requestedStartsAt: string;
    preferredTimeSlot?: string;
    notes?: string | null;
  } | null;
  isConverted?: boolean;
};

export function TrialStatusStrip({ data, timezone }: { data: TrialStatusData; timezone: string }) {
  const { trialStatus, activeEnrollment, pendingTrialRequest, isConverted } = data;

  const lessonsGranted = trialStatus?.lessonsGranted ?? 2;
  const lessonsUsed = trialStatus?.lessonsUsed ?? 0;
  const trialsRemaining = Math.max(0, lessonsGranted - lessonsUsed);
  const isTrialActive = !isConverted && trialStatus?.status === "ACTIVE" && trialsRemaining > 0;

  // Case 0: Pending Trial Request awaiting Admin teacher allotment
  if (pendingTrialRequest) {
    const requestDate = new Date(pendingTrialRequest.requestedStartsAt);
    const formattedDate = formatInViewerTimezone(requestDate, timezone, "EEE, MMM d, yyyy");
    const formattedTime = formatInViewerTimezone(requestDate, timezone, "h:mm a zzz");

    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-bg-alt/60 via-white to-surface-muted/30 p-6 shadow-md shadow-primary/5">
        {/* Top Accent Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-cta to-accent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent-dark border border-accent/30 animate-pulse">
                <Clock className="w-3.5 h-3.5 text-accent-dark" />
                Awaiting Teacher Allotment
              </span>
              <span className="text-xs font-semibold text-body">
                Gandharva Academy Director Review
              </span>
            </div>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-heading">
              Trial Lesson Requested: {pendingTrialRequest.instrument}
            </h3>
            <p className="text-xs sm:text-sm text-body max-w-xl leading-relaxed">
              Requested for <strong className="text-heading font-bold">{formattedDate} at {formattedTime}</strong> (Age: {pendingTrialRequest.ageGroup}). Our Academic Director is assigning a certified faculty maestro best suited for your musical aspirations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-surface-muted/90 text-accent-dark text-xs font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-accent animate-spin" />
              <span>Allotment in progress</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Case 1: Mid-trial (Student has free trial lessons available) - HIGH PROMINENCE
  if (isTrialActive) {
    const percentUsed = Math.round((lessonsUsed / lessonsGranted) * 100);

    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-bg-alt/70 via-white to-surface-muted/40 p-6 shadow-lg shadow-primary/10">
        {/* Top Accent Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-cta to-accent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/30">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Free Trial Active
              </span>
              <span className="text-xs font-semibold text-body">
                Gandharva Academy Welcome Allocation
              </span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-heading">
              <span className="text-primary font-extrabold">{trialsRemaining} of {lessonsGranted}</span> Free Trial Lesson{trialsRemaining === 1 ? "" : "s"} Remaining
            </h3>
            <p className="text-xs sm:text-sm text-body max-w-xl leading-relaxed">
              Experience 1-on-1 live guidance with our master faculty before enrolling in a comprehensive diploma course.
            </p>
            {/* Progress bar */}
            <div className="w-full max-w-md bg-surface-muted/60 rounded-full h-2.5 mt-2 overflow-hidden border border-surface-muted">
              <div
                className="bg-gradient-to-r from-primary via-cta to-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(15, percentUsed)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/book-trial"
              className="btn-tactile inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-cta hover:bg-cta-hover text-white font-bold text-sm shadow-md shadow-cta/25 transition-all"
            >
              <span>Book Trial Lesson</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/student/dashboard/courses"
              className="btn-tactile inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-surface-muted/90 bg-white hover:bg-bg-alt/30 text-heading font-semibold text-sm transition-all shadow-xs"
            >
              View Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active paid enrollment: do not show banner in upcoming sessions
  if (activeEnrollment) {
    return null;
  }

  // Case 3: Trials exhausted and no active sessions remaining (High Commercial Priority)
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-accent/40 bg-gradient-to-r from-bg-alt/80 via-white to-surface-muted/50 p-6 shadow-lg shadow-primary/10">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent via-cta to-primary" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent-dark border border-accent/30">
              <Clock className="w-3.5 h-3.5 text-accent-dark" />
              Trial Completed
            </span>
            <span className="text-xs font-bold text-accent-dark">
              Continue your musical journey
            </span>
          </div>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-heading">
            Ready for the Full Experience? Enroll in a Gandharva Course
          </h3>
          <p className="text-xs sm:text-sm text-body max-w-2xl leading-relaxed">
            Your free trial lessons have concluded. Unlock comprehensive curriculum tracks, Trinity and ABRSM accredited exam preparation, performance recitals, and verified completion credentials.
          </p>
        </div>

        <Link
          href="/student/dashboard/courses"
          className="btn-tactile inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-cta hover:bg-cta-hover text-white font-bold text-sm shadow-lg shadow-cta/25 shrink-0 transition-all"
        >
          <span>Explore Course Catalog</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

