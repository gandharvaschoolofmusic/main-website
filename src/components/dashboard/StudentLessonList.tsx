"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LessonCountdown } from "./LessonCountdown";
import { CancelLessonModal } from "./CancelLessonModal";
import { JOIN_WINDOW_MINUTES_BEFORE } from "@/types";
import { useSyncedTime } from "@/lib/synced-time";
import { releaseAllMediaDevices } from "@/lib/media-devices";
import { Calendar, Clock, Video } from "lucide-react";

export interface StudentDashboardLesson {
  id: string;
  instrument: string;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  durationMinutes: number;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
  formattedTime: string;
  timezoneAbbr: string;
  teacherName: string;
  teacherProfileId: string;
  trackingCode?: string | null;
  lessonSource?: "TRIAL" | "ENROLLMENT" | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  recordingUrl?: string | null;
}

interface StudentLessonListProps {
  lessons: StudentDashboardLesson[];
  userTimezone: string;
  initialServerTime?: number;
}

export function StudentLessonList({
  lessons,
  userTimezone,
  initialServerTime,
}: StudentLessonListProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"UPCOMING" | "PAST" | "CANCELLED">(
    "UPCOMING",
  );

  const [cancellingLesson, setCancellingLesson] =
    useState<StudentDashboardLesson | null>(null);

  const now = useSyncedTime(initialServerTime);

  // Guarantee all camera and microphone hardware tracks are stopped upon returning to dashboard
  useEffect(() => {
    releaseAllMediaDevices();
  }, []);

  const upcomingLessons = lessons.filter((l) => {
    const endsAtTime = new Date(l.endsAt).getTime();
    return (l.status === "SCHEDULED" || l.status === "RESCHEDULED") && endsAtTime >= now;
  });

  const pastLessons = lessons.filter((l) => {
    const endsAtTime = new Date(l.endsAt).getTime();
    return (
      l.status === "COMPLETED" ||
      ((l.status === "SCHEDULED" || l.status === "RESCHEDULED") && endsAtTime < now)
    );
  });

  const cancelledLessons = lessons.filter((l) => l.status === "CANCELLED");

  return (
    <div className="rounded-2xl border border-surface-muted/80 bg-white p-6 shadow-md shadow-primary/5 space-y-6">
      {/* Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-muted/80 pb-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-heading">
            My Lessons and Practice
          </h2>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-bg-alt/30 border border-surface-muted/80 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("UPCOMING")}
            className={`btn-tactile px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === "UPCOMING"
                ? "bg-primary text-white shadow-xs font-bold"
                : "text-body hover:text-heading"
            }`}
          >
            Upcoming ({upcomingLessons.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PAST")}
            className={`btn-tactile px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === "PAST"
                ? "bg-primary text-white shadow-xs font-bold"
                : "text-body hover:text-heading"
            }`}
          >
            Past Lessons ({pastLessons.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CANCELLED")}
            className={`btn-tactile px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === "CANCELLED"
                ? "bg-primary text-white shadow-xs font-bold"
                : "text-body hover:text-heading"
            }`}
          >
            Cancelled ({cancelledLessons.length})
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "UPCOMING" && (
        <>
          {upcomingLessons.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-surface-muted bg-bg-alt/20 space-y-3">
              <p className="text-heading text-sm font-bold">
                No upcoming lessons scheduled
              </p>
              <p className="text-xs text-body max-w-sm mx-auto leading-relaxed">
                Ready to practice? Enroll in a Gandharva course to reserve your 1-on-1 video sessions with our master faculty.
              </p>
              <div className="pt-2">
                <Link
                  href="/student/dashboard/courses"
                  className="inline-block text-xs font-bold text-cta hover:text-cta-hover transition-colors"
                >
                  Explore Course Catalog →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingLessons.map((lesson) => {
                const startsAtTime = new Date(lesson.startsAt).getTime();
                const isRoomOpen =
                  now >= startsAtTime - JOIN_WINDOW_MINUTES_BEFORE * 60 * 1000;

                return (
                  <div
                    key={lesson.id}
                    className="bg-white border border-surface-muted/90 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 hover:shadow-md transition-all shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-bg-alt text-heading border border-surface-muted text-xs font-bold">
                              {lesson.instrument}
                            </span>
                            {lesson.trackingCode && (
                              <span className="font-mono text-[10px] font-bold text-accent-dark bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                Ref: {lesson.trackingCode}
                              </span>
                            )}
                            {lesson.lessonSource === "TRIAL" && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-accent/15 text-accent-dark border border-accent/30 text-[11px] font-bold">
                                Trial
                              </span>
                            )}
                            {lesson.lessonSource === "ENROLLMENT" && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold">
                                1:1 Course Session
                              </span>
                            )}
                            {lesson.status === "RESCHEDULED" && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                                Rescheduled
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-heading mt-2">
                            Lesson with {lesson.teacherName}
                          </h3>
                        </div>
                        <LessonCountdown
                          startsAt={lesson.startsAt}
                          initialServerTime={now}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 text-xs text-body">
                        <div className="flex items-center gap-2 text-heading font-medium">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>
                            {lesson.formattedTime} ({lesson.timezoneAbbr})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-body">
                          <Clock className="w-3.5 h-3.5 text-body/60" />
                          <span>Duration: {lesson.durationMinutes} minutes</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-surface-muted flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setCancellingLesson(lesson)}
                        className="text-xs text-body hover:text-error transition-colors py-1.5 font-medium"
                      >
                        Cancel
                      </button>

                      <div className="flex items-center gap-2">
                        {isRoomOpen ? (
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="btn-tactile px-4 py-2 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs font-bold shadow-md shadow-cta/20 transition-all flex items-center gap-1.5"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Enter Lesson Room</span>
                            <span>→</span>
                          </Link>
                        ) : (
                          <span
                            className="px-3.5 py-2 rounded-xl bg-bg-alt/40 border border-surface-muted text-body/70 text-xs font-medium cursor-not-allowed flex items-center gap-1.5"
                            title="Room activates 10 minutes prior to start time"
                          >
                            <span>🔒</span>
                            <span>Opens 10m before</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "PAST" && (
        <>
          {pastLessons.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl border border-surface-muted bg-bg-alt/20 text-body text-xs">
              No completed lesson history yet.
            </div>
          ) : (
            <div className="space-y-3">
              {pastLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-white border border-surface-muted/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-heading">
                        {lesson.instrument} with {lesson.teacherName}
                      </span>
                      {lesson.trackingCode && (
                        <span className="font-mono text-[10px] font-bold text-accent-dark bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                          Ref: {lesson.trackingCode}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-success-muted text-success border border-success/30 text-[10px] font-bold">
                        Completed
                      </span>
                    </div>
                    <p className="text-body">
                      {lesson.formattedTime} ({lesson.timezoneAbbr})
                    </p>
                  </div>

                  {lesson.recordingUrl && (
                    <div className="flex items-center gap-2">
                      <a
                        href={lesson.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-tactile px-3.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all text-center"
                        title="Watch recorded class session"
                      >
                        🎬 Lesson Recording
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "CANCELLED" && (
        <>
          {cancelledLessons.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl border border-surface-muted bg-bg-alt/20 text-body text-xs">
              No cancelled lessons.
            </div>
          ) : (
            <div className="space-y-3">
              {cancelledLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-white border border-surface-muted/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs opacity-75 hover:opacity-100 transition-opacity shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-body line-through">
                        {lesson.instrument} with {lesson.teacherName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-error-muted text-error border border-error/30 text-[10px] font-bold">
                        Cancelled
                      </span>
                    </div>
                    <p className="text-body/70">
                      Originally scheduled for {lesson.formattedTime} ({lesson.timezoneAbbr})
                    </p>
                  </div>

                  <Link
                    href={`/teachers/${lesson.teacherProfileId}`}
                    className="btn-tactile px-3.5 py-1.5 rounded-lg bg-bg-alt/40 hover:bg-bg-alt border border-surface-muted text-heading text-xs font-medium transition-colors text-center"
                  >
                    Re-book Slot →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Cancel Lesson Modal */}
      {cancellingLesson && (
        <CancelLessonModal
          isOpen={!!cancellingLesson}
          onClose={() => setCancellingLesson(null)}
          lesson={{
            id: cancellingLesson.id,
            instrument: cancellingLesson.instrument,
            startsAt: cancellingLesson.startsAt,
            partnerName: cancellingLesson.teacherName,
            isTeacher: false,
          }}
          onSuccess={() => {
            setCancellingLesson(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

