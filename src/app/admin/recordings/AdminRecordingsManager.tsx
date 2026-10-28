"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Music,
  Users,
  Calendar,
  Video,
  ArrowLeft,
  ChevronRight,
  Play,
  Download,
  ExternalLink,
  HardDrive,
  Cloud,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  X,
  Search,
  FileVideo,
  AlertCircle,
  Sparkles,
  GraduationCap,
  User,
  Layers,
} from "lucide-react";
import {
  syncRecordingToDriveAction,
  deleteRecordingAdminAction,
} from "@/actions/admin";

export interface RecordingFileItem {
  id: string;
  lessonId: string;
  fileName: string;
  fileUrl: string;
  fileId: string | null;
  fileSizeBytes: number;
  durationSeconds: number | null;
  storageBackend: "GOOGLE_DRIVE" | "LOCAL" | string;
  createdAt: string;
  formattedDate: string;
  partNumber?: number;
}

export interface SessionLessonItem {
  id: string;
  trackingCode: string;
  sessionNumber: number;
  startsAt: string;
  formattedDate: string;
  formattedTime: string;
  status: string;
  durationMinutes: number;
  instrument: string;
  teacherName: string;
  teacherEmail: string;
  recordings: RecordingFileItem[];
}

export interface EnrolledStudentItem {
  id: string;
  name: string;
  email: string;
  image: string | null;
  enrollmentId: string;
  sessionsRemaining?: number;
  lessons: SessionLessonItem[];
  totalRecordingsCount: number;
  totalDurationSeconds: number;
}

export interface CourseGroupItem {
  id: string;
  title: string;
  slug: string;
  instrument: string;
  level: string;
  discipline: string;
  isTrialGroup?: boolean;
  students: EnrolledStudentItem[];
  totalStudentsCount: number;
  totalRecordingsCount: number;
  totalDurationSeconds: number;
}

export interface DriveConfigStatus {
  isConfigured: boolean;
  accessible: boolean;
  folderName?: string;
  folderId?: string;
  isSharedDrive?: boolean;
}

interface AdminRecordingsManagerProps {
  courses: CourseGroupItem[];
  driveStatus: DriveConfigStatus;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDurationToHoursMinutes(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0 mins";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m} mins`;
}

export function AdminRecordingsManager({
  courses: initialCourses,
  driveStatus,
}: AdminRecordingsManagerProps) {
  const [courses, setCourses] = useState<CourseGroupItem[]>(initialCourses);

  // ─── Hierarchical Navigation State ─────────────────────────────────────────
  // Step 1: Course (selectedCourseId)
  // Step 2: Student (selectedStudentId)
  // Step 3: Session Lesson (selectedSessionId)
  // Step 4: Particular Session Recordings Tab (active inside selectedSession)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Search & Global state
  const [searchQuery, setSearchQuery] = useState("");
  const [playingRecording, setPlayingRecording] = useState<RecordingFileItem | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // Escape key closes video modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && playingRecording) {
        setPlayingRecording(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playingRecording]);

  // Derived selected entities
  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  const selectedStudent = useMemo(() => {
    if (!selectedCourse) return null;
    return selectedCourse.students.find((s) => s.id === selectedStudentId) || null;
  }, [selectedCourse, selectedStudentId]);

  const selectedSession = useMemo(() => {
    if (!selectedStudent) return null;
    return selectedStudent.lessons.find((l) => l.id === selectedSessionId) || null;
  }, [selectedStudent, selectedSessionId]);

  // Global Statistics
  const globalStats = useMemo(() => {
    let totalRecordings = 0;
    let totalSeconds = 0;
    let driveCount = 0;
    let totalStudents = 0;

    courses.forEach((c) => {
      totalStudents += c.totalStudentsCount;
      c.students.forEach((s) => {
        s.lessons.forEach((l) => {
          l.recordings.forEach((r) => {
            totalRecordings++;
            totalSeconds += r.durationSeconds || 0;
            if (r.storageBackend === "GOOGLE_DRIVE") {
              driveCount++;
            }
          });
        });
      });
    });

    const drivePercent =
      totalRecordings > 0 ? Math.round((driveCount / totalRecordings) * 100) : 100;

    return {
      totalCourses: courses.length,
      totalStudents,
      totalRecordings,
      totalHours: (totalSeconds / 3600).toFixed(1),
      drivePercent,
      driveCount,
    };
  }, [courses]);

  // Filtered courses for Course List view
  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter((c) => {
      const matchCourse =
        c.title.toLowerCase().includes(q) ||
        c.instrument.toLowerCase().includes(q) ||
        c.discipline.toLowerCase().includes(q);

      const matchStudent = c.students.some(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.lessons.some((l) => l.trackingCode.toLowerCase().includes(q)),
      );

      return matchCourse || matchStudent;
    });
  }, [courses, searchQuery]);

  // Filtered students for Student List view
  const filteredStudents = useMemo(() => {
    if (!selectedCourse) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return selectedCourse.students;
    return selectedCourse.students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.lessons.some((l) => l.trackingCode.toLowerCase().includes(q)),
    );
  }, [selectedCourse, searchQuery]);

  // Actions
  const handleCopyLink = async (recording: RecordingFileItem) => {
    try {
      const urlToCopy = recording.fileUrl.startsWith("http")
        ? recording.fileUrl
        : `${window.location.origin}${recording.fileUrl}`;
      await navigator.clipboard.writeText(urlToCopy);
      setCopiedId(recording.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert("Failed to copy link.");
    }
  };

  const handleSyncToDrive = (recordingId: string) => {
    setSyncingId(recordingId);
    startTransition(async () => {
      const res = await syncRecordingToDriveAction(recordingId);
      setSyncingId(null);
      if (!res.success) {
        alert(res.error || "Failed to sync recording to Google Drive.");
      } else if (res.data) {
        setCourses((prevCourses) =>
          prevCourses.map((c) => ({
            ...c,
            students: c.students.map((s) => ({
              ...s,
              lessons: s.lessons.map((l) => ({
                ...l,
                recordings: l.recordings.map((r) =>
                  r.id === recordingId
                    ? {
                        ...r,
                        storageBackend: "GOOGLE_DRIVE",
                        fileUrl: res.data!.fileUrl,
                        fileId: res.data!.fileId,
                      }
                    : r,
                ),
              })),
            })),
          })),
        );
      }
    });
  };

  const handleDeleteRecording = (recordingId: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this session recording? This will remove the file from cloud storage and database.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteRecordingAdminAction(recordingId);
      if (!res.success) {
        alert(res.error || "Failed to delete recording.");
      } else {
        setCourses((prevCourses) =>
          prevCourses.map((c) => {
            const updatedStudents = c.students.map((s) => {
              const updatedLessons = s.lessons.map((l) => ({
                ...l,
                recordings: l.recordings.filter((r) => r.id !== recordingId),
              }));
              const totalRecs = updatedLessons.reduce((acc, l) => acc + l.recordings.length, 0);
              const totalSec = updatedLessons.reduce(
                (acc, l) =>
                  acc + l.recordings.reduce((sum, r) => sum + (r.durationSeconds || 0), 0),
                0,
              );
              return {
                ...s,
                lessons: updatedLessons,
                totalRecordingsCount: totalRecs,
                totalDurationSeconds: totalSec,
              };
            });

            const totalRecs = updatedStudents.reduce((acc, s) => acc + s.totalRecordingsCount, 0);
            const totalSec = updatedStudents.reduce((acc, s) => acc + s.totalDurationSeconds, 0);

            return {
              ...c,
              students: updatedStudents,
              totalRecordingsCount: totalRecs,
              totalDurationSeconds: totalSec,
            };
          }),
        );
        if (playingRecording?.id === recordingId) {
          setPlayingRecording(null);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Apple Design: Step Indicator & Breadcrumb Bar ───────────────── */}
      <div className="rounded-2xl border border-primary/10 bg-white p-4 shadow-xs space-y-3">
        {/* Step Indicator Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
          {/* Step 1: Courses */}
          <button
            type="button"
            onClick={() => {
              setSelectedCourseId(null);
              setSelectedStudentId(null);
              setSelectedSessionId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap ${
              !selectedCourse
                ? "bg-primary text-white shadow-xs"
                : "bg-bg-alt/40 text-primary hover:bg-bg-alt"
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>1. Course Catalog</span>
            <span className="text-[10px] opacity-75 font-mono">({courses.length})</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-body-muted shrink-0" />

          {/* Step 2: Enrolled Students */}
          <button
            type="button"
            disabled={!selectedCourse}
            onClick={() => {
              setSelectedStudentId(null);
              setSelectedSessionId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all active:scale-[0.98] whitespace-nowrap ${
              selectedCourse && !selectedStudent
                ? "bg-primary text-white shadow-xs"
                : selectedCourse
                ? "bg-bg-alt/40 text-primary hover:bg-bg-alt cursor-pointer"
                : "text-body-muted/50 cursor-not-allowed"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>2. Enrolled Students</span>
            {selectedCourse && (
              <span className="text-[10px] opacity-75 font-mono">
                ({selectedCourse.students.length})
              </span>
            )}
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-body-muted shrink-0" />

          {/* Step 3: Class Sessions */}
          <button
            type="button"
            disabled={!selectedStudent}
            onClick={() => {
              setSelectedSessionId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all active:scale-[0.98] whitespace-nowrap ${
              selectedStudent && !selectedSession
                ? "bg-primary text-white shadow-xs"
                : selectedStudent
                ? "bg-bg-alt/40 text-primary hover:bg-bg-alt cursor-pointer"
                : "text-body-muted/50 cursor-not-allowed"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>3. Class Sessions</span>
            {selectedStudent && (
              <span className="text-[10px] opacity-75 font-mono">
                ({selectedStudent.lessons.length})
              </span>
            )}
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-body-muted shrink-0" />

          {/* Step 4: Particular Session Recordings Tab */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap ${
              selectedSession
                ? "bg-primary text-white shadow-xs"
                : "text-body-muted/50"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>4. Session Recordings Vault</span>
            {selectedSession && (
              <span className="text-[10px] opacity-75 font-mono">
                ({selectedSession.recordings.length})
              </span>
            )}
          </div>
        </div>

        {/* Interactive Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-xs text-body pt-2 border-t border-primary/5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectedCourseId(null);
              setSelectedStudentId(null);
              setSelectedSessionId(null);
            }}
            className="font-medium hover:text-primary transition-colors cursor-pointer"
          >
            All Courses
          </button>

          {selectedCourse && (
            <>
              <ChevronRight className="w-3 h-3 text-body-muted" />
              <button
                type="button"
                onClick={() => {
                  setSelectedStudentId(null);
                  setSelectedSessionId(null);
                }}
                className={`font-medium transition-colors cursor-pointer ${
                  !selectedStudent ? "text-heading font-bold" : "hover:text-primary"
                }`}
              >
                {selectedCourse.title}
              </button>
            </>
          )}

          {selectedStudent && (
            <>
              <ChevronRight className="w-3 h-3 text-body-muted" />
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionId(null);
                }}
                className={`font-medium transition-colors cursor-pointer ${
                  !selectedSession ? "text-heading font-bold" : "hover:text-primary"
                }`}
              >
                {selectedStudent.name}
              </button>
            </>
          )}

          {selectedSession && (
            <>
              <ChevronRight className="w-3 h-3 text-body-muted" />
              <span className="text-heading font-bold">
                Session {selectedSession.sessionNumber} ({selectedSession.trackingCode})
              </span>
            </>
          )}
        </div>
      </div>

      {/* ─── LEVEL 1: LIST OF COURSES ────────────────────────────────────── */}
      {!selectedCourse && (
        <div className="space-y-6">
          {/* Cloud Vault Status & Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-primary/10 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-body">
                <span className="text-xs font-medium">Total Courses</span>
                <div className="w-7 h-7 rounded-lg bg-primary/5 text-primary flex items-center justify-center">
                  <Music className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-heading">
                {globalStats.totalCourses}
              </div>
              <p className="text-[11px] text-body-muted">Curriculum programs active</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-primary/10 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-body">
                <span className="text-xs font-medium">Enrolled Students</span>
                <div className="w-7 h-7 rounded-lg bg-cta/10 text-cta flex items-center justify-center">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-heading">
                {globalStats.totalStudents}
              </div>
              <p className="text-[11px] text-body-muted">Active learner profiles</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-primary/10 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-body">
                <span className="text-xs font-medium">Archived Sessions</span>
                <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent-dark flex items-center justify-center">
                  <Video className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-heading">
                {globalStats.totalRecordings}
              </div>
              <p className="text-[11px] text-body-muted">{globalStats.totalHours} hrs of video recorded</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-primary/10 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-body">
                <span className="text-xs font-medium">Drive Sync Vault</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Cloud className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-heading">
                {globalStats.drivePercent}%
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                {driveStatus.accessible ? "Google Drive Connected" : "Local Disk Storage"}
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-body-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search course title, instrument, student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-8 py-2.5 rounded-xl bg-white border border-primary/10 text-heading placeholder:text-body-muted focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-body-muted hover:text-heading"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-xs text-body-muted hidden sm:inline-block">
              Select any course to view enrolled students & session recordings
            </span>
          </div>

          {/* Course Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className="group relative rounded-2xl bg-white border border-primary/10 p-5 shadow-xs hover:shadow-md hover:border-primary/25 transition-all flex flex-col justify-between cursor-pointer active:scale-[0.99]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-primary/5 text-primary border border-primary/10">
                      {course.instrument}
                    </span>
                    <span className="text-[10px] font-sans font-medium text-body-muted bg-bg-alt/40 px-2 py-0.5 rounded-md">
                      {course.level}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-base font-bold text-heading group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-body-muted mt-0.5">{course.discipline}</p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-primary/5 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-semibold text-body-muted">
                        Enrolled Students
                      </span>
                      <div className="font-bold text-heading flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-cta" />
                        {course.totalStudentsCount}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-semibold text-body-muted">
                        Archived Recordings
                      </span>
                      <div className="font-bold text-heading flex items-center gap-1.5">
                        <Video className="w-3 h-3 text-primary" />
                        {course.totalRecordingsCount}
                        <span className="text-[10px] font-normal text-body-muted">
                          ({formatDurationToHoursMinutes(course.totalDurationSeconds)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      Inspect Enrolled Students <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                    {course.totalRecordingsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Cloud className="w-2.5 h-2.5" />
                        Recordings Ready
                      </span>
                    ) : (
                      <span className="text-[10px] text-body-muted">No recordings yet</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── LEVEL 2: LIST OF STUDENTS ENROLLED ──────────────────────────── */}
      {selectedCourse && !selectedStudent && (
        <div className="space-y-6">
          {/* Header Hero Banner with Course info */}
          <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setSelectedCourseId(null)}
                className="w-10 h-10 rounded-xl bg-bg-alt/40 hover:bg-bg-alt text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                title="Back to Course Catalog"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/5 text-primary">
                    {selectedCourse.instrument}
                  </span>
                  <span className="text-[10px] font-medium text-body-muted">
                    {selectedCourse.level}
                  </span>
                </div>
                <h2 className="font-serif text-lg font-bold text-heading mt-0.5">
                  {selectedCourse.title}
                </h2>
                <p className="text-xs text-body">
                  Select an enrolled student to view their scheduled session lessons and recordings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-xs font-semibold text-heading">
                  {selectedCourse.totalStudentsCount} Enrolled Learners
                </div>
                <div className="text-[11px] text-body-muted">
                  {selectedCourse.totalRecordingsCount} recordings (
                  {formatDurationToHoursMinutes(selectedCourse.totalDurationSeconds)})
                </div>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-3.5 h-3.5 text-body-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-8 py-2.5 rounded-xl bg-white border border-primary/10 text-heading placeholder:text-body-muted focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-body-muted hover:text-heading"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Student Cards Grid */}
          {filteredStudents.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-primary/10 shadow-xs text-center space-y-3">
              <Users className="w-10 h-10 text-body-muted mx-auto" />
              <h4 className="font-serif text-base font-bold text-heading">
                No Students Enrolled in This Course Yet
              </h4>
              <p className="text-xs text-body max-w-sm mx-auto">
                When students purchase this course, their profiles and timetable sessions will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className="group relative rounded-2xl bg-white border border-primary/10 p-5 shadow-xs hover:shadow-md hover:border-primary/25 transition-all flex flex-col justify-between cursor-pointer active:scale-[0.99]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#3C096C] to-[#2D0752] text-white font-serif font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-serif text-sm font-bold text-heading truncate group-hover:text-primary transition-colors">
                          {student.name}
                        </h4>
                        <p className="text-xs text-body-muted truncate">{student.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/5 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-body-muted">
                          Sessions Total
                        </span>
                        <div className="font-bold text-heading flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-primary" />
                          {student.lessons.length}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-body-muted">
                          Recordings
                        </span>
                        <div className="font-bold text-heading flex items-center gap-1.5">
                          <Video className="w-3 h-3 text-cta" />
                          {student.totalRecordingsCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-primary/5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      Inspect Class Sessions <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                    {student.totalRecordingsCount > 0 ? (
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {formatDurationToHoursMinutes(student.totalDurationSeconds)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-body-muted">No recordings yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── LEVEL 3: STUDENT SESSION LESSON LIST ────────────────────────── */}
      {selectedCourse && selectedStudent && !selectedSession && (
        <div className="space-y-6">
          {/* Header Hero Banner with Student info */}
          <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="w-10 h-10 rounded-xl bg-bg-alt/40 hover:bg-bg-alt text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                title="Back to Enrolled Students"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/5 text-primary">
                    {selectedCourse.title}
                  </span>
                </div>
                <h2 className="font-serif text-lg font-bold text-heading mt-0.5">
                  {selectedStudent.name}’s Timetable & Sessions
                </h2>
                <p className="text-xs text-body">
                  Select a particular session below to inspect and play all stored recordings.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-heading">
                {selectedStudent.lessons.length} Scheduled Sessions
              </div>
              <div className="text-[11px] text-emerald-700 font-medium">
                {selectedStudent.totalRecordingsCount} recordings (
                {formatDurationToHoursMinutes(selectedStudent.totalDurationSeconds)})
              </div>
            </div>
          </div>

          {/* Sessions List */}
          {selectedStudent.lessons.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-primary/10 shadow-xs text-center space-y-3">
              <Calendar className="w-10 h-10 text-body-muted mx-auto" />
              <h4 className="font-serif text-base font-bold text-heading">
                No Scheduled Sessions Found
              </h4>
              <p className="text-xs text-body max-w-sm mx-auto">
                No timetable sessions are scheduled for this student yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedStudent.lessons.map((lesson) => {
                const hasRecordings = lesson.recordings.length > 0;
                const totalSec = lesson.recordings.reduce(
                  (sum, r) => sum + (r.durationSeconds || 0),
                  0,
                );

                return (
                  <div
                    key={lesson.id}
                    onClick={() => setSelectedSessionId(lesson.id)}
                    className="group rounded-2xl bg-white border border-primary/10 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-primary/25 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      {/* Session Number Badge */}
                      <div className="w-12 h-12 rounded-xl bg-primary/5 text-primary font-serif font-bold text-base flex flex-col items-center justify-center shrink-0 border border-primary/10">
                        <span className="text-[9px] uppercase tracking-wider font-mono opacity-60">
                          Class
                        </span>
                        <span>#{lesson.sessionNumber}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif text-sm font-bold text-heading group-hover:text-primary transition-colors">
                            {lesson.formattedDate}
                          </span>
                          <span className="text-xs text-body-muted font-mono">
                            at {lesson.formattedTime}
                          </span>
                          <span className="text-[10px] font-mono bg-bg-alt/50 text-primary px-2 py-0.5 rounded">
                            {lesson.trackingCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              lesson.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700"
                                : lesson.status === "CANCELLED"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {lesson.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-body-muted flex-wrap">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-primary" />
                            Instructor: <strong className="text-heading">{lesson.teacherName}</strong>
                          </span>
                          <span>•</span>
                          <span>Duration: {lesson.durationMinutes} mins scheduled</span>
                        </div>
                      </div>
                    </div>

                    {/* Right action & recording status pill */}
                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-primary/5">
                      {hasRecordings ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Cloud className="w-3.5 h-3.5" />
                            {lesson.recordings.length} {lesson.recordings.length === 1 ? "Recording" : "Recordings"} ({formatDurationToHoursMinutes(totalSec)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-body-muted">No recordings archived</span>
                      )}

                      <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                        Open Vault <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── LEVEL 4: PARTICULAR SESSION RECORDINGS TAB / VAULT ──────────── */}
      {selectedCourse && selectedStudent && selectedSession && (
        <div className="space-y-6">
          {/* Header Hero Banner with Session info */}
          <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setSelectedSessionId(null)}
                className="w-10 h-10 rounded-xl bg-bg-alt/40 hover:bg-bg-alt text-primary flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                title="Back to Sessions List"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/5 text-primary">
                    Class #{selectedSession.sessionNumber}
                  </span>
                  <span className="text-[11px] font-mono text-body-muted">
                    {selectedSession.trackingCode}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {selectedSession.status}
                  </span>
                </div>
                <h2 className="font-serif text-lg font-bold text-heading mt-0.5">
                  Recordings for {selectedSession.formattedDate} Session
                </h2>
                <p className="text-xs text-body">
                  Student: <strong className="text-heading">{selectedStudent.name}</strong> • Instructor:{" "}
                  <strong className="text-heading">{selectedSession.teacherName}</strong> • {selectedSession.instrument}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-heading">
                {selectedSession.recordings.length}{" "}
                {selectedSession.recordings.length === 1 ? "File Saved" : "Parts Saved"}
              </div>
              <div className="text-[11px] text-body-muted">
                Total duration:{" "}
                {formatDuration(
                  selectedSession.recordings.reduce(
                    (sum, r) => sum + (r.durationSeconds || 0),
                    0,
                  ),
                )}
              </div>
            </div>
          </div>

          {/* Recordings List for this particular session */}
          {selectedSession.recordings.length === 0 ? (
            <div className="p-12 rounded-2xl bg-white border border-primary/10 shadow-xs text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mx-auto shadow-xs">
                <Video className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="font-serif text-lg font-bold text-heading">
                  No Recordings Archived for This Session Yet
                </h4>
                <p className="text-xs text-body leading-relaxed">
                  When the teacher and student conduct this lesson in the classroom, the video and mixed audio will automatically record. Once the instructor exits the room, the finalized recording will upload to Google Drive and appear here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionId(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-bg-alt/50 hover:bg-bg-alt text-primary text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Sessions List
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-sm font-bold text-heading flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Archived Session Recordings ({selectedSession.recordings.length})
                </h3>
                <span className="text-xs text-body-muted">
                  Click &apos;Watch&apos; to view in high definition or open in Google Drive
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {selectedSession.recordings.map((recording, idx) => {
                  const isGoogleDrive = recording.storageBackend === "GOOGLE_DRIVE";
                  const isSyncing = syncingId === recording.id;
                  const isCopied = copiedId === recording.id;

                  return (
                    <div
                      key={recording.id}
                      className="group relative rounded-2xl bg-white border border-primary/10 shadow-xs hover:shadow-md hover:border-primary/25 transition-all flex flex-col justify-between overflow-hidden"
                    >
                      {/* Video Preview Canvas Header */}
                      <div>
                        <div className="relative aspect-video w-full bg-gradient-to-br from-[#160A29] to-[#0E0C18] flex items-center justify-center overflow-hidden border-b border-primary/5">
                          {/* Part badge */}
                          <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/70 text-amber-300 backdrop-blur-md border border-white/10">
                              Part {recording.partNumber || idx + 1}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-black/50 text-stone-300 backdrop-blur-md border border-white/10">
                              {selectedSession.instrument}
                            </span>
                          </div>

                          {/* Duration Badge */}
                          <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-black/75 text-white backdrop-blur-md flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {formatDuration(recording.durationSeconds)}
                          </div>

                          {/* Storage Backend Badge */}
                          <div className="absolute bottom-2.5 left-3">
                            {isGoogleDrive ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md flex items-center gap-1">
                                <Cloud className="w-2.5 h-2.5" />
                                Google Drive
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/30 backdrop-blur-md flex items-center gap-1">
                                <HardDrive className="w-2.5 h-2.5" />
                                Local Disk
                              </span>
                            )}
                          </div>

                          {/* Centered Play Button overlay */}
                          <button
                            type="button"
                            onClick={() => setPlayingRecording(recording)}
                            className="w-13 h-13 rounded-full bg-primary/85 hover:bg-primary text-white flex items-center justify-center shadow-lg transform transition-all group-hover:scale-110 active:scale-95 cursor-pointer"
                            title="Play Recording"
                          >
                            <Play className="w-5 h-5 ml-0.5 fill-current" />
                          </button>
                        </div>

                        {/* Card metadata */}
                        <div className="p-4 space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-body-muted">
                            <span className="font-medium text-heading">
                              Archived: {recording.formattedDate}
                            </span>
                            <span className="text-[11px]">
                              Size: {formatBytes(recording.fileSizeBytes)}
                            </span>
                          </div>

                          <div className="text-[11px] text-body-muted font-mono truncate" title={recording.fileName}>
                            {recording.fileName}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="p-3 bg-bg-alt/25 border-t border-primary/10 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Watch Button */}
                          <button
                            type="button"
                            onClick={() => setPlayingRecording(recording)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Watch
                          </button>

                          {/* Open in Drive */}
                          {isGoogleDrive && recording.fileUrl && (
                            <a
                              href={recording.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-bg-alt text-heading border border-primary/10 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
                              title="Open in Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Drive
                            </a>
                          )}

                          {/* Sync to Drive button (if stored locally) */}
                          {!isGoogleDrive && (
                            <button
                              type="button"
                              onClick={() => handleSyncToDrive(recording.id)}
                              disabled={isSyncing || isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/30 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                              title="Sync to Google Drive"
                            >
                              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                              {isSyncing ? "Syncing..." : "Sync to Drive"}
                            </button>
                          )}

                          {/* Download Link */}
                          <a
                            href={recording.fileUrl}
                            download={recording.fileName}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-body hover:text-heading hover:bg-white border border-transparent hover:border-primary/10 transition-all cursor-pointer"
                            title="Download file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Copy Link */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(recording)}
                            className="p-1.5 rounded-lg text-body hover:text-heading hover:bg-white border border-transparent hover:border-primary/10 transition-all cursor-pointer"
                            title="Copy link to clipboard"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRecording(recording.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-all cursor-pointer shrink-0"
                          title="Permanently Delete Recording"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Apple Design: Video Player Modal ────────────────────────────── */}
      {playingRecording && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0E0C18]/85 backdrop-blur-2xl transition-all duration-300"
          onClick={() => setPlayingRecording(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-[#161226] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#120E20]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#3C096C] text-white flex items-center justify-center">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                    {selectedSession?.instrument || "Music"} Session Recording
                    <span className="text-[11px] font-mono text-amber-300 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      Part {playingRecording.partNumber || 1}
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    Student:{" "}
                    <span className="text-stone-200 font-medium">
                      {selectedStudent?.name}
                    </span>{" "}
                    • Instructor:{" "}
                    <span className="text-stone-200 font-medium">
                      {selectedSession?.teacherName}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {playingRecording.fileUrl && (
                  <a
                    href={playingRecording.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 text-xs font-semibold transition-all active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Source
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPlayingRecording(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative bg-black flex items-center justify-center aspect-video w-full">
              <video
                src={playingRecording.fileUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
                playsInline
              >
                Your browser does not support HTML5 video playback.
              </video>
            </div>

            {/* Modal Footer info */}
            <div className="px-6 py-3.5 bg-[#120E20] border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
              <div className="flex items-center gap-3">
                <span>Date: {playingRecording.formattedDate}</span>
                <span>•</span>
                <span>Duration: {formatDuration(playingRecording.durationSeconds)}</span>
                <span>•</span>
                <span>Size: {formatBytes(playingRecording.fileSizeBytes)}</span>
              </div>

              <div className="flex items-center gap-2">
                {playingRecording.storageBackend === "GOOGLE_DRIVE" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                    <Cloud className="w-3 h-3" />
                    Stored in Google Drive (chat_storage)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                    <HardDrive className="w-3 h-3" />
                    Stored on Local Server
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
