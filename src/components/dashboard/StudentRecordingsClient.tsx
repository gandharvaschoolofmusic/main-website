"use client";

import { RecordingVideo } from "@/components/recordings/RecordingVideo";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Video,
  Play,
  Download,
  Calendar,
  Clock,
  Search,
  X,
  FileVideo,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Filter,
  CheckCircle2,
  HardDrive,
  User as UserIcon,
} from "lucide-react";

export interface StudentRecordingPart {
  id: string;
  fileUrl: string;
  fileId?: string | null;
  fileName: string;
  fileSizeBytes: number;
  durationSeconds?: number | null;
  createdAt: string;
}

export interface StudentLectureItem {
  id: string;
  trackingCode: string;
  instrument: string;
  courseTitle: string;
  courseSlug?: string | null;
  startsAt: string; // ISO string
  durationMinutes: number;
  status: string;
  teacher: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  recordings: StudentRecordingPart[];
  primaryRecordingUrl: string;
  totalDurationSeconds: number;
  totalFileSizeBytes: number;
}

interface StudentRecordingsClientProps {
  initialLectures: StudentLectureItem[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number, fallbackMinutes: number): string {
  if (seconds && seconds > 0) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  }
  return `${fallbackMinutes} mins`;
}

export function StudentRecordingsClient({
  initialLectures,
}: StudentRecordingsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");

  // Video Player Modal State
  const [activeLecture, setActiveLecture] = useState<StudentLectureItem | null>(null);
  const [activePartIndex, setActivePartIndex] = useState<number>(0);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveLecture(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute unique courses for filter dropdown
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>();
    initialLectures.forEach((l) => {
      if (l.courseTitle) {
        map.set(l.courseTitle, l.courseTitle);
      }
    });
    return Array.from(map.values());
  }, [initialLectures]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalRecordings = initialLectures.length;
    const totalSeconds = initialLectures.reduce(
      (acc, l) => acc + (l.totalDurationSeconds || l.durationMinutes * 60),
      0
    );
    const totalHours = (totalSeconds / 3600).toFixed(1);
    const totalBytes = initialLectures.reduce(
      (acc, l) => acc + (l.totalFileSizeBytes || 0),
      0
    );

    return {
      totalRecordings,
      totalHours,
      totalBytesFormatted: formatBytes(totalBytes),
      courseCount: uniqueCourses.length,
    };
  }, [initialLectures, uniqueCourses]);

  // Filtered and Sorted list
  const filteredLectures = useMemo(() => {
    return initialLectures
      .filter((l) => {
        // Course filter
        if (selectedCourse !== "ALL" && l.courseTitle !== selectedCourse) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCourse = l.courseTitle.toLowerCase().includes(q);
          const matchTeacher = l.teacher.name.toLowerCase().includes(q);
          const matchCode = l.trackingCode.toLowerCase().includes(q);
          const matchInstrument = l.instrument.toLowerCase().includes(q);
          if (!matchCourse && !matchTeacher && !matchCode && !matchInstrument) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.startsAt).getTime();
        const timeB = new Date(b.startsAt).getTime();
        return sortOrder === "NEWEST" ? timeB - timeA : timeA - timeB;
      });
  }, [initialLectures, selectedCourse, searchQuery, sortOrder]);

  const handleOpenPlayer = (lecture: StudentLectureItem, partIndex = 0) => {
    setActiveLecture(lecture);
    setActivePartIndex(partIndex);
  };

  const currentPlayingUrl = useMemo(() => {
    if (!activeLecture) return "";
    if (activeLecture.recordings && activeLecture.recordings.length > 0) {
      return (
        activeLecture.recordings[activePartIndex]?.fileUrl ||
        activeLecture.primaryRecordingUrl
      );
    }
    return activeLecture.primaryRecordingUrl;
  }, [activeLecture, activePartIndex]);

  return (
    <div className="space-y-6">
      {/* ─── HEADER BANNER ─── */}
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-white via-neutral-50/70 to-purple-50/20 p-6 md:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle decorative purple glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-primary/10 via-[#FF7803]/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-[#3C096C] border border-purple-200/80">
              <Sparkles className="w-3 h-3 text-[#FF7803]" />
              <span>Personal Archival Vault</span>
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-heading tracking-tight">
              My Lecture Recordings
            </h1>
            <p className="text-xs md:text-sm text-body leading-relaxed">
              Review your 1-on-1 live music sessions, practice along with faculty demonstrations, and replay past lectures anytime.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="bg-white/90 backdrop-blur-xs border border-neutral-200/80 rounded-2xl p-3.5 px-4 shadow-2xs text-center min-w-[100px]">
              <span className="text-[10px] font-bold text-body/60 uppercase tracking-wider block">
                Recorded Sessions
              </span>
              <span className="font-numeric text-xl font-extrabold text-[#3C096C]">
                {stats.totalRecordings}
              </span>
            </div>
            <div className="bg-white/90 backdrop-blur-xs border border-neutral-200/80 rounded-2xl p-3.5 px-4 shadow-2xs text-center min-w-[100px]">
              <span className="text-[10px] font-bold text-body/60 uppercase tracking-wider block">
                Total Hours
              </span>
              <span className="font-numeric text-xl font-extrabold text-[#FF7803]">
                {stats.totalHours} hrs
              </span>
            </div>
            <div className="bg-white/90 backdrop-blur-xs border border-neutral-200/80 rounded-2xl p-3.5 px-4 shadow-2xs text-center min-w-[100px]">
              <span className="text-[10px] font-bold text-body/60 uppercase tracking-wider block">
                Courses Vaulted
              </span>
              <span className="font-numeric text-xl font-extrabold text-heading">
                {stats.courseCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH STRIP ─── */}
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full min-w-[220px]">
          <Search className="w-4 h-4 text-body/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course title, teacher name, or tracking code..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-50/70 border border-neutral-200/80 text-heading placeholder:text-body/50 focus:outline-none focus:border-[#3C096C] focus:bg-white transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-body/40 hover:text-heading"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter by Course & Sort */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <div className="flex-1 md:flex-none">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full md:w-auto text-xs px-3 py-2 rounded-xl bg-neutral-50/70 border border-neutral-200/80 text-heading font-medium focus:outline-none focus:border-[#3C096C] focus:bg-white transition-all cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Enrolled Courses ({initialLectures.length})</option>
              {uniqueCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 md:flex-none">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "NEWEST" | "OLDEST")}
              className="w-full md:w-auto text-xs px-3 py-2 rounded-xl bg-neutral-50/70 border border-neutral-200/80 text-heading font-medium focus:outline-none focus:border-[#3C096C] focus:bg-white transition-all cursor-pointer shadow-2xs"
            >
              <option value="NEWEST">Most Recent First</option>
              <option value="OLDEST">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── RECORDINGS GRID ─── */}
      {filteredLectures.length === 0 ? (
        <div className="rounded-3xl border border-neutral-200/90 bg-white p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#3C096C] flex items-center justify-center mx-auto shadow-xs">
            <Video className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-serif text-lg font-bold text-heading">
              {searchQuery || selectedCourse !== "ALL"
                ? "No matching recordings found"
                : "No Lecture Recordings Available Yet"}
            </h3>
            <p className="text-xs text-body leading-relaxed">
              {searchQuery || selectedCourse !== "ALL"
                ? "Try clearing your search query or choosing another course filter."
                : "When you attend your 1-on-1 classes in the live classroom, the lecture video and audio are automatically processed, backed up to the cloud, and added here for unlimited replay."}
            </p>
          </div>
          {searchQuery || selectedCourse !== "ALL" ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCourse("ALL");
              }}
              className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-heading text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              Reset Filters
            </button>
          ) : (
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <span>View Upcoming Sessions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLectures.map((lecture) => {
            const lectureDate = new Date(lecture.startsAt);
            const partCount = lecture.recordings?.length || 1;

            return (
              <div
                key={lecture.id}
                className="group rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-[#3C096C]/30 transition-all flex flex-col justify-between"
              >
                {/* 16:9 Video Canvas Thumbnail */}
                <div
                  onClick={() => handleOpenPlayer(lecture, 0)}
                  className="relative aspect-video w-full bg-gradient-to-br from-[#1C0B36] via-[#120824] to-[#0A0514] flex items-center justify-center cursor-pointer overflow-hidden border-b border-neutral-100"
                >
                  {/* Subtle waveform grid aesthetic */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#FF7803_1px,transparent_1px)] [background-size:16px_16px]" />

                  {/* Play Button Trigger */}
                  <div className="relative z-10 w-12 h-12 rounded-full bg-white/10 group-hover:bg-[#FF7803] text-white flex items-center justify-center backdrop-blur-md transition-all group-hover:scale-110 shadow-lg border border-white/20">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#3C096C]/90 text-white backdrop-blur-xs border border-white/10">
                      {lecture.instrument || "1-on-1"}
                    </span>
                    {partCount > 1 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FF7803]/90 text-white backdrop-blur-xs">
                        {partCount} Parts
                      </span>
                    )}
                  </div>

                  {/* Bottom Right Duration Badge */}
                  <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold font-numeric bg-black/75 text-white backdrop-blur-xs flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>
                      {formatDuration(
                        lecture.totalDurationSeconds,
                        lecture.durationMinutes
                      )}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Course Title & Tracking ID */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-serif font-bold text-sm text-heading line-clamp-2 leading-snug group-hover:text-[#3C096C] transition-colors">
                        {lecture.courseTitle}
                      </h4>
                    </div>

                    <div className="inline-block px-2 py-0.5 rounded bg-neutral-100 text-[10px] font-bold font-numeric text-body/70">
                      Ref: {lecture.trackingCode}
                    </div>

                    {/* Teacher Details */}
                    <div className="flex items-center gap-2 pt-1 text-xs text-body">
                      <div className="w-6 h-6 rounded-full bg-[#3C096C]/10 text-[#3C096C] font-bold text-[10px] flex items-center justify-center shrink-0 overflow-hidden">
                        {lecture.teacher.image ? (
                          <Image
                            src={lecture.teacher.image}
                            alt={lecture.teacher.name}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          lecture.teacher.name.charAt(0)
                        )}
                      </div>
                      <span className="truncate">
                        Faculty: <strong className="text-heading">{lecture.teacher.name}</strong>
                      </span>
                    </div>

                    {/* Schedule Date & Time */}
                    <div className="flex items-center gap-1.5 text-xs text-body/80 font-numeric">
                      <Calendar className="w-3.5 h-3.5 text-body/50" />
                      <span>
                        {lectureDate.toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        •{" "}
                        {lectureDate.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions & File Size */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-numeric text-body/60">
                      {formatBytes(lecture.totalFileSizeBytes)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={lecture.primaryRecordingUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl border border-neutral-200 text-body hover:text-heading hover:bg-neutral-50 transition-all active:scale-95"
                        title="Download MP4 recording"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenPlayer(lecture, 0)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Watch</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── APPLE-DESIGN VIDEO PLAYER MODAL ─── */}
      {activeLecture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveLecture(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-[#0F0C18] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#140E24]">
              <div className="space-y-0.5 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#3C096C] text-white">
                    {activeLecture.instrument}
                  </span>
                  <span className="text-[11px] font-mono text-purple-300">
                    Ref: {activeLecture.trackingCode}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-base text-white truncate">
                  {activeLecture.courseTitle}
                </h3>
                <p className="text-xs text-white/60">
                  Taught by {activeLecture.teacher.name} •{" "}
                  {new Date(activeLecture.startsAt).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveLecture(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <RecordingVideo key={currentPlayingUrl} source={currentPlayingUrl} title={activeLecture.courseTitle}/>

            {/* Multi-part tabs if session was reconnected */}
            {activeLecture.recordings && activeLecture.recordings.length > 1 && (
              <div className="px-5 py-2.5 bg-[#140E24] border-t border-white/10 flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-semibold text-white/60 shrink-0">
                  Lecture Parts:
                </span>
                {activeLecture.recordings.map((part, idx) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setActivePartIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 ${
                      activePartIndex === idx
                        ? "bg-[#FF7803] text-white shadow-xs"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    Part {idx + 1} ({formatDuration(part.durationSeconds || 0, 0)})
                  </button>
                ))}
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#120E20] border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
              <div className="flex items-center gap-3">
                <span>Duration: {formatDuration(activeLecture.totalDurationSeconds, activeLecture.durationMinutes)}</span>
                <span>•</span>
                <span>Size: {formatBytes(activeLecture.totalFileSizeBytes)}</span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={currentPlayingUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Video</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActiveLecture(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

