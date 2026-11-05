"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { LessonStatus, LessonSource } from "@prisma/client";
import { cancelLessonAdminAction, updateLessonDateTimeAdminAction } from "@/actions/admin";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { formatToIST, toISTInputString, fromISTInputToUtc } from "@/lib/timezone";
import Link from "next/link";
import {
  Video,
  Search,
  Calendar,
  AlertCircle,
  XCircle,
  ExternalLink,
  Loader2,
  Pencil,
  Check,
  X,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export interface AdminLessonItem {
  id: string;
  trackingCode: string;
  startsAt: string;
  createdAt: string;
  formattedTime: string;
  formattedCreatedDate?: string;
  durationMinutes: number;
  instrument: string;
  courseTitle?: string | null;
  status: LessonStatus;
  lessonSource: LessonSource;
  teacherName: string;
  studentName: string;
  studentEmail: string;
}

type TimelineTab = "ALL" | "UPCOMING" | "PAST";
type UpcomingSubFilter = "ALL" | "NEXT_24_HRS" | "SCHEDULED" | "RESCHEDULED" | "CANCELLED";
type PastSubFilter = "ALL" | "COMPLETED" | "CANCELLED";

export function AdminLessonsManager({
  initialLessons,
  adminTimezone = "Asia/Kolkata",
}: {
  initialLessons: AdminLessonItem[];
  adminTimezone?: string;
}) {
  const [lessons, setLessons] = useState<AdminLessonItem[]>(initialLessons);

  // Line 1 Timeline Tab: All | Upcoming Sessions | Past Sessions
  const [timelineTab, setTimelineTab] = useState<TimelineTab>("ALL");

  // Line 2 Sub-filters (conditional depending on Line 1)
  const [upcomingSubFilter, setUpcomingSubFilter] = useState<UpcomingSubFilter>("ALL");
  const [pastSubFilter, setPastSubFilter] = useState<PastSubFilter>("ALL");

  // Secondary filters
  const [sourceFilter, setSourceFilter] = useState<"ALL" | LessonSource>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit State (Date & Time + Status)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editDateInput, setEditDateInput] = useState<string>("");
  const [editStatusInput, setEditStatusInput] = useState<LessonStatus>(LessonStatus.SCHEDULED);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  // Check current time boundaries
  const nowMs = Date.now();

  const isLessonUpcoming = (lesson: AdminLessonItem) => {
    const startsAtMs = new Date(lesson.startsAt).getTime();
    const endsAtMs = startsAtMs + (lesson.durationMinutes || 60) * 60 * 1000;
    return endsAtMs >= nowMs;
  };

  const isLessonPast = (lesson: AdminLessonItem) => {
    const startsAtMs = new Date(lesson.startsAt).getTime();
    const endsAtMs = startsAtMs + (lesson.durationMinutes || 60) * 60 * 1000;
    return endsAtMs < nowMs;
  };

  const isLessonNext24Hours = (lesson: AdminLessonItem) => {
    const startsAtMs = new Date(lesson.startsAt).getTime();
    return startsAtMs >= nowMs && startsAtMs <= nowMs + 24 * 60 * 60 * 1000;
  };

  // Pre-computed counts for navigation badges
  const counts = useMemo(() => {
    const all = lessons.length;
    const upcomingList = lessons.filter(isLessonUpcoming);
    const pastList = lessons.filter(isLessonPast);

    return {
      all,
      upcoming: upcomingList.length,
      upcoming24h: upcomingList.filter(isLessonNext24Hours).length,
      upcomingScheduled: upcomingList.filter((l) => l.status === LessonStatus.SCHEDULED).length,
      upcomingRescheduled: upcomingList.filter((l) => l.status === LessonStatus.RESCHEDULED).length,
      upcomingCancelled: upcomingList.filter((l) => l.status === LessonStatus.CANCELLED).length,
      past: pastList.length,
      pastCompleted: pastList.filter((l) => l.status === LessonStatus.COMPLETED).length,
      pastCancelled: pastList.filter((l) => l.status === LessonStatus.CANCELLED).length,
    };
  }, [lessons, nowMs]);

  const handleStartEdit = (lesson: AdminLessonItem) => {
    setEditingLessonId(lesson.id);
    setEditDateInput(toISTInputString(lesson.startsAt));
    setEditStatusInput(lesson.status);
  };

  const handleSaveDateTimeAndStatus = async (lessonId: string) => {
    if (!editDateInput) return;
    setIsSaving(true);
    try {
      const utcDate = fromISTInputToUtc(editDateInput);
      const res = await updateLessonDateTimeAdminAction({
        lessonId,
        startsAt: utcDate.toISOString(),
        status: editStatusInput,
        adminTimezone: "Asia/Kolkata",
      });

      if (res.success && res.data) {
        setLessons((prev) =>
          prev.map((l) =>
            l.id === lessonId
              ? {
                  ...l,
                  startsAt: res.data!.startsAt,
                  formattedTime: formatToIST(res.data!.startsAt),
                  status: res.data!.status,
                }
              : l
          )
        );
        setEditingLessonId(null);
        setSavedSuccessId(lessonId);
        setTimeout(() => setSavedSuccessId(null), 3500);
        setToast({ text: "Session schedule & status updated directly in database!", type: "success" });
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast({ text: res.error || "Failed to update session.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ text: "Network error updating session.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelLesson = (lessonId: string, studentName: string) => {
    if (!confirm(`Cancel lesson with ${studentName}? This will restore the student's session quota.`)) {
      return;
    }

    startTransition(async () => {
      const res = await cancelLessonAdminAction(lessonId);
      if (!res.success) {
        alert(res.error || "Failed to cancel lesson.");
      } else {
        setLessons((prev) =>
          prev.map((l) =>
            l.id === lessonId ? { ...l, status: LessonStatus.CANCELLED } : l,
          ),
        );
      }
    });
  };

  // Filtered & sorted lessons
  const filteredLessons = useMemo(() => {
    return lessons
      .filter((l) => {
        // 1. Line 1 Timeline Filter
        if (timelineTab === "UPCOMING") {
          if (!isLessonUpcoming(l)) return false;

          // Line 2 Upcoming Sub-filters
          if (upcomingSubFilter === "NEXT_24_HRS") {
            if (!isLessonNext24Hours(l)) return false;
          } else if (upcomingSubFilter === "SCHEDULED") {
            if (l.status !== LessonStatus.SCHEDULED) return false;
          } else if (upcomingSubFilter === "RESCHEDULED") {
            if (l.status !== LessonStatus.RESCHEDULED) return false;
          } else if (upcomingSubFilter === "CANCELLED") {
            if (l.status !== LessonStatus.CANCELLED) return false;
          }
        } else if (timelineTab === "PAST") {
          if (!isLessonPast(l)) return false;

          // Line 2 Past Sub-filters: All | Completed | Cancelled
          if (pastSubFilter === "COMPLETED") {
            if (l.status !== LessonStatus.COMPLETED) return false;
          } else if (pastSubFilter === "CANCELLED") {
            if (l.status !== LessonStatus.CANCELLED) return false;
          }
        } else {
          // timelineTab === "ALL": No status filtering ("In All, no any filter should be there")
        }

        // 2. Source Filter (All Types, Trials, Course Sessions)
        const matchesSource = sourceFilter === "ALL" || l.lessonSource === sourceFilter;
        if (!matchesSource) return false;

        // 3. Search Query Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesSearch =
            l.studentName.toLowerCase().includes(q) ||
            l.teacherName.toLowerCase().includes(q) ||
            l.instrument.toLowerCase().includes(q) ||
            (l.courseTitle && l.courseTitle.toLowerCase().includes(q)) ||
            l.trackingCode.toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (timelineTab === "PAST") {
          // Past sessions: Most recent completed/cancelled first
          return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
        }
        // Upcoming and All: Earliest upcoming session first
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
  }, [lessons, timelineTab, upcomingSubFilter, pastSubFilter, sourceFilter, searchQuery, nowMs]);

  return (
    <div className="space-y-5">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1 ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-body/60 hover:text-heading cursor-pointer p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Line 1: Primary Timeline Navigation Tabs ─── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-100/90 border border-neutral-200/90 shadow-2xs w-fit">
        <button
          type="button"
          onClick={() => setTimelineTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
            timelineTab === "ALL"
              ? "bg-[#3C096C] text-white shadow-xs"
              : "text-body hover:text-heading hover:bg-white/60"
          }`}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => {
            setTimelineTab("UPCOMING");
            setUpcomingSubFilter("ALL");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
            timelineTab === "UPCOMING"
              ? "bg-[#3C096C] text-white shadow-xs"
              : "text-body hover:text-heading hover:bg-white/60"
          }`}
        >
          <span>Upcoming Sessions</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              timelineTab === "UPCOMING" ? "bg-white/20 text-white" : "bg-neutral-200 text-body"
            }`}
          >
            {counts.upcoming}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTimelineTab("PAST");
            setPastSubFilter("ALL");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
            timelineTab === "PAST"
              ? "bg-[#3C096C] text-white shadow-xs"
              : "text-body hover:text-heading hover:bg-white/60"
          }`}
        >
          <span>Past Sessions</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              timelineTab === "PAST" ? "bg-white/20 text-white" : "bg-neutral-200 text-body"
            }`}
          >
            {counts.past}
          </span>
        </button>
      </div>

      {/* ─── Line 2 (Sub-filters) & Controls Row ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Line 2 for Upcoming Sessions */}
          {timelineTab === "UPCOMING" && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-primary/10 shadow-xs">
              <button
                type="button"
                onClick={() => setUpcomingSubFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                  upcomingSubFilter === "ALL"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                All ({counts.upcoming})
              </button>
              <button
                type="button"
                onClick={() => setUpcomingSubFilter("NEXT_24_HRS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer flex items-center gap-1 ${
                  upcomingSubFilter === "NEXT_24_HRS"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                <span>Next 24 hrs</span>
                {counts.upcoming24h > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      upcomingSubFilter === "NEXT_24_HRS"
                        ? "bg-white/20 text-white"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {counts.upcoming24h}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setUpcomingSubFilter("SCHEDULED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                  upcomingSubFilter === "SCHEDULED"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                Scheduled ({counts.upcomingScheduled})
              </button>
              <button
                type="button"
                onClick={() => setUpcomingSubFilter("RESCHEDULED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                  upcomingSubFilter === "RESCHEDULED"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                Rescheduled ({counts.upcomingRescheduled})
              </button>
              <button
                type="button"
                onClick={() => setUpcomingSubFilter("CANCELLED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                  upcomingSubFilter === "CANCELLED"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                Cancel ({counts.upcomingCancelled})
              </button>
            </div>
          )}

          {/* Line 2 for Past Sessions */}
          {timelineTab === "PAST" && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-primary/10 shadow-xs">
              <button
                type="button"
                onClick={() => setPastSubFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                  pastSubFilter === "ALL"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                All ({counts.past})
              </button>
              <button
                type="button"
                onClick={() => setPastSubFilter("COMPLETED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                  pastSubFilter === "COMPLETED"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                Completed ({counts.pastCompleted})
              </button>
              <button
                type="button"
                onClick={() => setPastSubFilter("CANCELLED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                  pastSubFilter === "CANCELLED"
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-body hover:text-heading hover:bg-bg-alt/30"
                }`}
              >
                Cancelled ({counts.pastCancelled})
              </button>
            </div>
          )}

          {/* Source Filter (All Types, Trials, Course Sessions) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-primary/10 shadow-xs">
            <button
              type="button"
              onClick={() => setSourceFilter("ALL")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                sourceFilter === "ALL"
                  ? "bg-accent text-white shadow-xs font-bold"
                  : "text-body hover:text-heading hover:bg-bg-alt/30"
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter(LessonSource.TRIAL)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                sourceFilter === LessonSource.TRIAL
                  ? "bg-accent text-white shadow-xs font-bold"
                  : "text-body hover:text-heading hover:bg-bg-alt/30"
              }`}
            >
              Trials
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter(LessonSource.ENROLLMENT)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 cursor-pointer ${
                sourceFilter === LessonSource.ENROLLMENT
                  ? "bg-cta text-white shadow-xs font-bold"
                  : "text-body hover:text-heading hover:bg-bg-alt/30"
              }`}
            >
              Course Sessions
            </button>
          </div>

          {/* Timezone Indicator */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-900 text-xs font-semibold shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-purple-700" />
            <span>Timezone: <strong className="font-bold">IST (UTC+5:30)</strong></span>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, teacher, instrument..."
            className="w-full rounded-xl bg-white border border-primary/15 pl-9 pr-3 py-2 text-xs text-heading placeholder:text-body/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>
      </div>

      {/* Global Lessons Table */}
      <div className="rounded-2xl border border-primary/10 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-primary/10 bg-bg-alt/25 text-heading font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-bold">Tracking ID</th>
                <th className="py-3.5 px-4 font-bold">Date & Time (IST)</th>
                <th className="py-3.5 px-4 font-bold">Session Type</th>
                <th className="py-3.5 px-4 font-bold">Faculty Instructor</th>
                <th className="py-3.5 px-4 font-bold">Student</th>
                <th className="py-3.5 px-4 font-bold">Discipline</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {filteredLessons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-body">
                    <AlertCircle className="w-6 h-6 text-body/40 mx-auto mb-2" />
                    No lessons found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLessons.map((l) => (
                  <tr
                    key={l.id}
                    className="hover:bg-bg-alt/15 transition-colors"
                  >
                    {/* Tracking ID */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-accent-dark text-[11px] bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                        {l.trackingCode}
                      </span>
                    </td>

                    {/* Date & Time */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-numeric">
                      {editingLessonId === l.id ? (
                        <div className="flex items-center gap-1.5 min-w-[230px]">
                          <div className="flex-1">
                            <DateTimePicker
                              compact
                              value={editDateInput}
                              onChange={setEditDateInput}
                              placeholder="Pick date & time (IST)"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span
                            onClick={() => handleStartEdit(l)}
                            className="text-heading font-medium hover:text-primary transition-colors cursor-pointer"
                            title="Click to edit date, time, and status in database (IST)"
                          >
                            {formatToIST(l.startsAt) || l.formattedTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(l)}
                            className="p-1 rounded-md text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                            title="Edit Date, Time, and Status in database"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {savedSuccessId === l.id && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-in fade-in">
                              Saved!
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Session Type */}
                    <td className="py-3.5 px-4">
                      {l.lessonSource === "TRIAL" ? (
                        <div className="space-y-0.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent-dark border border-accent/25">
                            Free Trial
                          </span>
                          {l.formattedCreatedDate && (
                            <p className="text-[10px] text-body/50 font-mono">
                              Booked {l.formattedCreatedDate}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cta/10 text-cta border border-cta/25">
                            Course Session
                          </span>
                          {l.courseTitle && (
                            <p className="text-[11px] font-semibold text-heading truncate max-w-[170px]" title={l.courseTitle}>
                              {l.courseTitle}
                            </p>
                          )}
                          {l.formattedCreatedDate && (
                            <p className="text-[10px] text-body/50 font-mono">
                              Allotted {l.formattedCreatedDate}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Faculty Instructor */}
                    <td className="py-3.5 px-4 font-semibold text-heading whitespace-nowrap">
                      {l.teacherName}
                    </td>

                    {/* Student */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-heading whitespace-nowrap">{l.studentName}</p>
                      <p className="text-[10px] text-body">{l.studentEmail}</p>
                    </td>

                    {/* Discipline */}
                    <td className="py-3.5 px-4 text-body">
                      {l.instrument} ({l.durationMinutes}m)
                    </td>

                    {/* Status (View Mode / Edit Mode) */}
                    <td className="py-3.5 px-4">
                      {editingLessonId === l.id ? (
                        <select
                          value={editStatusInput}
                          onChange={(e) => setEditStatusInput(e.target.value as LessonStatus)}
                          className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-white text-xs font-bold text-heading focus:outline-none focus:border-primary shadow-2xs cursor-pointer"
                        >
                          <option value={LessonStatus.SCHEDULED}>SCHEDULED</option>
                          <option value={LessonStatus.RESCHEDULED}>RESCHEDULED</option>
                          <option value={LessonStatus.COMPLETED}>COMPLETED</option>
                          <option value={LessonStatus.CANCELLED}>CANCELLED</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            l.status === "SCHEDULED"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : l.status === "RESCHEDULED"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : l.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {l.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {editingLessonId === l.id ? (
                          <>
                            <button
                              type="button"
                              disabled={isSaving || !editDateInput}
                              onClick={() => handleSaveDateTimeAndStatus(l.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer shrink-0"
                              title="Save changes directly to database"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => setEditingLessonId(null)}
                              className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-body transition-colors cursor-pointer shrink-0"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(l)}
                              className="p-1.5 rounded-lg bg-purple-50 text-[#3C096C] hover:bg-purple-100 transition-colors border border-purple-200 active:scale-95 shadow-2xs cursor-pointer"
                              title="Edit Date, Time, and Status directly in database"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <Link
                              href={`/lesson/${l.id}`}
                              target="_blank"
                              className="p-1.5 rounded-lg bg-bg-alt/40 text-primary hover:bg-primary hover:text-white transition-all active:scale-95 shadow-2xs"
                              title="Open Classroom"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            {(l.status === "SCHEDULED" || l.status === "RESCHEDULED") && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleCancelLesson(l.id, l.studentName)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200 text-[11px] font-semibold active:scale-95 cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
