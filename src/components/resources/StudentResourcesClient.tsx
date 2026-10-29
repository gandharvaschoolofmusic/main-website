"use client";

import { useState, useTransition, useMemo } from "react";
import Image from "next/image";
import {
  FileText,
  Music,
  FileCode,
  FileSpreadsheet,
  File,
  ExternalLink,
  Search,
  Check,
  CheckCircle2,
  Calendar,
  Sparkles,
  BookOpen,
  MessageCircle,
  GraduationCap,
  HardDrive,
} from "lucide-react";
import { markResourceViewedAction } from "@/actions/resources";
import { ResourceCategory } from "@prisma/client";

export type StudentReceivedResourceItem = {
  id: string;
  resourceId: string;
  teacherNote: string | null;
  sharedAt: Date | string;
  isViewed: boolean;
  viewedAt: Date | string | null;
  resource: {
    id: string;
    title: string;
    description: string | null;
    category: ResourceCategory;
    fileName: string;
    fileUrl: string;
    fileId: string | null;
    fileSizeBytes: number;
    mimeType: string | null;
    teacher: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      teacherProfile: {
        instruments: string[];
      } | null;
    };
  };
  course: {
    id: string;
    title: string;
    instrument: string;
  } | null;
};

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getCategoryColor(category: ResourceCategory) {
  switch (category) {
    case "SHEET_MUSIC":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "AUDIO_LESSON":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "LESSON_NOTES":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "EXERCISE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "ASSIGNMENT":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "REFERENCE":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-neutral-50 text-neutral-700 border-neutral-200";
  }
}

function getCategoryLabel(category: ResourceCategory) {
  switch (category) {
    case "SHEET_MUSIC":
      return "Sheet Music";
    case "AUDIO_LESSON":
      return "Audio Lesson";
    case "LESSON_NOTES":
      return "Lesson Notes";
    case "EXERCISE":
      return "Practice Exercise";
    case "ASSIGNMENT":
      return "Homework / Assignment";
    case "REFERENCE":
      return "Reference Guide";
    default:
      return "Learning Material";
  }
}

function getFileIcon(fileName: string, mimeType?: string | null) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["mp3", "wav", "m4a", "ogg", "aac"].includes(ext) || mimeType?.startsWith("audio/")) {
    return <Music className="w-5 h-5 text-purple-600" />;
  }
  if (ext === "pdf") {
    return <FileText className="w-5 h-5 text-rose-600" />;
  }
  if (["doc", "docx", "txt", "rtf"].includes(ext)) {
    return <FileCode className="w-5 h-5 text-blue-600" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  }
  return <File className="w-5 h-5 text-amber-600" />;
}

export function StudentResourcesClient({
  initialResources,
}: {
  initialResources: StudentReceivedResourceItem[];
}) {
  const [resources, setResources] = useState<StudentReceivedResourceItem[]>(initialResources);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [, startTransition] = useTransition();

  // Mark resource as viewed
  const handleMarkViewed = (shareId: string, fileUrl: string) => {
    // Open in Google Drive
    window.open(fileUrl, "_blank", "noopener,noreferrer");

    // Update local state
    setResources((prev) =>
      prev.map((r) => (r.id === shareId ? { ...r, isViewed: true, viewedAt: new Date() } : r))
    );

    startTransition(async () => {
      await markResourceViewedAction(shareId);
    });
  };

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      const titleMatch = item.resource.title.toLowerCase().includes(searchQuery.toLowerCase());
      const teacherMatch =
        item.resource.teacher.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const notesMatch = item.teacherNote?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const courseMatch = item.course?.title.toLowerCase().includes(searchQuery.toLowerCase()) || false;

      const matchesSearch = titleMatch || teacherMatch || notesMatch || courseMatch;
      const matchesCat =
        selectedCategory === "ALL" || item.resource.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [resources, searchQuery, selectedCategory]);

  const totalReceived = resources.length;
  const unreadCount = resources.filter((r) => !r.isViewed).length;

  return (
    <div className="space-y-8">
      {/* ─── Hero / Header ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-border-default bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-accent-dark font-sans">
              Gandharva Student Portal
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-subtle text-primary border border-primary/20">
              <HardDrive className="w-3 h-3" />
              Supabase Cloud
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-1">
            Learning Resources & Practice Materials
          </h1>
          <p className="text-xs sm:text-sm text-body mt-1.5 max-w-2xl leading-relaxed">
            Sheet music, recorded audio guides, and personalized lesson notes sent directly by your maestros. Access all files securely via Supabase Cloud.
          </p>
        </div>

        {/* Quick Unread Tag */}
        {unreadCount > 0 && (
          <div className="rounded-2xl bg-accent-subtle border border-accent/30 p-4 shrink-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent-dark flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-accent-dark" />
            </div>
            <div>
              <p className="text-xs font-bold text-accent-dark">
                {unreadCount} New Material{unreadCount === 1 ? "" : "s"}
              </p>
              <p className="text-[11px] text-body-muted">
                Sent by your faculty teachers
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Search & Category Filters ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-border-default shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, maestro name, or note..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-border-default bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 text-heading placeholder:text-body-muted"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: "ALL", label: `All (${totalReceived})` },
            { id: "SHEET_MUSIC", label: "Sheets" },
            { id: "AUDIO_LESSON", label: "Audio" },
            { id: "LESSON_NOTES", label: "Notes" },
            { id: "EXERCISE", label: "Exercises" },
            { id: "ASSIGNMENT", label: "Assignments" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all btn-tactile cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-primary text-white font-semibold shadow-xs"
                  : "bg-bg-alt/30 text-body hover:text-heading hover:bg-bg-alt/60"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Materials List / Cards ─────────────────────────────────────────── */}
      {filteredResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-border-default text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7 opacity-75" />
          </div>
          <h3 className="text-base font-serif font-bold text-heading">
            {searchQuery || selectedCategory !== "ALL"
              ? "No matching materials found"
              : "No learning materials received yet"}
          </h3>
          <p className="text-xs text-body-muted mt-1 max-w-sm">
            {searchQuery || selectedCategory !== "ALL"
              ? "Try adjusting your search terms or category filter."
              : "When your maestros upload sheet music, audio tracks, or practice exercises for your course, they will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map((item) => {
            const res = item.resource;
            const teacher = res.teacher;
            const catBadgeClass = getCategoryColor(res.category);

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs hover:shadow-md transition-all ${
                  item.isViewed
                    ? "border-border-default hover:border-primary/30"
                    : "border-accent/40 bg-accent-subtle/15 hover:border-accent"
                }`}
              >
                <div>
                  {/* Top Bar: Maestro details & New indicator */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle/70">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {teacher.image ? (
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-primary/20 shrink-0">
                          <Image
                            src={teacher.image}
                            alt={teacher.name || "Maestro"}
                            fill
                            sizes="32px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {teacher.name?.slice(0, 1).toUpperCase() || "M"}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-heading truncate">
                          Maestro {teacher.name || "Faculty Instructor"}
                        </p>
                        <p className="text-[10px] text-body-muted truncate">
                          {item.course?.title ||
                            teacher.teacherProfile?.instruments?.join(", ") ||
                            "Music Faculty"}
                        </p>
                      </div>
                    </div>

                    {!item.isViewed && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white shadow-xs shrink-0">
                        New
                      </span>
                    )}
                  </div>

                  {/* Resource details */}
                  <div className="flex items-start gap-3 mt-3.5">
                    <div className="w-10 h-10 rounded-xl bg-bg-alt/40 border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                      {getFileIcon(res.fileName, res.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${catBadgeClass}`}
                        >
                          {getCategoryLabel(res.category)}
                        </span>
                        <span className="text-[10px] text-body-muted">
                          {formatBytes(res.fileSizeBytes)}
                        </span>
                      </div>
                      <h4 className="font-serif font-bold text-sm text-heading truncate mt-1 group-hover:text-primary transition-colors">
                        {res.title}
                      </h4>
                      <p className="text-[11px] text-body-muted truncate">
                        {res.fileName}
                      </p>
                    </div>
                  </div>

                  {/* Maestro's Practice Note */}
                  {item.teacherNote ? (
                    <div className="mt-3 p-3 rounded-xl bg-primary-subtle/50 border border-primary/20 text-xs text-heading space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        <MessageCircle className="w-3 h-3" />
                        <span>Maestro&apos;s Advice:</span>
                      </div>
                      <p className="text-xs text-body italic leading-relaxed">
                        &ldquo;{item.teacherNote}&rdquo;
                      </p>
                    </div>
                  ) : res.description ? (
                    <p className="mt-3 text-xs text-body leading-relaxed line-clamp-2 bg-bg-alt/15 p-2 rounded-lg border border-border-subtle/50">
                      {res.description}
                    </p>
                  ) : null}

                  {/* Received Date */}
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-body-muted">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Received{" "}
                      {new Date(item.sharedAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Footer Action: Open in Google Drive */}
                <div className="mt-5 pt-3.5 border-t border-border-default/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-body-muted">
                    {item.isViewed ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Reviewed
                      </span>
                    ) : (
                      <span className="text-accent-dark font-medium">Ready to open</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleMarkViewed(item.id, res.fileUrl)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all btn-tactile cursor-pointer"
                  >
                    <span>Open File</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
