"use client";

import { useState, useTransition, useMemo } from "react";
import Image from "next/image";
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
  Info,
  Calendar,
  Layers,
} from "lucide-react";
import {
  uploadResourceAction,
  deleteResourceAction,
  shareResourceAction,
  unshareResourceAction,
  AllottedStudentOption,
} from "@/actions/resources";
import { ResourceCategory } from "@prisma/client";

export type TeacherResourceItem = {
  id: string;
  title: string;
  description: string | null;
  category: ResourceCategory;
  fileName: string;
  fileUrl: string;
  fileId: string | null;
  fileSizeBytes: number;
  mimeType: string | null;
  createdAt: Date | string;
  shares: {
    id: string;
    studentId: string;
    teacherNote: string | null;
    sharedAt: Date | string;
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

export function TeacherResourcesClient({
  initialResources,
  allottedStudents,
  isDriveReady = true,
}: {
  initialResources: TeacherResourceItem[];
  allottedStudents: AllottedStudentOption[];
  isDriveReady?: boolean;
}) {
  const [resources, setResources] = useState<TeacherResourceItem[]>(initialResources);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState<ResourceCategory>("SHEET_MUSIC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Share modal state
  const [sharingResource, setSharingResource] = useState<TeacherResourceItem | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [shareNote, setShareNote] = useState("");
  const [shareStatus, setShareStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manage shares view state
  const [viewingSharesResource, setViewingSharesResource] = useState<TeacherResourceItem | null>(null);

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchesSearch =
        res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        res.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (res.description && res.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === "ALL" || res.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [resources, searchQuery, selectedCategory]);

  // Handle file drop/selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle) {
        // Auto-generate a readable title from file name
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
      setUploadError("Please provide a title for this material.");
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
      if (!res.success) {
        setUploadError(res.error || "Upload failed. Please check file size and credentials.");
      } else {
        // Create local item representation
        const newResource: TeacherResourceItem = {
          id: res.data?.id || Math.random().toString(),
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || null,
          category: uploadCategory,
          fileName: selectedFile.name,
          fileUrl: res.data?.fileUrl || "",
          fileId: null,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type,
          createdAt: new Date().toISOString(),
          shares: [],
        };
        setResources((prev) => [newResource, ...prev]);
        setIsUploadOpen(false);
        setUploadTitle("");
        setUploadDescription("");
        setSelectedFile(null);
      }
    });
  };

  // Delete resource
  const handleDelete = (resourceId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will also revoke student access.`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteResourceAction(resourceId);
      if (res.success) {
        setResources((prev) => prev.filter((r) => r.id !== resourceId));
        if (viewingSharesResource?.id === resourceId) setViewingSharesResource(null);
        if (sharingResource?.id === resourceId) setSharingResource(null);
      } else {
        alert(res.error || "Could not delete resource.");
      }
    });
  };

  // Open share modal
  const openShareModal = (resource: TeacherResourceItem) => {
    setSharingResource(resource);
    // Pre-populate already shared student IDs
    const alreadyShared = resource.shares.map((s) => s.studentId);
    setSelectedStudentIds(alreadyShared);
    setShareNote("");
    setShareStatus(null);
  };

  // Toggle student selection
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Select all allotted students
  const selectAllStudents = () => {
    if (selectedStudentIds.length === allottedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(allottedStudents.map((s) => s.id));
    }
  };

  // Send resource to selected students
  const handleSendResource = async () => {
    if (!sharingResource) return;
    if (selectedStudentIds.length === 0) {
      setShareStatus({ type: "error", text: "Please select at least one student." });
      return;
    }

    startTransition(async () => {
      const res = await shareResourceAction({
        resourceId: sharingResource.id,
        studentIds: selectedStudentIds,
        teacherNote: shareNote.trim() || undefined,
      });

      if (!res.success) {
        setShareStatus({ type: "error", text: res.error || "Failed to share material." });
      } else {
        setShareStatus({ type: "success", text: res.message || "Material sent successfully!" });

        // Update local state with new shares
        setResources((prev) =>
          prev.map((r) => {
            if (r.id !== sharingResource.id) return r;
            const updatedShares = selectedStudentIds.map((sId) => {
              const studentObj = allottedStudents.find((s) => s.id === sId);
              return {
                id: Math.random().toString(),
                studentId: sId,
                teacherNote: shareNote.trim() || null,
                sharedAt: new Date().toISOString(),
                isViewed: false,
                student: {
                  id: sId,
                  name: studentObj?.name || "Student",
                  email: studentObj?.email || "",
                  image: studentObj?.image || null,
                },
                course: studentObj?.courseId
                  ? {
                      id: studentObj.courseId,
                      title: studentObj.courseTitle || "Course",
                      instrument: studentObj.instrument || "Music",
                    }
                  : null,
              };
            });
            return { ...r, shares: updatedShares };
          })
        );

        setTimeout(() => {
          setSharingResource(null);
        }, 1200);
      }
    });
  };

  // Revoke student access
  const handleUnshare = async (resourceId: string, studentId: string) => {
    startTransition(async () => {
      const res = await unshareResourceAction(resourceId, studentId);
      if (res.success) {
        setResources((prev) =>
          prev.map((r) => {
            if (r.id !== resourceId) return r;
            return {
              ...r,
              shares: r.shares.filter((s) => s.studentId !== studentId),
            };
          })
        );
        if (viewingSharesResource?.id === resourceId) {
          setViewingSharesResource((prev) =>
            prev
              ? {
                  ...prev,
                  shares: prev.shares.filter((s) => s.studentId !== studentId),
                }
              : null
          );
        }
      }
    });
  };

  // Metrics summary
  const totalUploads = resources.length;
  const totalSharesSent = resources.reduce((acc, r) => acc + r.shares.length, 0);

  return (
    <div className="space-y-8">
      {/* ─── Hero / Header ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-border-default bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-accent-dark font-sans">
              Gandharva Teacher Studio
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-subtle text-primary border border-primary/20">
              <HardDrive className="w-3 h-3" />
              Supabase Cloud Storage
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-1">
            Learning Resources & Studio Materials
          </h1>
          <p className="text-xs sm:text-sm text-body mt-1.5 max-w-2xl leading-relaxed">
            Upload sheet music, reference audio, and practice exercises to your Supabase library. Instantly share materials with your course-allotted students.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            setIsUploadOpen(true);
            setUploadError(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-md shadow-primary/20 transition-all btn-tactile cursor-pointer shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Material</span>
        </button>
      </div>

      {/* Google Drive Setup Warning Banner (if not yet configured) */}
      {!isDriveReady && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/60 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-800" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">
                Storage Not Configured
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed max-w-2xl">
                An administrator must set the Google Drive folder link in{" "}
                <a href="/admin/settings" className="font-bold underline hover:text-amber-950">
                  Admin Platform Settings
                </a>{" "}
                or set <code className="px-1 py-0.5 bg-amber-200/60 rounded font-mono text-[10px]">GOOGLE_DRIVE_FOLDER_ID</code> in environment variables before files can be stored.
              </p>
            </div>
          </div>
          <a
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 text-white transition-all btn-tactile shrink-0 whitespace-nowrap"
          >
            <span>Platform Settings</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-body-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Total Materials</span>
            <div className="w-8 h-8 rounded-xl bg-primary-subtle text-primary flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-serif text-heading mt-2">{totalUploads}</p>
          <p className="text-[11px] text-body-muted mt-0.5">Uploaded to Supabase</p>
        </div>

        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-body-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Materials Sent</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-serif text-heading mt-2">{totalSharesSent}</p>
          <p className="text-[11px] text-body-muted mt-0.5">Shared with enrolled students</p>
        </div>

        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-body-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Allotted Students</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-serif text-heading mt-2">{allottedStudents.length}</p>
          <p className="text-[11px] text-body-muted mt-0.5">Eligible for instant resource sharing</p>
        </div>
      </div>

      {/* ─── Search & Category Filters ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-border-default shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, filename, or notes..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-border-default bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 text-heading placeholder:text-body-muted"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: "ALL", label: "All" },
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

      {/* ─── Resources Grid ─────────────────────────────────────────────────── */}
      {filteredResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-border-default text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center mb-3">
            <Upload className="w-7 h-7 opacity-75" />
          </div>
          <h3 className="text-base font-serif font-bold text-heading">
            {searchQuery || selectedCategory !== "ALL"
              ? "No matching materials found"
              : "No learning materials uploaded yet"}
          </h3>
          <p className="text-xs text-body-muted mt-1 max-w-sm">
            {searchQuery || selectedCategory !== "ALL"
              ? "Try adjusting your search terms or category filter."
              : "Upload classical sheet music, vocal warm-up MP3s, or practice notes to share with your students."}
          </p>
          {!(searchQuery || selectedCategory !== "ALL") && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white px-4 py-2 text-xs font-bold shadow-sm transition-all btn-tactile cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Your First Resource</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map((item) => {
            const catBadgeClass = getCategoryColor(item.category);
            const sharesCount = item.shares.length;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border-default bg-white p-5 shadow-xs hover:shadow-md transition-all hover:border-primary/30"
              >
                <div>
                  {/* Top line: Category & File format */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${catBadgeClass}`}
                    >
                      {getCategoryLabel(item.category)}
                    </span>
                    <span className="text-[10px] text-body-muted font-medium">
                      {formatBytes(item.fileSizeBytes)}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-3 mt-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-alt/40 border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                      {getFileIcon(item.fileName, item.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif font-bold text-sm text-heading truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-body-muted truncate mt-0.5">
                        {item.fileName}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs text-body leading-relaxed line-clamp-2 mt-2.5 bg-bg-alt/15 p-2 rounded-lg border border-border-subtle/50">
                      {item.description}
                    </p>
                  )}

                  {/* Share status pill */}
                  <div className="mt-3.5 flex items-center justify-between text-xs">
                    {sharesCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setViewingSharesResource(item)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Users className="w-3 h-3" />
                        <span>Sent to {sharesCount} student{sharesCount === 1 ? "" : "s"}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-body-muted italic">
                        Not sent to students yet
                      </span>
                    )}

                    <span className="text-[10px] text-body-muted">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-5 pt-3.5 border-t border-border-default/60 flex items-center justify-between gap-2">
                  {/* Google Drive Link */}
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                  >
                    <span>Open File</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openShareModal(item)}
                      title="Send to course allotted students"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-cta/10 text-cta hover:bg-cta hover:text-white transition-all btn-tactile cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.title)}
                      title="Delete material"
                      className="p-1.5 rounded-lg text-body-muted hover:text-rose-600 hover:bg-rose-50 transition-colors btn-tactile cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal 1: Upload New Resource ──────────────────────────────────── */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-border-default overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border-default">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-subtle text-primary flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-heading">
                    Upload Learning Resource
                  </h3>
                  <p className="text-[11px] text-body-muted">
                    Stored securely on Supabase Cloud
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1 rounded-lg text-body-muted hover:text-heading hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {!isDriveReady && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Storage Status
                </p>
                <p className="leading-relaxed">
                  Before files can be stored, an administrator must set the folder link in{" "}
                  <a href="/admin/settings" target="_blank" className="font-bold underline text-amber-900">
                    Platform Settings
                  </a>{" "}
                  or set <code className="px-1 py-0.5 bg-amber-200/60 rounded font-mono text-[10px]">GOOGLE_DRIVE_FOLDER_ID</code> in environment variables.
                </p>
              </div>
            )}

            {/* Upload Form */}
            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1.5">
                  Select File (Max 25MB)
                </label>
                <div className="relative rounded-2xl border-2 border-dashed border-border-default hover:border-primary/50 bg-bg-alt/10 hover:bg-bg-alt/25 transition-colors p-5 text-center cursor-pointer">
                  <input
                    type="file"
                    required
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-border-subtle flex items-center justify-center text-primary mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    {selectedFile ? (
                      <div>
                        <p className="text-xs font-bold text-heading truncate max-w-xs">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-body-muted mt-0.5">
                          {formatBytes(selectedFile.size)} • Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-heading">
                          Drop file here or click to browse
                        </p>
                        <p className="text-[10px] text-body-muted mt-0.5">
                          PDF sheet music, MP3/WAV audio, DOCX notes, MP4, etc.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Raag Yaman Alap & Bandish Sheet"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border-default bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 text-heading"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as ResourceCategory)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border-default bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 text-heading"
                >
                  <option value="SHEET_MUSIC">Sheet Music / Notation</option>
                  <option value="AUDIO_LESSON">Audio Lesson / Track</option>
                  <option value="LESSON_NOTES">Lesson Notes / PDF</option>
                  <option value="EXERCISE">Practice Exercise</option>
                  <option value="ASSIGNMENT">Homework / Assignment</option>
                  <option value="REFERENCE">Reference Guide</option>
                  <option value="OTHER">Other Material</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Description / Practice Guidance (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Instructions for students when practicing with this material..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border-default bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 text-heading resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-body hover:text-heading hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedFile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover active:scale-95 text-white shadow-md disabled:opacity-50 transition-all btn-tactile cursor-pointer"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isPending ? "Uploading to Supabase..." : "Upload & Save"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Send Resource to Allotted Students ──────────────────── */}
      {sharingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-border-default overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border-default">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cta/15 text-cta flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-heading truncate max-w-xs">
                    Send to Students
                  </h3>
                  <p className="text-[11px] text-body-muted truncate max-w-xs">
                    Material: &ldquo;{sharingResource.title}&rdquo;
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSharingResource(null)}
                className="p-1 rounded-lg text-body-muted hover:text-heading hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shareStatus && (
              <div
                className={`mt-4 p-3 rounded-xl text-xs flex items-start gap-2 ${
                  shareStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {shareStatus.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span>{shareStatus.text}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* Student list selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-heading">
                    Select Course-Allotted Students ({selectedStudentIds.length}/{allottedStudents.length})
                  </label>
                  {allottedStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllStudents}
                      className="text-[11px] text-primary hover:text-primary-hover font-semibold transition-colors cursor-pointer"
                    >
                      {selectedStudentIds.length === allottedStudents.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>

                {allottedStudents.length === 0 ? (
                  <div className="p-4 rounded-xl bg-bg-alt/30 border border-border-default text-center text-xs text-body-muted">
                    No course-allotted students found. Students enrolled in your courses will appear here automatically.
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto divide-y divide-border-subtle rounded-xl border border-border-default bg-bg p-1">
                    {allottedStudents.map((student) => {
                      const isSelected = selectedStudentIds.includes(student.id);

                      return (
                        <div
                          key={student.id}
                          onClick={() => toggleStudentSelection(student.id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary-subtle/50 text-heading"
                              : "hover:bg-neutral-100 text-body"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-accent/20 text-accent-dark font-bold text-xs flex items-center justify-center shrink-0">
                              {student.name?.slice(0, 1).toUpperCase() || "S"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-heading truncate">
                                {student.name}
                              </p>
                              <p className="text-[10px] text-body-muted truncate">
                                {student.courseTitle || "Music Student"}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-primary border-primary text-white"
                                : "border-border-default bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Maestro Note */}
              <div>
                <label className="block text-xs font-semibold text-heading mb-1">
                  Maestro&apos;s Advice / Practice Instructions
                </label>
                <textarea
                  rows={2}
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="e.g. Please practice the first 16 bars with metronome before our next session..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border-default bg-bg focus:outline-none focus:ring-2 focus:ring-primary/20 text-heading resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSharingResource(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-body hover:text-heading hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendResource}
                  disabled={isPending || selectedStudentIds.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cta hover:bg-cta-hover active:scale-95 text-white shadow-md disabled:opacity-50 transition-all btn-tactile cursor-pointer"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isPending ? "Sending..." : "Send Resource"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 3: View & Manage Shared Students ─────────────────────────── */}
      {viewingSharesResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <h3 className="font-serif font-bold text-base text-heading">
                  Students with Access
                </h3>
                <p className="text-[11px] text-body-muted truncate max-w-xs">
                  {viewingSharesResource.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSharesResource(null)}
                className="p-1 rounded-lg text-body-muted hover:text-heading hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 max-h-60 overflow-y-auto divide-y divide-border-subtle">
              {viewingSharesResource.shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between py-2.5 px-1"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {share.student.name?.slice(0, 1).toUpperCase() || "S"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-heading truncate">
                        {share.student.name || "Student"}
                      </p>
                      <p className="text-[10px] text-body-muted truncate">
                        {share.course?.title || share.student.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnshare(viewingSharesResource.id, share.studentId)}
                    title="Revoke access"
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border-default flex justify-end">
              <button
                type="button"
                onClick={() => setViewingSharesResource(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-heading transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
