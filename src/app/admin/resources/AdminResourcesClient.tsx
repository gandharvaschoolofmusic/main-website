"use client";

import { useState, useTransition, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Upload,
  FileText,
  Music,
  FileCode,
  FileSpreadsheet,
  File,
  Trash2,
  Share2,
  ExternalLink,
  Search,
  Filter,
  Check,
  CheckCircle2,
  Users,
  AlertCircle,
  Loader2,
  X,
  HardDrive,
  Sparkles,
  Plus,
  Calendar,
  GraduationCap,
  Eye,
  BookOpen,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import {
  uploadResourceAction,
  deleteResourceAction,
  shareResourceAction,
  unshareResourceAction,
  AllottedStudentOption,
} from "@/actions/resources";
import { ResourceCategory } from "@prisma/client";

export type AdminResourceItem = {
  id: string;
  title: string;
  description: string | null;
  category: ResourceCategory;
  fileName: string;
  fileUrl: string;
  fileId: string | null;
  fileSizeBytes: number;
  mimeType: string | null;
  createdAt: string;
  teacher: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  shares: {
    id: string;
    studentId: string;
    teacherNote: string | null;
    sharedAt: string;
    isViewed: boolean;
    student: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
    course: {
      id: string;
      title: string;
      instrument: string;
    } | null;
  }[];
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
      return "Other Material";
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

export function AdminResourcesClient({
  initialResources,
  allStudents,
  isDriveReady = true,
}: {
  initialResources: AdminResourceItem[];
  allStudents: AllottedStudentOption[];
  isDriveReady?: boolean;
}) {
  const [resources, setResources] = useState<AdminResourceItem[]>(initialResources);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState<ResourceCategory>("SHEET_MUSIC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Share modal state
  const [sharingResource, setSharingResource] = useState<AdminResourceItem | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [shareNote, setShareNote] = useState("");
  const [shareStatus, setShareStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manage shares view state
  const [viewingSharesResource, setViewingSharesResource] = useState<AdminResourceItem | null>(null);

  // Delete confirmation state
  const [deletingResource, setDeletingResource] = useState<AdminResourceItem | null>(null);

  // Unique list of teachers who uploaded materials
  const uniqueTeachers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const res of resources) {
      if (res.teacher?.id) {
        map.set(res.teacher.id, {
          id: res.teacher.id,
          name: res.teacher.name || "Faculty Member",
        });
      }
    }
    return Array.from(map.values());
  }, [resources]);

  // Overall Statistics
  const totalBytes = useMemo(() => {
    return resources.reduce((acc, r) => acc + (r.fileSizeBytes || 0), 0);
  }, [resources]);

  const totalSharesCount = useMemo(() => {
    return resources.reduce((acc, r) => acc + r.shares.length, 0);
  }, [resources]);

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        res.title.toLowerCase().includes(q) ||
        res.fileName.toLowerCase().includes(q) ||
        (res.description && res.description.toLowerCase().includes(q)) ||
        (res.teacher.name && res.teacher.name.toLowerCase().includes(q));

      const matchesCat =
        selectedCategory === "ALL" || res.category === selectedCategory;

      const matchesTeacher =
        selectedTeacherId === "ALL" || res.teacher.id === selectedTeacherId;

      return matchesSearch && matchesCat && matchesTeacher;
    });
  }, [resources, searchQuery, selectedCategory, selectedTeacherId]);

  // Handle file drop/selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle) {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .trim();
        setUploadTitle(cleanName);
      }
    }
  };

  // Submit upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Please provide a title for this resource.");
      return;
    }

    setUploadError(null);
    const formData = new FormData();
    formData.append("title", uploadTitle.trim());
    formData.append("description", uploadDescription.trim());
    formData.append("category", uploadCategory);
    formData.append("file", selectedFile);

    startTransition(async () => {
      const res = await uploadResourceAction(formData);
      if (res.success && res.data) {
        showToast(`"${uploadTitle}" uploaded to Supabase repository.`);
        setIsUploadOpen(false);
        setUploadTitle("");
        setUploadDescription("");
        setSelectedFile(null);

        // Optimistically add to list
        const newResource: AdminResourceItem = {
          id: res.data.id,
          title: res.data.title,
          description: uploadDescription || null,
          category: uploadCategory,
          fileName: selectedFile.name,
          fileUrl: res.data.fileUrl,
          fileId: null,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type,
          createdAt: new Date().toISOString(),
          teacher: {
            id: "current-admin",
            name: "Academy Administration",
            email: "admin@gandharva.org",
            image: null,
          },
          shares: [],
        };
        setResources((prev) => [newResource, ...prev]);
      } else {
        setUploadError(res.error || "Failed to upload file.");
      }
    });
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deletingResource) return;
    const target = deletingResource;
    startTransition(async () => {
      const res = await deleteResourceAction(target.id);
      if (res.success) {
        setResources((prev) => prev.filter((r) => r.id !== target.id));
        showToast("Resource removed from academy repository.");
        setDeletingResource(null);
      } else {
        showToast(res.error || "Failed to delete resource.");
      }
    });
  };

  // Handle Share with Students
  const handleShareSubmit = async () => {
    if (!sharingResource || selectedStudentIds.length === 0) return;

    startTransition(async () => {
      const res = await shareResourceAction({
        resourceId: sharingResource.id,
        studentIds: selectedStudentIds,
        teacherNote: shareNote,
      });

      if (res.success) {
        showToast(`Resource distributed to ${selectedStudentIds.length} student(s).`);
        // Update local shares count
        setResources((prev) =>
          prev.map((r) => {
            if (r.id === sharingResource.id) {
              const newShares = selectedStudentIds.map((sid) => {
                const sObj = allStudents.find((s) => s.id === sid);
                return {
                  id: `share-${Date.now()}-${sid}`,
                  studentId: sid,
                  teacherNote: shareNote || null,
                  sharedAt: new Date().toISOString(),
                  isViewed: false,
                  student: {
                    id: sid,
                    name: sObj?.name || "Student",
                    email: sObj?.email || "",
                    image: sObj?.image || null,
                  },
                  course: null,
                };
              });
              // Filter out duplicate shares
              const existingIds = new Set(r.shares.map((s) => s.studentId));
              const mergedShares = [
                ...r.shares,
                ...newShares.filter((ns) => !existingIds.has(ns.studentId)),
              ];
              return { ...r, shares: mergedShares };
            }
            return r;
          })
        );
        setSharingResource(null);
        setSelectedStudentIds([]);
        setShareNote("");
      } else {
        setShareStatus({ type: "error", text: res.error || "Failed to share." });
      }
    });
  };

  // Handle Revoke Share
  const handleRevokeShare = async (resourceId: string, studentId: string) => {
    startTransition(async () => {
      const res = await unshareResourceAction(resourceId, studentId);
      if (res.success) {
        setResources((prev) =>
          prev.map((r) => {
            if (r.id === resourceId) {
              return {
                ...r,
                shares: r.shares.filter((s) => s.studentId !== studentId),
              };
            }
            return r;
          })
        );
        if (viewingSharesResource) {
          setViewingSharesResource((prev) =>
            prev
              ? {
                  ...prev,
                  shares: prev.shares.filter((s) => s.studentId !== studentId),
                }
              : null
          );
        }
        showToast("Student access revoked.");
      } else {
        showToast(res.error || "Failed to revoke access.");
      }
    });
  };

  const categories: Array<{ id: string; label: string }> = [
    { id: "ALL", label: "All Categories" },
    { id: "SHEET_MUSIC", label: "Sheet Music" },
    { id: "AUDIO_LESSON", label: "Audio Lessons" },
    { id: "EXERCISE", label: "Practice Exercises" },
    { id: "LESSON_NOTES", label: "Lesson Notes" },
    { id: "ASSIGNMENT", label: "Assignments" },
    { id: "REFERENCE", label: "Reference Guides" },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl shadow-lg border border-purple-200 bg-white text-heading text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. TOP BREADCRUMB & UTILITIES ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-body/70">
          <span className="font-medium">Operations</span>
          <span className="text-body/40">/</span>
          <span className="font-bold text-heading">Learning Resources Repository</span>
        </div>

        {/* Cloud Storage Status Pill */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold shadow-2xs ${
              isDriveReady
                ? "bg-emerald-50/90 text-emerald-800 border-emerald-200"
                : "bg-amber-50/90 text-amber-800 border-amber-200"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {isDriveReady
                ? "Google Drive Cloud Storage · Synced"
                : "Google Drive Storage · Local Fallback"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. MAIN HEADER & ACTIONS ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Learning Resources
          </h1>
          <p className="text-xs sm:text-sm text-body/70 mt-1">
            Central repository of sheet music, audio lessons, exercises, and study notes distributed across courses
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setUploadError(null);
              setIsUploadOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-white" />
            <span>Upload Resource</span>
          </button>
        </div>
      </div>

      {/* ─── 3. FOUR EXECUTIVE KPI METRIC CARDS ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Resources */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Academy Materials</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
            {resources.length}
          </div>
          <div className="text-[11px] text-body/60 font-medium mt-0.5">
            Total files stored ({formatBytes(totalBytes)})
          </div>
        </div>

        {/* Card 2: Faculty Contributors */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Faculty Authors</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
            {uniqueTeachers.length}
          </div>
          <div className="text-[11px] text-body/60 font-medium mt-0.5">
            Active contributing instructors
          </div>
        </div>

        {/* Card 3: Distributed to Students */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Student Deliveries</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
            {totalSharesCount}
          </div>
          <div className="text-[11px] text-body/60 font-medium mt-0.5">
            Total student share instances
          </div>
        </div>

        {/* Card 4: Google Drive Status */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Cloud Vault</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
            {isDriveReady ? "Active" : "Standby"}
          </div>
          <div className="text-[11px] text-body/60 font-medium mt-0.5">
            25 MB limit · encrypted streaming
          </div>
        </div>
      </div>

      {/* ─── 4. SEARCH, FILTERS & CATEGORIES ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-body/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resources by title, file name, teacher, or description..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-50/70 hover:bg-neutral-50 focus:bg-white border border-neutral-200 focus:border-[#3C096C] focus:ring-1 focus:ring-[#3C096C] text-xs text-heading placeholder:text-body/40 outline-none transition-all"
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

          {/* Teacher Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-body/70 shrink-0">Instructor:</label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-medium text-heading focus:border-[#3C096C] outline-none transition-all"
            >
              <option value="ALL">All Instructors ({uniqueTeachers.length})</option>
              {uniqueTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            const count =
              cat.id === "ALL"
                ? resources.length
                : resources.filter((r) => r.category === cat.id).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? "bg-[#3C096C] text-white shadow-2xs font-bold"
                    : "bg-neutral-50 hover:bg-neutral-100 text-body/70 border border-neutral-200/70"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    active ? "bg-white/20 text-white" : "bg-neutral-200 text-body"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 5. RESOURCES GRID ─────────────────────────────────────────── */}
      {filteredResources.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-lg font-bold text-heading">
            No learning resources found
          </h3>
          <p className="text-xs text-body/60 max-w-sm">
            {searchQuery || selectedCategory !== "ALL" || selectedTeacherId !== "ALL"
              ? "Try adjusting your search terms or category filters to find matching materials."
              : "Upload sheet music, exercises, or audio lessons to build your academy's learning library."}
          </p>
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3C096C] text-white text-xs font-bold shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Upload first resource</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredResources.map((res) => {
            const ext = res.fileName.split(".").pop()?.toUpperCase() || "FILE";
            const dateStr = new Date(res.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={res.id}
                className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-all p-5 flex flex-col justify-between space-y-4 group"
              >
                {/* Header & Badges */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                        {getFileIcon(res.fileName, res.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-heading truncate group-hover:text-[#3C096C] transition-colors" title={res.title}>
                          {res.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-body/60 mt-0.5">
                          <span className="font-mono uppercase font-bold text-purple-900 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-100">
                            {ext}
                          </span>
                          <span>·</span>
                          <span>{formatBytes(res.fileSizeBytes)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Category Tag */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getCategoryColor(
                        res.category
                      )}`}
                    >
                      {getCategoryLabel(res.category)}
                    </span>
                  </div>

                  {/* Description if present */}
                  {res.description && (
                    <p className="text-xs text-body/70 line-clamp-2 leading-relaxed">
                      {res.description}
                    </p>
                  )}

                  {/* Teacher & Metadata Pill */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-body/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-[#3C096C]/10 text-[#3C096C] font-bold text-[9px] flex items-center justify-center shrink-0">
                        {res.teacher.name?.[0] || "F"}
                      </div>
                      <span className="truncate text-[11px] font-medium text-heading">
                        {res.teacher.name || "Faculty Member"}
                      </span>
                    </div>
                    <span className="text-[11px] text-body/50 shrink-0 font-numeric">{dateStr}</span>
                  </div>
                </div>

                {/* Footer Distribution & Action Buttons */}
                <div className="space-y-3 pt-3 border-t border-neutral-100">
                  {/* Share Distribution Status */}
                  <div className="flex items-center justify-between text-xs">
                    {res.shares.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setViewingSharesResource(res)}
                        className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 text-[11px] font-bold transition-colors group/btn"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Shared with {res.shares.length} student{res.shares.length === 1 ? "" : "s"}</span>
                        <Eye className="w-3 h-3 opacity-60 group-hover/btn:opacity-100" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-body/40 font-medium">
                        Not distributed yet
                      </span>
                    )}

                    {/* Direct View in Google Drive */}
                    {res.fileUrl && (
                      <a
                        href={res.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3C096C] hover:text-[#2F0755] hover:underline"
                      >
                        <span>View File</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Action Buttons Row */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSharingResource(res);
                        setSelectedStudentIds(res.shares.map((s) => s.studentId));
                        setShareNote("");
                        setShareStatus(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 hover:bg-purple-50 text-[#3C096C] text-xs font-bold transition-all active:scale-95 shadow-2xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Distribute</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingResource(res)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-body/70 text-xs font-medium transition-all active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: UPLOAD LEARNING RESOURCE MODAL ────────────────────── */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-bold text-heading">
                  Upload Learning Resource
                </h3>
                <p className="text-xs text-body/70 mt-0.5">
                  Direct upload to Gandharva Supabase cloud vault (up to 25 MB)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-body flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 sm:p-6 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* File Drop/Pick Zone */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1.5">
                  Choose File <span className="text-rose-500">*</span>
                </label>
                <div className="border-2 border-dashed border-purple-200 hover:border-[#3C096C] rounded-2xl p-6 text-center transition-colors bg-purple-50/20 cursor-pointer relative">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.mp3,.wav,.m4a,.ogg,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.zip,.mp4"
                  />
                  <div className="flex flex-col items-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-[#3C096C] flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    {selectedFile ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-[#3C096C]">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-body/60">
                          {formatBytes(selectedFile.size)} · ready for upload
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-heading">
                          Click or drag and drop file here
                        </p>
                        <p className="text-[11px] text-body/50">
                          PDF, MP3, WAV, DOC, DOCX, ZIP, or video up to 25 MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resource Title */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Raag Yaman - Sthayi & Antara Notation"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:border-[#3C096C] focus:ring-1 focus:ring-[#3C096C] text-xs text-heading outline-none"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as ResourceCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:border-[#3C096C] focus:ring-1 focus:ring-[#3C096C] text-xs text-heading outline-none bg-white"
                >
                  <option value="SHEET_MUSIC">Sheet Music & Notation</option>
                  <option value="AUDIO_LESSON">Audio Lesson & Tanpura Track</option>
                  <option value="EXERCISE">Practice Exercise</option>
                  <option value="LESSON_NOTES">Lesson Notes & Theory</option>
                  <option value="ASSIGNMENT">Homework / Assignment</option>
                  <option value="REFERENCE">Reference Guide</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Instructions / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Notes for students or faculty regarding tempo, fingering, or homework..."
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 focus:border-[#3C096C] focus:ring-1 focus:ring-[#3C096C] text-xs text-heading outline-none resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-body hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedFile}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 active:scale-95"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Save</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: DISTRIBUTE / SHARE WITH STUDENTS MODAL ───────────── */}
      {sharingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-bold text-heading">
                  Distribute Material
                </h3>
                <p className="text-xs text-body/70 mt-0.5">
                  Send &ldquo;{sharingResource.title}&rdquo; to student vaults
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSharingResource(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-body flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {shareStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    shareStatus.type === "error"
                      ? "bg-rose-50 border border-rose-200 text-rose-700"
                      : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  }`}
                >
                  {shareStatus.type === "error" ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{shareStatus.text}</span>
                </div>
              )}

              {/* Student Selection Toolbar */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-heading">
                  Select Students ({selectedStudentIds.length} chosen)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedStudentIds.length === allStudents.length) {
                      setSelectedStudentIds([]);
                    } else {
                      setSelectedStudentIds(allStudents.map((s) => s.id));
                    }
                  }}
                  className="text-xs font-bold text-[#3C096C] hover:underline"
                >
                  {selectedStudentIds.length === allStudents.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              {/* Students Checkbox List */}
              <div className="border border-neutral-200 rounded-2xl divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                {allStudents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-body/50">
                    No enrolled students found in academy.
                  </div>
                ) : (
                  allStudents.map((st) => {
                    const isChecked = selectedStudentIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-neutral-50/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds((prev) => [...prev, st.id]);
                              } else {
                                setSelectedStudentIds((prev) =>
                                  prev.filter((id) => id !== st.id)
                                );
                              }
                            }}
                            className="rounded text-[#3C096C] focus:ring-[#3C096C] h-4 w-4"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-heading truncate">
                              {st.name}
                            </p>
                            <p className="text-[11px] text-body/60 truncate">
                              {st.courseTitle || st.email}
                            </p>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                            Selected
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Optional Maestro Note */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Maestro Message / Note (Included in student notification)
                </label>
                <textarea
                  rows={2}
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="e.g. Please practice Page 2 for upcoming Saturday 1-on-1 session..."
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 focus:border-[#3C096C] focus:ring-1 focus:ring-[#3C096C] text-xs text-heading outline-none resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-neutral-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSharingResource(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-body hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleShareSubmit}
                disabled={isPending || selectedStudentIds.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 active:scale-95"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Distributing...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Send to {selectedStudentIds.length} Student(s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: VIEW & MANAGE SHARES INSPECTOR ────────────────────── */}
      {viewingSharesResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-bold text-heading">
                  Active Student Distributions
                </h3>
                <p className="text-xs text-body/70 mt-0.5">
                  &ldquo;{viewingSharesResource.title}&rdquo; ({viewingSharesResource.shares.length} students)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSharesResource(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-body flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-3 flex-1">
              {viewingSharesResource.shares.length === 0 ? (
                <div className="p-6 text-center text-xs text-body/50">
                  No active distributions for this resource.
                </div>
              ) : (
                viewingSharesResource.shares.map((share) => (
                  <div
                    key={share.id}
                    className="p-3.5 rounded-2xl bg-neutral-50/70 border border-neutral-200/70 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-heading truncate">
                          {share.student.name || "Enrolled Student"}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                            share.isViewed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {share.isViewed ? "Viewed" : "Unopened"}
                        </span>
                      </div>
                      <p className="text-[11px] text-body/60 truncate mt-0.5">
                        {share.student.email} · shared{" "}
                        {new Date(share.sharedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                      {share.teacherNote && (
                        <p className="text-[11px] text-[#3C096C] italic mt-1 line-clamp-1">
                          &ldquo;{share.teacherNote}&rdquo;
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRevokeShare(viewingSharesResource.id, share.studentId)
                      }
                      disabled={isPending}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-[11px] font-semibold transition-colors shrink-0"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-[11px] text-body/60">
                Revoking access removes file view privileges immediately.
              </span>
              <button
                type="button"
                onClick={() => setViewingSharesResource(null)}
                className="px-4 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-heading text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: DELETE CONFIRMATION MODAL ─────────────────────────── */}
      {deletingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-heading">
                Delete Learning Material?
              </h3>
              <p className="text-xs text-body/70 mt-1 leading-relaxed">
                Are you sure you want to delete &ldquo;{deletingResource.title}&rdquo;?
                This will permanently remove the file from Supabase and revoke access for all {deletingResource.shares.length} student(s).
              </p>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingResource(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-body hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {isPending ? "Removing..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
