"use client";

import { useState, useTransition } from "react";
import { CoursePaymentPlan } from "@prisma/client";
import { submitCourseEnrollmentRequestAction, cancelCourseEnrollmentRequestAction } from "@/actions/courses";
import { CourseEmiBreakdown } from "./CourseEmiBreakdown";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  X,
  Loader2,
  GraduationCap,
  Calendar,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface CourseEnrollmentRequestModalProps {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  sessionCount: number;
  durationWeeks: number;
  priceMinorUnits: number;
  description?: string | null;
  level?: string | null;
  isAlreadyEnrolled?: boolean;
  pendingRequest?: {
    id: string;
    status: string;
    paymentPlan: CoursePaymentPlan;
    createdAt: string;
  } | null;
  isAuthenticated?: boolean;
  isConvertedStudent?: boolean;
}

export function CourseEnrollmentRequestModal({
  courseId,
  courseTitle,
  courseSlug,
  sessionCount,
  durationWeeks,
  priceMinorUnits,
  description,
  level,
  isAlreadyEnrolled = false,
  pendingRequest = null,
  isAuthenticated = true,
  isConvertedStudent = true,
}: CourseEnrollmentRequestModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CoursePaymentPlan>(CoursePaymentPlan.FULL_PAYMENT);
  const [preferredSchedule, setPreferredSchedule] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already enrolled
  if (isAlreadyEnrolled) {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-heading">
              You are Actively Enrolled!
            </h4>
            <p className="text-xs text-emerald-800">
              Your 1-on-1 private lessons for this course are active on your student dashboard.
            </p>
          </div>
        </div>
        <div className="pt-1">
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-colors btn-tactile"
          >
            <span>Open Student Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // If student has a pending request
  if (pendingRequest && pendingRequest.status === "PENDING") {
    return (
      <div className="p-5 rounded-2xl bg-primary-subtle border border-primary/20 text-heading space-y-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-serif font-bold text-base text-heading">
                Admission Request Submitted
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                Under Review by Admin
              </span>
            </div>
            <p className="text-xs text-body leading-relaxed">
              Your admission request for <span className="font-bold text-heading">{courseTitle}</span> is currently being reviewed by academy administration for mentor assignment and timetable allotment.
            </p>
            <p className="text-[11px] text-body-muted">
              Submitted on: {new Date(pendingRequest.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-primary/10">
          <span className="text-xs text-body-muted">
            The course will automatically unlock in your dashboard once approved.
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (confirm("Are you sure you want to withdraw this admission request?")) {
                startTransition(async () => {
                  const res = await cancelCourseEnrollmentRequestAction(pendingRequest.id);
                  if (res.success) {
                    router.refresh();
                  } else {
                    alert(res.error || "Failed to cancel request.");
                  }
                });
              }
            }}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline transition-colors disabled:opacity-50"
          >
            {isPending ? "Cancelling..." : "Withdraw Request"}
          </button>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!isAuthenticated) {
    return (
      <div className="p-5 rounded-2xl bg-bg-alt/50 border border-border-default space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-serif font-bold text-base text-heading">
              Ready to Begin Your Masterclass?
            </h4>
            <p className="text-xs text-body">
              Sign in to your student account to submit an admission request.
            </p>
          </div>
          <Link
            href={`/login?callbackUrl=/student/dashboard/courses/${courseSlug}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active text-white font-bold text-xs transition-all shadow-sm shadow-cta/25 btn-tactile whitespace-nowrap"
          >
            <span>Sign In to Request Course</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Signed in but NOT a converted trial student: must complete trial first
  if (isAuthenticated && !isConvertedStudent) {
    return (
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-purple-50/30 border border-amber-200/90 text-heading space-y-3.5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
            <GraduationCap className="w-5 h-5 text-amber-700" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                Prerequisite Required
              </span>
              <span className="text-xs text-body-muted font-medium">Trial Class & Guru Evaluation</span>
            </div>
            <h4 className="font-serif font-bold text-base text-heading">
              Complete Your Free 1-on-1 Trial Class First
            </h4>
            <p className="text-xs text-body leading-relaxed">
              Course admission and mentor allotment are exclusively open to students who have completed and converted their initial trial evaluation. Our certified gurus evaluate your current foundation and musical aptitude before formal course enrollment.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-amber-100">
          <span className="text-xs text-body-muted">
            Already attended your trial session? Reach out to academy support to complete your conversion.
          </span>
          <Link
            href="/book-trial"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white font-bold text-xs transition-all shadow-xs btn-tactile whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Book Free 1-on-1 Trial Class</span>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await submitCourseEnrollmentRequestAction({
        courseId,
        paymentPlan: selectedPlan,
        preferredSchedule,
        studentNotes,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to submit request.");
      } else {
        setSuccessMsg(
          "Your admission request has been sent to academy administration! Our team will review your allotment and add the course directly to your dashboard.",
        );
        setTimeout(() => {
          setIsOpen(false);
          router.refresh();
        }, 2200);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Primary Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-primary-subtle/50 border border-primary/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white uppercase tracking-wider">
              Admission Open
            </span>
            <span className="text-xs text-body-muted">1-on-1 Personalized Mentorship</span>
          </div>
          <h4 className="font-serif font-bold text-base sm:text-lg text-heading">
            Request Course Admission & Mentor Allotment
          </h4>
          <p className="text-xs text-body leading-relaxed max-w-xl">
            Submit your admission request. Academy administration will verify your schedule, assign your faculty mentor, and activate your private classes in your dashboard.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active text-white font-bold text-sm transition-all shadow-md shadow-cta/25 btn-tactile shrink-0"
        >
          <GraduationCap className="w-4 h-4" />
          <span>Request Admission</span>
        </button>
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-border-default rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-dark font-sans">
                  Gandharva School of Music • Admission Desk
                </span>
                <h3 className="font-serif font-bold text-2xl text-heading mt-0.5">
                  Request Course Admission
                </h3>
                <p className="text-xs text-body-muted mt-1">
                  Course: <span className="font-semibold text-heading">{courseTitle}</span> ({sessionCount} Private Sessions • {durationWeeks} Weeks)
                </p>
              </div>

              <button
                type="button"
                onClick={() => !isPending && setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-bg-alt flex items-center justify-center text-body hover:text-heading transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-serif font-bold text-lg text-heading">
                  Request Successfully Sent!
                </h4>
                <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                  {successMsg}
                </p>
                <p className="text-[11px] text-body-muted pt-2">
                  Redirecting to course dashboard...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Tuition Structure & Per-Session Breakdown */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-heading uppercase tracking-wider">
                    Step 1: Academy Tuition & Fee Structure
                  </label>
                  <CourseEmiBreakdown
                    priceMinorUnits={priceMinorUnits}
                    level={level ?? undefined}
                    sessionCount={sessionCount}
                    description={description ?? undefined}
                  />
                </div>

                {/* 2. Schedule Preference */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="preferredSchedule"
                    className="block text-xs font-bold text-heading"
                  >
                    Step 2: Preferred Days & Time Window (Optional)
                  </label>
                  <input
                    id="preferredSchedule"
                    type="text"
                    value={preferredSchedule}
                    onChange={(e) => setPreferredSchedule(e.target.value)}
                    placeholder="e.g. Weekends afternoon, or Tue & Thu 6-8 PM IST"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default focus:border-cta focus:ring-2 focus:ring-cta/20 text-xs text-heading placeholder:text-body-muted/60 transition-all"
                  />
                  <p className="text-[11px] text-body-muted">
                    Our academy administration will match you with a certified faculty teacher fitting this window.
                  </p>
                </div>

                {/* 3. Notes / Musical Background */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="studentNotes"
                    className="block text-xs font-bold text-heading"
                  >
                    Step 3: Goals or Musical Background (Optional)
                  </label>
                  <textarea
                    id="studentNotes"
                    rows={3}
                    value={studentNotes}
                    onChange={(e) => setStudentNotes(e.target.value)}
                    placeholder="Tell us about your musical experience, favorite genres, or exam objectives (Trinity, Gandharva Mahavidyalaya, hobby)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default focus:border-cta focus:ring-2 focus:ring-cta/20 text-xs text-heading placeholder:text-body-muted/60 transition-all resize-none"
                  />
                </div>

                {/* Terms Assurance */}
                <div className="p-3.5 rounded-xl bg-bg-alt/40 border border-border-subtle flex items-start gap-2.5 text-[11px] text-body">
                  <ShieldCheck className="w-4 h-4 text-accent-dark shrink-0 mt-0.5" />
                  <span>
                    When you click "Submit Admission Request", your request goes directly to the Academy Director. Once approved, the course will be added directly to your dashboard with your assigned mentor.
                  </span>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setIsOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-border-default text-xs font-semibold text-body hover:bg-bg-alt/50 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active text-white text-xs font-bold transition-all shadow-sm shadow-cta/25 btn-tactile disabled:opacity-60"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Admission Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
