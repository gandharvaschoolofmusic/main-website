"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bookLessonAction } from "@/actions/booking";
import {
  getTeacherAvailabilityAction,
  updateUserTimezoneAction,
} from "@/actions/teacher";
import {
  TeacherSlotAvailability,
  ProjectedSlot,
  DaySlotsGroup,
} from "@/lib/slots";
import { POPULAR_TIMEZONES, isValidTimezone } from "@/lib/timezone";

interface SlotPickerProps {
  availability: TeacherSlotAvailability;
  isStudentAuthenticated: boolean;
  userRole?: string | null;
  isEmailVerified?: boolean;
}

export function SlotPicker({
  availability,
  isStudentAuthenticated,
  userRole,
  isEmailVerified = false,
}: SlotPickerProps) {
  const router = useRouter();

  // Active schedule state (dynamically re-projected if timezone changes)
  const [currentAvailability, setCurrentAvailability] =
    useState<TeacherSlotAvailability>(availability);
  const [currentTimezone, setCurrentTimezone] = useState<string>(
    availability.viewerTimezone,
  );
  const [isTzChanging, startTzChange] = useTransition();

  const [selectedInstrument, setSelectedInstrument] = useState<string>(
    currentAvailability.instruments[0] || "",
  );

  // Selected date index (default to first day that has slots)
  const daysWithSlots = currentAvailability.days.filter(
    (d) => d.slots.length > 0,
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    daysWithSlots[0]?.dateKey || "",
  );

  // Slot modal state
  const [pendingSlot, setPendingSlot] = useState<{
    slot: ProjectedSlot;
    day: DaySlotsGroup;
  } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [bookedLessonId, setBookedLessonId] = useState<string | null>(null);

  const activeDay = currentAvailability.days.find(
    (d) => d.dateKey === selectedDateKey,
  );

  const totalSlotsCount = currentAvailability.days.reduce(
    (acc, day) => acc + day.slots.length,
    0,
  );

  // Auto-detect browser timezone on mount if server rendered with UTC or differs
  useEffect(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz && isValidTimezone(browserTz)) {
        // Persist in cookie so future server renders match local browser time immediately
        document.cookie = `user-timezone=${encodeURIComponent(
          browserTz,
        )};path=/;max-age=31536000;SameSite=Lax`;

        // If initial server render was in UTC but browser is in a different local zone, auto-switch!
        if (availability.viewerTimezone === "UTC" && browserTz !== "UTC") {
          changeTimezone(browserTz, true);
        }
      }
    } catch {
      // Ignore browser detection errors
    }
  }, []);

  const changeTimezone = (newTz: string, saveToProfile = false) => {
    if (!newTz || newTz === currentTimezone || !isValidTimezone(newTz)) return;

    startTzChange(async () => {
      document.cookie = `user-timezone=${encodeURIComponent(
        newTz,
      )};path=/;max-age=31536000;SameSite=Lax`;
      setCurrentTimezone(newTz);

      const res = await getTeacherAvailabilityAction(
        currentAvailability.teacherProfileId,
        newTz,
      );

      if (res.success && res.availability) {
        setCurrentAvailability(res.availability);
        const newDaysWithSlots = res.availability.days.filter(
          (d) => d.slots.length > 0,
        );
        setSelectedDateKey(newDaysWithSlots[0]?.dateKey || "");
        setPendingSlot(null);
        setErrorMsg(null);
      }

      if (saveToProfile && isStudentAuthenticated) {
        await updateUserTimezoneAction(newTz);
      }
    });
  };

  const handleSelectSlot = (slot: ProjectedSlot, day: DaySlotsGroup) => {
    setErrorMsg(null);
    setPendingSlot({ slot, day });
  };

  const handleConfirmBooking = () => {
    if (!pendingSlot) return;

    startTransition(async () => {
      setErrorMsg(null);
      setErrorCode(null);
      const res = await bookLessonAction({
        teacherProfileId: currentAvailability.teacherProfileId,
        startsAt: pendingSlot.slot.startsAt,
        instrument: selectedInstrument,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to book lesson. Please try again.");
        setErrorCode(res.code || null);
      } else if (res.lessonId) {
        setBookedLessonId(res.lessonId);
      }
    });
  };

  return (
    <div className="bg-white border border-border-default rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h3 className="text-xl font-bold font-serif text-heading">Book a Lesson</h3>
          <p className="text-xs sm:text-sm text-body mt-0.5">
            60-minute 1-to-1 live video session
          </p>
        </div>
        <div className="text-right sm:border-l sm:border-border-subtle sm:pl-6">
          <div className="text-2xl font-bold text-heading font-serif">
            ${(currentAvailability.hourlyRate / 100).toFixed(2)}
          </div>
          <div className="text-xs text-body-muted">per 60-min lesson</div>
        </div>
      </div>

      {/* Instrument Selection */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-heading">
          Select Instrument
        </label>
        <div className="flex flex-wrap gap-2">
          {currentAvailability.instruments.map((inst) => {
            const isSelected = inst === selectedInstrument;
            return (
              <button
                key={inst}
                type="button"
                onClick={() => {
                  setSelectedInstrument(inst);
                  setPendingSlot(null);
                  setErrorMsg(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all btn-tactile ${
                  isSelected
                    ? "bg-primary text-white shadow-xs"
                    : "bg-bg-alt text-heading hover:bg-surface-muted border border-border-subtle"
                }`}
              >
                {inst}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Timezone Selector Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-alt/50 border border-border-default rounded-xl px-4 py-2.5 text-xs text-body">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
          <span>Times shown in your local time:</span>
          <div className="relative inline-block">
            <select
              value={currentTimezone}
              onChange={(e) => changeTimezone(e.target.value, true)}
              disabled={isTzChanging}
              aria-label="Select viewer timezone"
              className="bg-white border border-border-default text-heading font-bold rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-cta focus:outline-none cursor-pointer hover:border-cta transition-colors shadow-2xs"
            >
              {!POPULAR_TIMEZONES.some((t) => t.value === currentTimezone) && (
                <option value={currentTimezone}>
                  {currentTimezone} (Detected)
                </option>
              )}
              {POPULAR_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          {isTzChanging && (
            <span className="text-accent animate-pulse text-[11px] font-bold">
              Updating times...
            </span>
          )}
        </div>
        {currentAvailability.teacherTimezone !== currentTimezone && (
          <span className="text-body-muted hidden md:inline">
            Teacher is in {currentAvailability.teacherTimezone}
          </span>
        )}
      </div>

      {/* Calendar Slots */}
      {totalSlotsCount === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border-default bg-bg-alt/30">
          <p className="text-heading font-serif font-bold text-base">No open slots available</p>
          <p className="text-xs text-body-muted mt-1 max-w-sm mx-auto">
            {currentAvailability.teacherName} currently has no open slots in the
            next 14 days. Please check back later or try another teacher.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Horizontal Date Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-heading">
              Select Date
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {currentAvailability.days
                .filter((day) => day.slots.length > 0)
                .map((day) => {
                  const isSelected = day.dateKey === selectedDateKey;
                  const [year, month, d] = day.dateKey.split("-");
                  const dateObj = new Date(
                    Number(year),
                    Number(month) - 1,
                    Number(d),
                  );
                  const weekday = dateObj.toLocaleDateString("en-US", {
                    weekday: "short",
                  });
                  const dayNum = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString("en-US", {
                    month: "short",
                  });

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(day.dateKey);
                        setPendingSlot(null);
                        setErrorMsg(null);
                      }}
                      className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all text-center min-w-[76px] btn-tactile ${
                        isSelected
                          ? "bg-bg-alt border-2 border-cta text-heading shadow-xs"
                          : "bg-white border-border-subtle text-body hover:border-border-default"
                      }`}
                    >
                      <span className="text-[11px] uppercase tracking-wider font-semibold">
                        {day.isToday ? "Today" : weekday}
                      </span>
                      <span
                        className={`text-lg font-bold font-serif ${
                          isSelected ? "text-cta" : "text-heading"
                        }`}
                      >
                        {dayNum}
                      </span>
                      <span className="text-[10px] text-body-muted">
                        {monthName}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Slots Grid for Active Day */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-body-muted">
              <span>
                Available times for{" "}
                <strong className="text-heading font-bold">
                  {activeDay?.dateFormatted}
                </strong>
              </span>
              <span className="font-medium">{activeDay?.slots.length || 0} slots</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {activeDay?.slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => activeDay && handleSelectSlot(slot, activeDay)}
                  className="px-3 py-2.5 rounded-xl bg-white hover:bg-bg-alt border border-border-default hover:border-cta text-heading font-semibold text-xs transition-all group flex flex-col items-center shadow-2xs btn-tactile"
                >
                  <span>{slot.timeFormatted}</span>
                  <span className="text-[10px] text-body-muted group-hover:text-cta">
                    {slot.timezoneAbbr}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-heading/50 backdrop-blur-sm">
          <div className="bg-white border border-border-default rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left relative">
            {!bookedLessonId ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-heading font-serif">
                      Confirm Lesson Booking
                    </h3>
                    <p className="text-xs text-body-muted mt-0.5">
                      Review lesson details before reserving your spot
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSlot(null);
                      setErrorMsg(null);
                    }}
                    className="text-body-muted hover:text-heading p-1 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Lesson summary card */}
                <div className="bg-bg-alt/50 border border-border-subtle rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-body-muted">Teacher:</span>
                    <span className="text-heading font-bold">
                      {currentAvailability.teacherName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-muted">Instrument:</span>
                    <span className="text-cta font-bold">
                      {selectedInstrument}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-muted">Date:</span>
                    <span className="text-heading font-semibold">
                      {pendingSlot.day.dateFormatted}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-muted">Time:</span>
                    <span className="text-heading font-semibold">
                      {pendingSlot.slot.timeFormatted}{" "}
                      <span className="text-body-muted text-xs">
                        ({pendingSlot.slot.timezoneAbbr})
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-muted">Duration:</span>
                    <span className="text-heading font-semibold">60 minutes</span>
                  </div>
                  <div className="pt-2 border-t border-border-subtle flex justify-between items-baseline">
                    <span className="text-heading font-semibold">Total:</span>
                    <span className="text-xl font-bold text-heading font-serif">
                      ${(currentAvailability.hourlyRate / 100).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                {/* Policies */}
                <div className="text-xs text-body bg-bg-alt/30 p-3 rounded-xl border border-border-subtle space-y-1">
                  <p className="flex items-center gap-1.5 text-heading font-medium">
                    <span className="text-success font-bold">✓</span> Free cancellation
                    up to 24 hours before lesson start.
                  </p>
                  <p className="flex items-center gap-1.5 text-heading font-medium">
                    <span className="text-success font-bold">✓</span> Lesson room opens
                    10 minutes prior to scheduled time.
                  </p>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 bg-error-muted border border-error/40 rounded-xl text-xs text-error space-y-2">
                    <p>{errorMsg}</p>
                    {errorCode === "NO_TRIAL_OR_ENROLLMENT" && (
                      <Link
                        href="/courses"
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cta hover:bg-cta-hover active:bg-cta-active text-white font-bold text-xs transition-all shadow btn-tactile"
                      >
                        Explore Courses & Enroll →
                      </Link>
                    )}
                  </div>
                )}

                {/* Action CTA based on Auth State */}
                {!isStudentAuthenticated ? (
                  <div className="space-y-2">
                    {userRole === "TEACHER" ? (
                      <p className="text-xs text-accent-dark text-center bg-accent-subtle border border-accent/30 p-3 rounded-xl font-medium">
                        You are signed in as a teacher. To book lessons as a
                        student, please sign in to a student account.
                      </p>
                    ) : (
                      <>
                        <Link
                          href={`/login?callbackUrl=/teachers/${currentAvailability.teacherProfileId}`}
                          className="block w-full py-3 px-4 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active text-white font-bold text-center text-sm transition-all shadow-md shadow-cta/25 btn-tactile"
                        >
                          Sign In to Book Lesson
                        </Link>
                        <p className="text-xs text-body-muted text-center">
                          Do not have an account?{" "}
                          <Link
                            href="/book-trial"
                            className="text-cta font-bold hover:underline"
                          >
                            Book a free trial
                          </Link>
                        </p>
                      </>
                    )}
                  </div>
                ) : !isEmailVerified ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-accent-subtle border border-accent/30 rounded-xl text-xs text-accent-dark font-medium">
                      Please verify your email address before booking a lesson.
                    </div>
                    <Link
                      href="/verify-email"
                      className="block w-full py-2.5 px-4 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active text-white font-bold text-center text-sm transition-all btn-tactile"
                    >
                      Verify Email
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSlot(null);
                        setErrorMsg(null);
                      }}
                      disabled={isPending}
                      className="flex-1 py-3 px-4 rounded-xl bg-bg-alt hover:bg-surface-muted text-heading font-bold text-sm transition-all btn-tactile"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      disabled={isPending}
                      className="flex-1 py-3 px-4 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active disabled:opacity-50 text-white font-bold text-sm transition-all shadow-md shadow-cta/25 flex items-center justify-center gap-2 btn-tactile"
                    >
                      {isPending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Booking...</span>
                        </>
                      ) : (
                        "Confirm & Book"
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Success confirmation */
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 bg-success-muted text-success border border-success/30 rounded-full flex items-center justify-center text-2xl mx-auto font-bold">
                  ✓
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-heading font-serif">
                    Lesson Confirmed!
                  </h3>
                  <p className="text-xs text-body">
                    Your {selectedInstrument} lesson with{" "}
                    {currentAvailability.teacherName} is booked.
                  </p>
                  <p className="text-xs text-body-muted">
                    A confirmation email and calendar invitation have been sent
                    to your inbox.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href="/student/dashboard"
                    className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-all shadow-md btn-tactile"
                  >
                    View in Student Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSlot(null);
                      setBookedLessonId(null);
                      router.refresh();
                    }}
                    className="w-full py-2 px-4 rounded-xl text-body-muted hover:text-heading text-xs font-semibold transition-all btn-tactile"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
