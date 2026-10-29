"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { TeacherApprovalStatus } from "@prisma/client";
import { updateTeacherApprovalAction, markLessonPayoutAction } from "@/actions/admin";
import {
  Globe,
  Upload,
  UserPlus,
  Search,
  ChevronRight,
  ChevronDown,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart2,
  FileText,
  IndianRupee,
  Sparkles,
  X,
  CreditCard,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  UserCheck,
  BookOpen,
  Music,
  ExternalLink,
  Shield,
  Award,
  SlidersHorizontal,
  FileCheck,
  Send,
  Eye,
  EyeOff,
  Edit3,
  Download,
  MessageSquare,
  Users,
  Check,
  Receipt,
  Play,
  FolderArchive,
  RefreshCw,
  Video,
} from "lucide-react";

export interface TeacherRecord {
  id: string; // TeacherProfile id (or user id fallback)
  userId: string;
  customId?: string | null;
  name: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  image: string | null;
  timezone: string;
  country: string | null;
  createdAt: string;
  isActive: boolean;
  bio: string;
  instruments: string[];
  expertInstruments: string[];
  moderateInstruments: string[];
  languages: string[];
  yearsTeaching: number;
  hourlyRate: number; // paise
  payoutPerSession: number; // paise (e.g. 80000 = ₹800)
  upiId: string | null;
  isPublished: boolean;
  approvalStatus: TeacherApprovalStatus; // PENDING, APPROVED, REJECTED
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  lessons: {
    id: string;
    instrument: string;
    startsAt: string;
    durationMinutes: number;
    status: string;
    studentId: string | null;
    studentName: string | null;
    studentEmail: string | null;
    studentPhone: string | null;
    trackingCode: string | null;
    recordingUrl: string | null;
    payoutStatus: string;
    payoutAmountMinor?: number | null;
    payoutPaidAt?: string | null;
    payoutTransactionId?: string | null;
    payoutNotes?: string | null;
  }[];
  allottedStudents: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    enrolledCourseTitle: string | null;
    instrument: string | null;
    courseLevel: string | null;
    sessionsRemaining: number;
    totalSessions: number;
    enrollmentStatus: string;
    startedAt: string | null;
    completedLessonsCount: number;
    upcomingLessonsCount: number;
  }[];
  courses: {
    id: string;
    title: string;
    instrument: string;
    level: string;
    sessionCount: number;
    syllabusSummary?: string | null;
    priceMinorUnits?: number | null;
  }[];
  resources: {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    fileName?: string | null;
    fileUrl: string;
    fileSizeBytes?: number | null;
    createdAt: string;
  }[];
  trials: {
    id: string;
    instrument: string;
    status: string;
    startsAt: string;
    isConverted: boolean;
  }[];
  conversations: {
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentPhone: string | null;
    instrument: string | null;
    isActive: boolean;
    updatedAt: string;
    messages: {
      id: string;
      senderId: string;
      senderName: string;
      senderRole: string;
      messageType: string;
      body: string | null;
      fileName: string | null;
      fileUrl: string | null;
      fileSizeBytes: number | null;
      isRead: boolean;
      createdAt: string;
    }[];
  }[];
  availabilitySlotsCount: number;
}

interface AdminTeachersManagerProps {
  initialTeachers: TeacherRecord[];
}

export function AdminTeachersManager({ initialTeachers }: AdminTeachersManagerProps) {
  const [teachers, setTeachers] = useState<TeacherRecord[]>(initialTeachers);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    initialTeachers[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TeacherApprovalStatus>("ALL");
  const [activeTab, setActiveTab] = useState<
    | "OVERVIEW"
    | "CLASSES"
    | "STUDENTS"
    | "RESOURCES"
    | "PAYOUTS"
    | "DOSSIER"
    | "CHAT_LOGS"
  >("OVERVIEW");

  // Tab interactive sub-filters & state
  const [selectedPreviewConvId, setSelectedPreviewConvId] = useState<string | null>(null);
  const [classSubFilter, setClassSubFilter] = useState<"ALL" | "UPCOMING" | "PAST">("ALL");
  const [payoutSubFilter, setPayoutSubFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState<string>("ALL");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");

  // Modals & Drawers
  const [isReviewApplicationOpen, setIsReviewApplicationOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [inlinePayoutInput, setInlinePayoutInput] = useState<number>(800);
  const [adminNotesInput, setAdminNotesInput] = useState<string>("");

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedTeacher =
    teachers.find((t) => t.id === selectedTeacherId) || teachers[0];

  const [upcomingSortOrder, setUpcomingSortOrder] = useState<"NEXT_FIRST" | "FURTHEST_FIRST">("NEXT_FIRST");

  // Upcoming classes: status SCHEDULED, ordered with next upcoming class first (startsAt ascending)
  const teacherUpcomingLessons = useMemo(() => {
    if (!selectedTeacher) return [];
    return [...selectedTeacher.lessons]
      .filter((l) => l.status === "SCHEDULED" || new Date(l.startsAt) >= new Date())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [selectedTeacher]);

  // Past lessons: status COMPLETED/CANCELLED, ordered with most recent completed first (startsAt descending)
  const teacherPastLessons = useMemo(() => {
    if (!selectedTeacher) return [];
    return [...selectedTeacher.lessons]
      .filter((l) => l.status !== "SCHEDULED" && new Date(l.startsAt) < new Date())
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [selectedTeacher]);

  // Combined for Overview: upcoming classes shown first (latest/next upcoming first), followed by recent past classes
  const upcomingAndRecentLessons = useMemo(() => {
    if (!selectedTeacher) return [];
    return [...teacherUpcomingLessons, ...teacherPastLessons].slice(0, 5);
  }, [teacherUpcomingLessons, teacherPastLessons]);

  const displayedUpcomingLessons = useMemo(() => {
    if (upcomingSortOrder === "NEXT_FIRST") {
      return teacherUpcomingLessons;
    }
    return [...teacherUpcomingLessons].reverse();
  }, [teacherUpcomingLessons, upcomingSortOrder]);

  useEffect(() => {
    if (selectedTeacher) {
      setInlinePayoutInput(Math.round(selectedTeacher.payoutPerSession / 100));
      setAdminNotesInput(selectedTeacher.adminNotes || "");
      setSelectedPreviewConvId(null);
    }
  }, [selectedTeacherId]);

  // Chat log download functions
  const handleDownloadSingleChatLog = (conv: TeacherRecord["conversations"][0]) => {
    if (!selectedTeacher) return;
    const header = `================================================================================
GANDHARVA SCHOOL OF MUSIC - OFFICIAL FACULTY-STUDENT CHAT AUDIT LOG
================================================================================
Faculty Maestro: ${selectedTeacher.name} (${selectedTeacher.email})
Student: ${conv.studentName} (${conv.studentEmail})
Discipline / Instrument: ${conv.instrument || "General Music & Core Lessons"}
Generated At: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST
Total Messages Recorded: ${conv.messages.length}
================================================================================\n\n`;

    let content = header;
    if (conv.messages.length === 0) {
      content += "No messages recorded in this conversation.\n";
    } else {
      conv.messages.forEach((m, idx) => {
        const timeStr = new Date(m.createdAt).toLocaleString("en-GB", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const attachment = m.fileName
          ? `\n[Attachment: ${m.fileName}${
              m.fileSizeBytes ? ` (${(m.fileSizeBytes / 1024).toFixed(0)} KB)` : ""
            }${m.fileUrl ? ` - Link: ${m.fileUrl}` : ""}]`
          : "";
        content += `[${idx + 1}] [${timeStr} IST] ${m.senderName} (${m.senderRole}):\n${m.body || ""}${attachment}\n\n`;
      });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTeacher = selectedTeacher.name.replace(/[^a-zA-Z0-9]/g, "_");
    const safeStudent = conv.studentName.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Chat_Log_${safeTeacher}_${safeStudent}_${dateStamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded chat log with ${conv.studentName}`);
  };

  const handleDownloadAllChatLogs = () => {
    if (!selectedTeacher) return;
    const convs = selectedTeacher.conversations || [];
    let content = `================================================================================
GANDHARVA SCHOOL OF MUSIC - COMPLETE FACULTY CHAT ARCHIVE
================================================================================
Faculty Maestro: ${selectedTeacher.name} (${selectedTeacher.email})
Phone: ${selectedTeacher.phone || "Not provided"}
Disciplines: ${selectedTeacher.instruments.join(", ") || "General"}
Total Student Conversations: ${convs.length}
Export Timestamp: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST
================================================================================\n\n`;

    if (convs.length === 0) {
      content += "No chat conversations recorded between this faculty member and any student.\n";
    } else {
      convs.forEach((c, cIdx) => {
        content += `\n--------------------------------------------------------------------------------\n`;
        content += `CONVERSATION #${cIdx + 1}: Student ${c.studentName} (${c.studentEmail})\n`;
        content += `Discipline / Instrument: ${c.instrument || "General"}\n`;
        content += `Recorded Messages: ${c.messages.length} | Last Updated: ${new Date(c.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST\n`;
        content += `--------------------------------------------------------------------------------\n\n`;

        if (c.messages.length === 0) {
          content += "No messages recorded in this conversation.\n\n";
        } else {
          c.messages.forEach((m, mIdx) => {
            const timeStr = new Date(m.createdAt).toLocaleString("en-GB", {
              timeZone: "Asia/Kolkata",
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const attachment = m.fileName
              ? `\n[Attachment: ${m.fileName}${
                  m.fileSizeBytes ? ` (${(m.fileSizeBytes / 1024).toFixed(0)} KB)` : ""
                }${m.fileUrl ? ` - Link: ${m.fileUrl}` : ""}]`
              : "";
            content += `[${mIdx + 1}] [${timeStr} IST] ${m.senderName} (${m.senderRole}):\n${m.body || ""}${attachment}\n\n`;
          });
        }
      });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTeacher = selectedTeacher.name.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Chat_Archive_All_Students_${safeTeacher}_${dateStamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded complete chat archive for ${selectedTeacher.name}`);
  };

  const handleMarkLessonPayout = (lessonId: string, currentStatus: string) => {
    const newStatus = currentStatus === "PAID" ? "UNPAID" : "PAID";
    startTransition(async () => {
      const res = await markLessonPayoutAction({
        lessonId,
        status: newStatus,
      });
      if (res.success) {
        setTeachers((prev) =>
          prev.map((t) => ({
            ...t,
            lessons: t.lessons.map((l) =>
              l.id === lessonId
                ? {
                    ...l,
                    payoutStatus: newStatus,
                    payoutPaidAt: newStatus === "PAID" ? new Date().toISOString() : null,
                  }
                : l
            ),
          }))
        );
        showToast(res.message || `Payout marked as ${newStatus}.`, "success");
      } else {
        showToast(res.error || "Failed to update payout status.", "error");
      }
    });
  };

  // Dynamic status counts from active database records
  const allCount = teachers.length;
  const approvedCount = teachers.filter((t) => t.approvalStatus === "APPROVED").length;
  const pendingCount = teachers.filter((t) => t.approvalStatus === "PENDING").length;
  const rejectedCount = teachers.filter((t) => t.approvalStatus === "REJECTED").length;

  // Filter teachers for directory list
  const filteredTeachers = teachers.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.customId && t.customId.toLowerCase().includes(q)) ||
      (t.phone && t.phone.toLowerCase().includes(q)) ||
      t.instruments.some((inst) => inst.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    return t.approvalStatus === statusFilter;
  });

  const formattedIstDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  // Metrics for selected teacher
  const totalLessons = selectedTeacher ? selectedTeacher.lessons.length : 0;
  const completedLessons = selectedTeacher
    ? selectedTeacher.lessons.filter((l) => l.status === "COMPLETED").length
    : 0;
  const scheduledLessons = selectedTeacher
    ? selectedTeacher.lessons.filter((l) => l.status === "SCHEDULED").length
    : 0;
  const payoutRupees = selectedTeacher
    ? Math.round(selectedTeacher.payoutPerSession / 100)
    : 800;

  // Initials generator
  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "FA"
    );
  };

  // Status update handler (Approve, Reject, Pending)
  const handleUpdateStatus = (
    teacherId: string,
    newStatus: TeacherApprovalStatus,
    reason?: string
  ) => {
    startTransition(async () => {
      const res = await updateTeacherApprovalAction({
        teacherProfileId: teacherId,
        status: newStatus,
        rejectionReason: reason || null,
        adminNotes: adminNotesInput.trim() ? adminNotesInput.trim() : undefined,
      });

      if (res.success) {
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId
              ? {
                  ...t,
                  approvalStatus: newStatus,
                  approvedAt:
                    newStatus === "APPROVED"
                      ? new Date().toISOString()
                      : t.approvedAt,
                  rejectedAt:
                    newStatus === "REJECTED"
                      ? new Date().toISOString()
                      : null,
                  rejectionReason:
                    newStatus === "REJECTED"
                      ? reason || "Requirements not met"
                      : null,
                  isPublished: newStatus === "APPROVED" ? t.isPublished : false,
                }
              : t
          )
        );
        showToast(
          res.message ||
            `Faculty status updated to ${newStatus.toLowerCase()}.`,
          "success"
        );
        setIsRejectModalOpen(false);
        setRejectionReasonInput("");
      } else {
        showToast(res.error || "Failed to update faculty status.", "error");
      }
    });
  };

  // Payout rate save handler
  const handleSavePayoutRate = (teacherId: string) => {
    const ratePaise = Math.round(inlinePayoutInput * 100);
    startTransition(async () => {
      const res = await updateTeacherApprovalAction({
        teacherProfileId: teacherId,
        status: selectedTeacher.approvalStatus,
        payoutPerSession: ratePaise,
        adminNotes: adminNotesInput.trim() ? adminNotesInput.trim() : undefined,
      });

      if (res.success) {
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId
              ? {
                  ...t,
                  payoutPerSession: ratePaise,
                  adminNotes: adminNotesInput.trim() || t.adminNotes,
                }
              : t
          )
        );
        showToast(`Session payout updated to ₹${inlinePayoutInput}.`, "success");
      } else {
        showToast(res.error || "Could not update remuneration rate.", "error");
      }
    });
  };

  // Publish / Discoverability toggle
  const handleTogglePublish = (teacherId: string, currentPublished: boolean) => {
    startTransition(async () => {
      const res = await updateTeacherApprovalAction({
        teacherProfileId: teacherId,
        status: selectedTeacher.approvalStatus,
        isPublished: !currentPublished,
      });

      if (res.success) {
        setTeachers((prev) =>
          prev.map((t) =>
            t.id === teacherId ? { ...t, isPublished: !currentPublished } : t
          )
        );
        showToast(
          !currentPublished
            ? "Faculty profile published to website catalog."
            : "Faculty profile hidden from website catalog.",
          "success"
        );
      } else {
        showToast(res.error || "Could not update discoverability.", "error");
      }
    });
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed top-20 right-6 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 ${
            toastType === "success"
              ? "border-emerald-200 bg-white text-heading"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {toastType === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. TOP BREADCRUMB & UTILITIES ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-body/70">
          <span className="font-medium">Operations</span>
          <span className="text-body/40">/</span>
          <span className="font-bold text-heading">Teachers</span>
        </div>

        <div className="flex items-center gap-2.5 text-body/80 self-end sm:self-auto">
          {/* IST Timezone Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-neutral-200/90 text-[11px] font-medium shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-primary/70" />
            <span>IST · {formattedIstDate}</span>
          </div>
        </div>
      </div>

      {/* ─── 2. MAIN HEADER & ACTIONS ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Teachers
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Export Roster button */}
          <button
            type="button"
            onClick={() => showToast("Faculty roster CSV ready for download.")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200/90 text-heading text-xs font-bold transition-all shadow-2xs active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-body/80 rotate-180" />
            <span>Export Roster</span>
          </button>

          {/* Invite Faculty button */}
          <button
            type="button"
            onClick={() => showToast("Faculty invitation link copied to clipboard.")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-white" />
            <span>Invite Faculty</span>
          </button>
        </div>
      </div>

      {/* ─── 3. MASTER-DETAIL WORKSPACE (DIRECTORY + 360 OVERVIEW) ──────── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ─── LEFT: DIRECTORY LIST (320px–360px) ───────────────────────── */}
        <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">Directory</h2>
            <p className="text-xs text-body/70 mt-0.5 font-numeric">
              {teachers.length} active faculty profiles
            </p>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-body/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, email or instrument"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200/90 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C] transition-colors"
            />
          </div>

          {/* ─── FILTER PILLS (AS REQUESTED) ───────────────────────────── */}
          {/* Pending Review 0, Approved 3, Rejected 1, All Instructors 4 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                statusFilter === "ALL"
                  ? "bg-[#3C096C] text-white shadow-2xs"
                  : "bg-neutral-100/90 hover:bg-neutral-200/70 text-body"
              }`}
            >
              <span>All Instructors</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-numeric ${
                  statusFilter === "ALL"
                    ? "bg-white/20 text-white"
                    : "bg-neutral-200/90 text-heading"
                }`}
              >
                {allCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("APPROVED")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                statusFilter === "APPROVED"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70"
              }`}
            >
              <span>Approved</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-numeric ${
                  statusFilter === "APPROVED"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-200/70 text-emerald-900"
                }`}
              >
                {approvedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("PENDING")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                statusFilter === "PENDING"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/70"
              }`}
            >
              <span>Pending Review</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-numeric ${
                  statusFilter === "PENDING"
                    ? "bg-white/20 text-white"
                    : "bg-amber-200/70 text-amber-900"
                }`}
              >
                {pendingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("REJECTED")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                statusFilter === "REJECTED"
                  ? "bg-rose-700 text-white shadow-2xs"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/70"
              }`}
            >
              <span>Rejected</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-numeric ${
                  statusFilter === "REJECTED"
                    ? "bg-white/20 text-white"
                    : "bg-rose-200/70 text-rose-900"
                }`}
              >
                {rejectedCount}
              </span>
            </button>
          </div>

          {/* Directory Teacher Card List */}
          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {filteredTeachers.length === 0 ? (
              <div className="p-6 text-center text-xs text-body/60 bg-neutral-50/70 rounded-xl">
                No faculty members match your filter.
              </div>
            ) : (
              filteredTeachers.map((teacher) => {
                const isSelected = teacher.id === selectedTeacher?.id;
                const initials = getInitials(teacher.name);
                const primaryInst =
                  teacher.instruments.length > 0
                    ? teacher.instruments.slice(0, 2).join(", ")
                    : "All Instruments";

                return (
                  <button
                    key={teacher.id}
                    type="button"
                    onClick={() => {
                      setSelectedTeacherId(teacher.id);
                      setInlinePayoutInput(Math.round(teacher.payoutPerSession / 100));
                      setAdminNotesInput(teacher.adminNotes || "");
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${
                      isSelected
                        ? "bg-[#3C096C]/10 shadow-2xs ring-1 ring-[#3C096C]/20"
                        : "bg-neutral-50/70 hover:bg-neutral-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Initials Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-[#3C096C]/10 text-[#3C096C] border border-[#3C096C]/15 flex items-center justify-center font-bold text-xs shrink-0 font-sans">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-xs text-heading truncate">
                            {teacher.name}
                          </span>
                          {teacher.customId && (
                            <span className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-[#3C096C]">
                              {teacher.customId}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-body/70 truncate mt-0.5">
                          {primaryInst} · {teacher.country || "India"}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              teacher.approvalStatus === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : teacher.approvalStatus === "PENDING"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {teacher.approvalStatus === "APPROVED"
                              ? "Approved"
                              : teacher.approvalStatus === "PENDING"
                                ? "Pending Review"
                                : "Rejected"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isSelected ? "text-[#3C096C] translate-x-0.5" : "text-body/30"
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ─── RIGHT: TEACHER 360 WORKSPACE (FULL DETAILS) ─────────────── */}
        {selectedTeacher ? (
          <div className="flex-1 min-w-0 space-y-5">
            {/* ─── Profile Header Card ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#3C096C]/10 border border-[#3C096C]/20 text-[#3C096C] flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
                    {getInitials(selectedTeacher.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-serif text-xl sm:text-2xl font-bold text-heading">
                        {selectedTeacher.name}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
                          selectedTeacher.approvalStatus === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : selectedTeacher.approvalStatus === "PENDING"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {selectedTeacher.approvalStatus === "APPROVED"
                          ? "Approved"
                          : selectedTeacher.approvalStatus === "PENDING"
                            ? "Pending Review"
                            : "Rejected"}
                      </span>
                      {selectedTeacher.isPublished && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                          Live on Web
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-purple-100 text-[#3C096C]">
                        {selectedTeacher.customId || `T${selectedTeacher.userId.slice(-4).toUpperCase()}`}
                      </span>
                      <span className="text-xs text-body/60 font-numeric">
                        · faculty since{" "}
                        {new Date(selectedTeacher.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ─── ACTION BUTTONS: Review Full Application & Revoke / Reject ─── */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Button 1: Review Full Application */}
                  <button
                    type="button"
                    onClick={() => {
                      setInlinePayoutInput(Math.round(selectedTeacher.payoutPerSession / 100));
                      setAdminNotesInput(selectedTeacher.adminNotes || "");
                      setIsReviewApplicationOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-heading text-xs font-semibold transition-colors shadow-2xs active:scale-95"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-[#3C096C]" />
                    <span>Review Full Application</span>
                  </button>

                  {/* Button 2: Revoke / Reject */}
                  {selectedTeacher.approvalStatus !== "REJECTED" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectionReasonInput(
                          selectedTeacher.rejectionReason ||
                            "Credentials require verified academic accreditation."
                        );
                        setIsRejectModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-colors shadow-2xs active:scale-95"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Revoke / Reject</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateStatus(selectedTeacher.id, TeacherApprovalStatus.APPROVED)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Re-evaluate & Approve</span>
                    </button>
                  )}

                  {/* Approve Faculty CTA if Pending */}
                  {selectedTeacher.approvalStatus === "PENDING" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateStatus(selectedTeacher.id, TeacherApprovalStatus.APPROVED)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Approve Faculty</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Login Disabled / Rejected Notice Banner */}
              {selectedTeacher.approvalStatus === "REJECTED" && (
                <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Login access is disabled for this faculty member.</strong> When attempting to log in, they will be notified: <code className="bg-rose-100/90 text-rose-950 px-1.5 py-0.5 rounded font-mono font-bold">your application is rejected please contact administration</code>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateStatus(selectedTeacher.id, TeacherApprovalStatus.APPROVED)
                    }
                    className="btn-tactile px-3 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-800 text-[11px] font-bold shrink-0 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
                  >
                    Re-evaluate & Approve
                  </button>
                </div>
              )}

              {/* 6-Field Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-4 border-t border-neutral-100 text-xs">
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Email</div>
                  <div className="font-bold text-heading mt-0.5 truncate select-all">
                    {selectedTeacher.email}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Phone</div>
                  <div className="font-bold text-heading mt-0.5 font-numeric flex items-center gap-1.5">
                    <span>{selectedTeacher.phone || "-"}</span>
                    {selectedTeacher.phoneVerified && (
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Remuneration Rate</div>
                  <div className="font-bold text-heading mt-0.5 font-numeric text-[#3C096C]">
                    ₹{payoutRupees.toLocaleString("en-IN")} / session
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Payout UPI ID</div>
                  <div className="font-bold text-heading mt-0.5 truncate">
                    {selectedTeacher.upiId || "Not configured"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Country / Timezone</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.country || "India"} · {selectedTeacher.timezone}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Experience & Languages</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.yearsTeaching} yrs ·{" "}
                    {selectedTeacher.languages.join(", ") || "English"}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Tab Navigation Bar ──────────────────────────────────── */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-semibold">
              {[
                { id: "OVERVIEW", label: "Overview" },
                { id: "CLASSES", label: "Classes & Sessions" },
                { id: "STUDENTS", label: "Students Allotted" },
                { id: "RESOURCES", label: "Curriculum & Resources" },
                { id: "PAYOUTS", label: "Payout History" },
                { id: "DOSSIER", label: "Accreditation Dossier" },
                { id: "CHAT_LOGS", label: "Chat Logs" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap active:scale-95 ${
                    activeTab === tab.id
                      ? "bg-[#3C096C] text-white shadow-xs"
                      : "bg-white hover:bg-neutral-100 text-body/70 border border-neutral-200/80"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 1: OVERVIEW                                                */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "OVERVIEW" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* ─── 4 Executive Metric Cards Row ────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {/* Card 1: Completed Sessions */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Completed Sessions</span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      {completedLessons}
                    </div>
                    <div className="text-[11px] text-body/60 font-medium mt-0.5 font-numeric">
                      {totalLessons} total assigned sessions
                    </div>
                  </div>

                  {/* Card 2: Scheduled / Upcoming */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Scheduled Classes</span>
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      {scheduledLessons}
                    </div>
                    <div className="text-[11px] text-body/60 font-medium mt-0.5 font-numeric">
                      Upcoming bookings on calendar
                    </div>
                  </div>

                  {/* Card 3: Payout Rate */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Session Remuneration</span>
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <IndianRupee className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      ₹{payoutRupees.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-body/60 font-medium mt-0.5">
                      Per 60-min completed lesson
                    </div>
                  </div>

                  {/* Card 4: Discoverability */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Catalog Listing</span>
                      <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2">
                      {selectedTeacher.isPublished ? "Live on Web" : "Unlisted"}
                    </div>
                    <div className="text-[11px] text-body/60 font-medium mt-0.5 flex items-center justify-between">
                      <span>{selectedTeacher.isPublished ? "Publicly bookable" : "Hidden from search"}</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePublish(selectedTeacher.id, selectedTeacher.isPublished)
                        }
                        className="text-[10px] text-[#3C096C] font-bold hover:underline"
                      >
                        {selectedTeacher.isPublished ? "Unlist" : "Publish"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ─── 2-Column Content Grid ───────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* LEFT SUB-COLUMN (7 COLS / ~60%) */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* 1. Specialized Instruments & Disciplines */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-base font-bold text-heading">
                            Specialized Instruments & Disciplines
                          </h3>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Expert Instruments */}
                        <div>
                          <div className="text-[11px] font-semibold text-heading uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-purple-700" />
                            <span>Expert Mastery</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTeacher.expertInstruments.length > 0 ? (
                              selectedTeacher.expertInstruments.map((inst) => (
                                <span
                                  key={inst}
                                  className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200/80 text-xs font-semibold"
                                >
                                  {inst}
                                </span>
                              ))
                            ) : selectedTeacher.instruments.length > 0 ? (
                              selectedTeacher.instruments.map((inst) => (
                                <span
                                  key={inst}
                                  className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200/80 text-xs font-semibold"
                                >
                                  {inst}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-body/50 italic">
                                No expert disciplines listed.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Moderate Instruments */}
                        {selectedTeacher.moderateInstruments.length > 0 && (
                          <div className="pt-2 border-t border-neutral-100">
                            <div className="text-[11px] font-semibold text-body/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <Music className="w-3.5 h-3.5 text-body/60" />
                              <span>Secondary / Moderate Competency</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedTeacher.moderateInstruments.map((inst) => (
                                <span
                                  key={inst}
                                  className="px-2.5 py-1 rounded-lg bg-neutral-100 text-body/80 border border-neutral-200 text-xs font-medium"
                                >
                                  {inst}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Upcoming & Recent Classes */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-base font-bold text-heading">
                            Upcoming & Recent Classes
                          </h3>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {upcomingAndRecentLessons.length === 0 ? (
                          <div className="p-4 rounded-xl bg-neutral-50 text-center text-xs text-body/60">
                            No sessions recorded for this faculty member yet.
                          </div>
                        ) : (
                          upcomingAndRecentLessons.map((l) => {
                            const lDate = new Date(l.startsAt);
                            const isUpcoming = l.status === "SCHEDULED" || new Date(l.startsAt) >= new Date();
                            const isCompleted = l.status === "COMPLETED";

                            return (
                              <div
                                key={l.id}
                                className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/40 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-heading truncate">
                                    {lDate.toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                    })}{" "}
                                    ·{" "}
                                    {lDate.toLocaleTimeString("en-GB", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    · {l.instrument}
                                  </div>
                                  <div className="text-[11px] text-body/70 mt-0.5 truncate">
                                    Student: {l.studentName || l.studentEmail || "Enrolled Student"}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isCompleted ? (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                                      Complete
                                    </span>
                                  ) : isUpcoming ? (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold">
                                      Upcoming
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-body/70 text-[10px] font-semibold">
                                      {l.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 3. Biography & Teaching Philosophy */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <h3 className="font-serif text-base font-bold text-heading">
                        Curriculum & Teaching Bio
                      </h3>
                      <div className="text-xs text-body leading-relaxed whitespace-pre-line bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                        {selectedTeacher.bio || "No professional biography submitted yet."}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SUB-COLUMN (5 COLS / ~40%) */}
                  <div className="lg:col-span-5 space-y-5">
                    {/* 1. Remuneration & Payout Settings */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-base font-bold text-heading">
                            Remuneration Control
                          </h3>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100/80 space-y-3">
                        <label className="text-[11px] font-semibold text-heading block">
                          Payout Per 60-Minute Class (INR ₹)
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-body">
                              ₹
                            </span>
                            <input
                              type="number"
                              value={inlinePayoutInput}
                              onChange={(e) => setInlinePayoutInput(Number(e.target.value))}
                              step="50"
                              min="0"
                              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-purple-200 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSavePayoutRate(selectedTeacher.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-lg bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                          >
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Rate"}
                          </button>
                        </div>

                        <div className="text-[11px] text-body/70 pt-2 border-t border-purple-100 flex items-center justify-between">
                          <span>Linked UPI ID:</span>
                          <span className="font-semibold text-heading">
                            {selectedTeacher.upiId || "None"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Application Status & Governance */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <h3 className="font-serif text-base font-bold text-heading">
                        Accreditation & Governance
                      </h3>

                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/40 flex items-center justify-between">
                          <span className="text-body/70">Current Accreditation</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              selectedTeacher.approvalStatus === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700"
                                : selectedTeacher.approvalStatus === "PENDING"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {selectedTeacher.approvalStatus}
                          </span>
                        </div>

                        {selectedTeacher.rejectionReason && (
                          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/70 text-rose-900 text-xs">
                            <div className="font-semibold mb-1">Rejection Rationale:</div>
                            <div>{selectedTeacher.rejectionReason}</div>
                          </div>
                        )}

                        {/* Admin Notes */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-heading block">
                            Internal Admin Notes
                          </label>
                          <textarea
                            value={adminNotesInput}
                            onChange={(e) => setAdminNotesInput(e.target.value)}
                            placeholder="Add verified credentials, background check notes, audition remarks..."
                            rows={3}
                            className="w-full p-2.5 rounded-xl border border-neutral-200 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePayoutRate(selectedTeacher.id)}
                            disabled={isPending}
                            className="text-[11px] text-[#3C096C] font-bold hover:underline"
                          >
                            Save Admin Notes
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 3. Allotted Courses & Enrolled Catalog */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <h3 className="font-serif text-base font-bold text-heading">
                        Catalog Allotments
                      </h3>

                      <div className="space-y-2 text-xs">
                        {selectedTeacher.courses.length === 0 ? (
                          <div className="p-3 text-center text-body/50 bg-neutral-50 rounded-xl">
                            Not allotted to any course batches yet.
                          </div>
                        ) : (
                          selectedTeacher.courses.map((c) => (
                            <div
                              key={c.id}
                              className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/40 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-bold text-heading">{c.title}</div>
                                <div className="text-[11px] text-body/60 mt-0.5">
                                  {c.instrument} · {c.level}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">
                                Faculty
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 2: CLASSES & SESSIONS                                      */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "CLASSES" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Sub-header & Filter Segment */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif text-base font-bold text-heading">
                        Faculty Teaching Schedule & Sessions
                      </h3>
                      <p className="text-xs text-body/60 mt-0.5">
                        Total {selectedTeacher.lessons.length} sessions ·{" "}
                        {teacherUpcomingLessons.length} scheduled ·{" "}
                        {teacherPastLessons.length} completed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100/80 text-xs font-semibold self-start sm:self-auto">
                    {(["ALL", "UPCOMING", "PAST"] as const).map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setClassSubFilter(sub)}
                        className={`px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                          classSubFilter === sub
                            ? "bg-white text-heading shadow-2xs font-bold"
                            : "text-body/70 hover:text-heading"
                        }`}
                      >
                        {sub === "ALL" && `All (${selectedTeacher.lessons.length})`}
                        {sub === "UPCOMING" && `Upcoming (${teacherUpcomingLessons.length})`}
                        {sub === "PAST" && `Past (${teacherPastLessons.length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 1: Upcoming Classes */}
                {(classSubFilter === "ALL" || classSubFilter === "UPCOMING") && (
                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-700" />
                        <h4 className="font-serif text-base font-bold text-heading">
                          Upcoming Scheduled Sessions
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 text-[11px] font-semibold">
                          <button
                            type="button"
                            onClick={() => setUpcomingSortOrder("NEXT_FIRST")}
                            className={`px-2.5 py-1 rounded-md transition-all active:scale-95 ${
                              upcomingSortOrder === "NEXT_FIRST"
                                ? "bg-white text-heading shadow-2xs font-bold"
                                : "text-body/60 hover:text-heading"
                            }`}
                            title="Upcoming latest/next class first"
                          >
                            Next Class First
                          </button>
                          <button
                            type="button"
                            onClick={() => setUpcomingSortOrder("FURTHEST_FIRST")}
                            className={`px-2.5 py-1 rounded-md transition-all active:scale-95 ${
                              upcomingSortOrder === "FURTHEST_FIRST"
                                ? "bg-white text-heading shadow-2xs font-bold"
                                : "text-body/60 hover:text-heading"
                            }`}
                            title="Furthest scheduled class first"
                          >
                            Furthest First
                          </button>
                        </div>
                        <span className="text-xs text-body/60 font-medium font-numeric">
                          {teacherUpcomingLessons.length} scheduled
                        </span>
                      </div>
                    </div>

                    {displayedUpcomingLessons.length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-neutral-50/70 border border-neutral-200/50 text-xs text-body/60 space-y-2">
                        <Calendar className="w-8 h-8 text-neutral-400 mx-auto stroke-1" />
                        <div className="font-medium">No upcoming sessions on the calendar.</div>
                        <div className="text-[11px] text-body/50">
                          Future 1:1 or batch lesson bookings allotted to this teacher will appear here.
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {displayedUpcomingLessons.map((l) => {
                          const lDate = new Date(l.startsAt);
                          return (
                            <div
                              key={l.id}
                              className="p-4 rounded-xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50/60 transition-colors space-y-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-xs text-heading flex items-center gap-2">
                                      <span>{l.instrument}</span>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">
                                        {l.durationMinutes} min
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-body/70 mt-1 flex items-center gap-1.5 font-numeric">
                                      <Calendar className="w-3 h-3 text-purple-600" />
                                      <span>
                                        {lDate.toLocaleDateString("en-GB", {
                                          weekday: "short",
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        })}{" "}
                                        ·{" "}
                                        {lDate.toLocaleTimeString("en-GB", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}{" "}
                                        IST
                                      </span>
                                    </div>
                                  </div>
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-100 text-purple-800 shrink-0">
                                    SCHEDULED
                                  </span>
                                </div>

                                <div className="pt-2 border-t border-purple-100/60 flex items-center justify-between text-xs">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-heading truncate">
                                      {l.studentName || "Enrolled Student"}
                                    </div>
                                    <div className="text-[11px] text-body/60 truncate">
                                      {l.studentEmail || "-"}
                                    </div>
                                  </div>
                                  {l.trackingCode && (
                                    <span className="font-mono text-[10px] bg-white px-2 py-1 rounded border border-purple-200 text-purple-700 font-semibold shrink-0">
                                      {l.trackingCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Section 2: Past Sessions */}
                {(classSubFilter === "ALL" || classSubFilter === "PAST") && (
                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-serif text-base font-bold text-heading">
                          Past & Completed Sessions
                        </h4>
                      </div>
                      <span className="text-xs text-body/60 font-medium font-numeric">
                        {teacherPastLessons.length} sessions
                      </span>
                    </div>

                    {teacherPastLessons.length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-neutral-50/70 border border-neutral-200/50 text-xs text-body/60 space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-neutral-400 mx-auto stroke-1" />
                        <div className="font-medium">No past sessions recorded yet.</div>
                        <div className="text-[11px] text-body/50">
                          Completed or cancelled lessons will appear in this historical archive.
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 border border-neutral-200/80 rounded-xl overflow-hidden bg-neutral-50/20">
                        {teacherPastLessons.map((l) => {
                            const lDate = new Date(l.startsAt);
                            const isCompleted = l.status === "COMPLETED";

                            return (
                              <div
                                key={l.id}
                                className="p-3.5 sm:p-4 bg-white hover:bg-neutral-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-heading text-xs">
                                      {l.instrument} · {l.durationMinutes} min
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isCompleted
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                          : "bg-rose-50 text-rose-700 border border-rose-200/60"
                                      }`}
                                    >
                                      {l.status}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                        l.payoutStatus === "PAID"
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-amber-50 text-amber-700"
                                      }`}
                                    >
                                      Payout: {l.payoutStatus}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-body/70 flex items-center gap-2">
                                    <span>
                                      Student:{" "}
                                      <strong className="text-heading">
                                        {l.studentName || l.studentEmail || "Enrolled Student"}
                                      </strong>
                                    </span>
                                    {l.trackingCode && (
                                      <span className="font-mono text-body/50">· {l.trackingCode}</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-body/50 font-numeric">
                                    {lDate.toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}{" "}
                                    at{" "}
                                    {lDate.toLocaleTimeString("en-GB", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    IST
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  {l.recordingUrl ? (
                                    <a
                                      href={l.recordingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold text-[11px] transition-colors"
                                    >
                                      <Play className="w-3 h-3 text-purple-700 fill-purple-700" />
                                      <span>Recording</span>
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-body/40 italic">No recording</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 3: STUDENTS ALLOTTED                                       */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "STUDENTS" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Header & Filter */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif text-base font-bold text-heading">
                        Students Allotted to Faculty
                      </h3>
                      <p className="text-xs text-body/60 mt-0.5">
                        {selectedTeacher.allottedStudents?.length || 0} active students mentored by {selectedTeacher.name}
                      </p>
                    </div>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-body/50" />
                    <input
                      type="text"
                      placeholder="Search by name, email, phone..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                    />
                  </div>
                </div>

                {/* Allotted Students Cards */}
                {(() => {
                  const q = studentSearchQuery.toLowerCase().trim();
                  const list = (selectedTeacher.allottedStudents || []).filter(
                    (s) =>
                      !q ||
                      s.name.toLowerCase().includes(q) ||
                      s.email.toLowerCase().includes(q) ||
                      (s.phone && s.phone.toLowerCase().includes(q)) ||
                      (s.enrolledCourseTitle && s.enrolledCourseTitle.toLowerCase().includes(q)) ||
                      (s.instrument && s.instrument.toLowerCase().includes(q))
                  );

                  if (list.length === 0) {
                    return (
                      <div className="bg-white rounded-2xl border border-neutral-200/80 p-10 text-center text-xs text-body/60 space-y-2">
                        <Users className="w-10 h-10 text-neutral-300 mx-auto stroke-1" />
                        <div className="font-semibold text-heading">No students allotted yet</div>
                        <div className="text-[11px] text-body/50 max-w-sm mx-auto">
                          Students assigned to this teacher via course enrollments, conducted 1:1 sessions, or trial sessions will appear in this roster.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {list.map((st) => {
                        const cleanPhone = st.phone ? st.phone.replace(/[^0-9]/g, "") : null;
                        return (
                          <div
                            key={st.id}
                            className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 space-y-4 hover:border-purple-200 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-[#3C096C]/10 text-[#3C096C] font-bold text-sm flex items-center justify-center shrink-0">
                                  {getInitials(st.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-heading truncate">{st.name}</div>
                                  <div className="text-[11px] text-body/70 truncate">{st.email}</div>
                                </div>
                              </div>
                              {st.enrollmentStatus && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                  {st.enrollmentStatus}
                                </span>
                              )}
                            </div>

                            {/* Course & Instrument Pill */}
                            <div className="p-3 rounded-xl bg-neutral-50/70 border border-neutral-100 text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-body/60 text-[11px]">Enrolled Curriculum</span>
                                <span className="font-bold text-heading">
                                  {st.enrolledCourseTitle || st.instrument || "Music Mentorship"}
                                </span>
                              </div>
                              {st.courseLevel && (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-body/60">Discipline Level</span>
                                  <span className="font-semibold text-purple-700">{st.courseLevel}</span>
                                </div>
                              )}
                            </div>

                            {/* Session Progress Stats */}
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                                <div className="text-[10px] text-emerald-800 font-medium">Completed</div>
                                <div className="font-bold text-emerald-900 font-numeric mt-0.5">
                                  {st.completedLessonsCount}
                                </div>
                              </div>
                              <div className="p-2 rounded-lg bg-purple-50/60 border border-purple-100">
                                <div className="text-[10px] text-purple-800 font-medium">Upcoming</div>
                                <div className="font-bold text-purple-900 font-numeric mt-0.5">
                                  {st.upcomingLessonsCount}
                                </div>
                              </div>
                              <div className="p-2 rounded-lg bg-neutral-100/70 border border-neutral-200/60">
                                <div className="text-[10px] text-body/70 font-medium">Remaining</div>
                                <div className="font-bold text-heading font-numeric mt-0.5">
                                  {st.sessionsRemaining ?? "-"}
                                </div>
                              </div>
                            </div>

                            {/* Contact & Audit Actions */}
                            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5">
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                    title="Chat on WhatsApp"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <a
                                  href={`mailto:${st.email}`}
                                  className="p-2 rounded-lg bg-neutral-100 text-body hover:bg-neutral-200 transition-colors"
                                  title="Send Email"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </a>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab("CHAT_LOGS");
                                  const found = (selectedTeacher.conversations || []).find(
                                    (c) => c.studentId === st.id
                                  );
                                  if (found) setSelectedPreviewConvId(found.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold text-[11px] transition-colors active:scale-95"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>View Chat Log</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 4: CURRICULUM & RESOURCES                                  */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "RESOURCES" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Educational Resources Uploaded by Faculty */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-serif text-base font-bold text-heading">
                          Faculty Educational Materials & Uploads
                        </h3>
                        <p className="text-xs text-body/60 mt-0.5">
                          Sheet music, audio lessons, notes and exercises shared by {selectedTeacher.name}
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold self-start sm:self-auto font-numeric">
                      {selectedTeacher.resources.length} uploaded files
                    </span>
                  </div>

                  {selectedTeacher.resources.length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-neutral-50/70 border border-neutral-200/50 text-xs text-body/60 space-y-2">
                      <FolderArchive className="w-8 h-8 text-neutral-400 mx-auto stroke-1" />
                      <div className="font-semibold text-heading">No educational resources uploaded yet</div>
                      <div className="text-[11px] text-body/50">
                        When this teacher uploads sheet music, exercises, or audio recordings for students, they will be cataloged here.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {selectedTeacher.resources.map((r) => {
                        const sizeKb = r.fileSizeBytes ? Math.round(r.fileSizeBytes / 1024) : null;
                        return (
                          <div
                            key={r.id}
                            className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50/30 hover:bg-purple-50/20 hover:border-purple-200 transition-all space-y-3 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                  {r.category.replace(/_/g, " ")}
                                </span>
                                {sizeKb && (
                                  <span className="text-[10px] text-body/50 font-mono font-numeric">
                                    {sizeKb} KB
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-xs text-heading line-clamp-2">{r.title}</div>
                              {r.description && (
                                <p className="text-[11px] text-body/60 line-clamp-2">{r.description}</p>
                              )}
                            </div>

                            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                              <span className="text-[10px] text-body/50 font-numeric">
                                {new Date(r.createdAt).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              <a
                                href={r.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3C096C] hover:underline"
                              >
                                <span>Download</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Allotted Course Curriculum & Syllabi */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-base font-bold text-heading">
                        Allotted Course Syllabi & Curriculum
                      </h3>
                      <p className="text-xs text-body/60 mt-0.5">
                        Academy courses conducted by this faculty member
                      </p>
                    </div>
                    <span className="text-xs text-body/60 font-semibold font-numeric">
                      {selectedTeacher.courses.length} courses
                    </span>
                  </div>

                  {selectedTeacher.courses.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-neutral-50/70 border border-neutral-200/50 text-xs text-body/60">
                      Faculty is not currently assigned as primary teacher for any academy course batches.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedTeacher.courses.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50/40 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-xs text-heading">{c.title}</h4>
                              <div className="text-[11px] text-body/60 mt-0.5">
                                {c.instrument} · {c.level}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">
                              {c.sessionCount} Sessions
                            </span>
                          </div>
                          {c.syllabusSummary && (
                            <div className="text-[11px] text-body/80 bg-white p-3 rounded-lg border border-neutral-100 leading-relaxed">
                              {c.syllabusSummary}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 5: PAYOUT HISTORY                                          */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "PAYOUTS" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Financial Summary Strip */}
                {(() => {
                  const rateMinor = selectedTeacher.payoutPerSession || 80000;
                  const rateRupees = Math.round(rateMinor / 100);
                  const completedLessonsOnly = selectedTeacher.lessons.filter(
                    (l) => l.status === "COMPLETED"
                  );
                  const paidLessons = completedLessonsOnly.filter((l) => l.payoutStatus === "PAID");
                  const unpaidLessons = completedLessonsOnly.filter((l) => l.payoutStatus === "UNPAID");
                  const settledAmountRupees = paidLessons.reduce((acc, l) => {
                    const amt = l.payoutAmountMinor ? Math.round(l.payoutAmountMinor / 100) : rateRupees;
                    return acc + amt;
                  }, 0);
                  const pendingAmountRupees = unpaidLessons.reduce((acc, l) => {
                    const amt = l.payoutAmountMinor ? Math.round(l.payoutAmountMinor / 100) : rateRupees;
                    return acc + amt;
                  }, 0);

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Card 1: Session Rate with Inline Edit */}
                      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-body font-medium">Per-Session Rate</span>
                          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                            <IndianRupee className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-body">
                              ₹
                            </span>
                            <input
                              type="number"
                              value={inlinePayoutInput}
                              onChange={(e) => setInlinePayoutInput(Number(e.target.value))}
                              step="50"
                              min="0"
                              className="w-full pl-6 pr-2 py-1 rounded-lg border border-purple-200 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSavePayoutRate(selectedTeacher.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg bg-[#3C096C] text-white text-[11px] font-bold hover:bg-[#2F0755] transition-all disabled:opacity-50 active:scale-95"
                          >
                            Save
                          </button>
                        </div>
                        <div className="text-[10px] text-body/50">Rate per 60-min conducted session</div>
                      </div>

                      {/* Card 2: Total Paid */}
                      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-body font-medium">Total Paid</span>
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="font-serif text-2xl font-bold text-heading font-numeric">
                          ₹{settledAmountRupees.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-body/60 font-numeric">
                          {paidLessons.length} paid sessions
                        </div>
                      </div>

                      {/* Card 3: Pending Payout */}
                      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-body font-medium">Pending Payout</span>
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="font-serif text-2xl font-bold text-amber-900 font-numeric">
                          ₹{pendingAmountRupees.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-body/60 font-numeric">
                          {unpaidLessons.length} completed sessions to pay
                        </div>
                      </div>

                      {/* Card 4: Destination UPI */}
                      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-body font-medium">UPI Settlement ID</span>
                          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="font-mono text-sm font-bold text-heading truncate mt-1">
                          {selectedTeacher.upiId || "None configured"}
                        </div>
                        <div className="text-[11px] text-body/60">Registered payment handle</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Payout History Ledger */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                  {(() => {
                    const completedLessonsOnly = selectedTeacher.lessons.filter(
                      (l) => l.status === "COMPLETED"
                    );
                    const paidCount = completedLessonsOnly.filter((l) => l.payoutStatus === "PAID").length;
                    const unpaidCount = completedLessonsOnly.filter((l) => l.payoutStatus === "UNPAID").length;

                    const filtered = completedLessonsOnly.filter((l) => {
                      if (payoutSubFilter === "ALL") return true;
                      return l.payoutStatus === payoutSubFilter;
                    });

                    return (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h3 className="font-serif text-base font-bold text-heading">
                              Completed Session Remuneration Ledger
                            </h3>
                            <p className="text-xs text-body/60 mt-0.5">
                              Payout tracking for completed sessions only (upcoming classes appear after completion)
                            </p>
                          </div>

                          {/* Sub-filter tabs */}
                          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 text-xs font-semibold self-start sm:self-auto">
                            {(["ALL", "UNPAID", "PAID"] as const).map((sub) => (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => setPayoutSubFilter(sub)}
                                className={`px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                                  payoutSubFilter === sub
                                    ? "bg-white text-heading shadow-2xs font-bold"
                                    : "text-body/70 hover:text-heading"
                                }`}
                              >
                                {sub === "ALL" && `All Completed (${completedLessonsOnly.length})`}
                                {sub === "UNPAID" && `Unpaid (${unpaidCount})`}
                                {sub === "PAID" && `Paid (${paidCount})`}
                              </button>
                            ))}
                          </div>
                        </div>

                        {filtered.length === 0 ? (
                          <div className="p-8 text-center rounded-xl bg-neutral-50/70 border border-neutral-200/50 text-xs text-body/60 space-y-1">
                            <Receipt className="w-8 h-8 text-neutral-400 mx-auto stroke-1" />
                            <div className="font-semibold text-heading">
                              {completedLessonsOnly.length === 0
                                ? "No completed sessions for payout yet"
                                : "No completed payout records matching filter"}
                            </div>
                            <div className="text-[11px] text-body/50">
                              {completedLessonsOnly.length === 0
                                ? "Only completed sessions are eligible for remuneration payout. Upcoming classes will appear here once conducted."
                                : "Try selecting another status tab above to view other completed sessions."}
                            </div>
                          </div>
                        ) : (
                          <div className="divide-y divide-neutral-100 border border-neutral-200/80 rounded-xl overflow-hidden bg-neutral-50/20">
                        {filtered.map((l) => {
                          const lDate = new Date(l.startsAt);
                          const sessionFee = l.payoutAmountMinor
                            ? Math.round(l.payoutAmountMinor / 100)
                            : payoutRupees;
                          const isPaid = l.payoutStatus === "PAID";

                          return (
                            <div
                              key={l.id}
                              className="p-4 bg-white hover:bg-neutral-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-heading text-xs">
                                    {l.instrument} · {l.durationMinutes} min
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isPaid
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}
                                  >
                                    {isPaid ? "PAID" : "UNPAID"}
                                  </span>
                                  <span className="font-bold text-[#3C096C] text-xs font-numeric">
                                    ₹{sessionFee.toLocaleString("en-IN")}
                                  </span>
                                </div>

                                <div className="text-[11px] text-body/70 flex items-center gap-2">
                                  <span>
                                    Student:{" "}
                                    <strong className="text-heading">
                                      {l.studentName || l.studentEmail || "Enrolled Student"}
                                    </strong>
                                  </span>
                                  {l.trackingCode && (
                                    <span className="font-mono text-body/50">· Code: {l.trackingCode}</span>
                                  )}
                                </div>

                                <div className="text-[11px] text-body/50 font-numeric">
                                  Conducted:{" "}
                                  {lDate.toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}{" "}
                                  ·{" "}
                                  {lDate.toLocaleTimeString("en-GB", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  IST
                                  {l.payoutPaidAt && (
                                    <span className="text-emerald-700 ml-2">
                                      (Paid on {new Date(l.payoutPaidAt).toLocaleDateString("en-GB")})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => handleMarkLessonPayout(l.id, l.payoutStatus)}
                                  disabled={isPending}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 ${
                                    isPaid
                                      ? "border border-amber-300 text-amber-800 hover:bg-amber-50"
                                      : "bg-emerald-700 hover:bg-emerald-800 text-white"
                                  }`}
                                >
                                  {isPaid ? (
                                    <>
                                      <Clock className="w-3 h-3" />
                                      <span>Revert to Unpaid</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Mark as Paid</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 6: ACCREDITATION DOSSIER                                   */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "DOSSIER" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Accreditation Status Banner */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-lg font-bold text-heading">
                            Academic & Accreditation Dossier
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                              selectedTeacher.approvalStatus === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : selectedTeacher.approvalStatus === "PENDING"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {selectedTeacher.approvalStatus}
                          </span>
                        </div>
                        <p className="text-xs text-body/60 mt-0.5">
                          Verified identity credentials, university background, and teaching eligibility
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsReviewApplicationOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
                      >
                        Review Full Application
                      </button>
                      {selectedTeacher.approvalStatus !== "REJECTED" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRejectionReasonInput(
                              selectedTeacher.rejectionReason || "Credentials require verified academic accreditation."
                            );
                            setIsRejectModalOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-all active:scale-95"
                        >
                          Revoke Faculty
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(selectedTeacher.id, TeacherApprovalStatus.APPROVED)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all active:scale-95"
                        >
                          Approve Faculty
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedTeacher.rejectionReason && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-900 text-xs">
                      <div className="font-bold mb-1">Rejection Rationale:</div>
                      <div>{selectedTeacher.rejectionReason}</div>
                    </div>
                  )}
                </div>

                {/* Verified Identity Credentials Grid */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                  <h4 className="font-serif text-base font-bold text-heading">
                    Verified Faculty Credentials
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-100">
                      <div className="text-[11px] text-body/60 font-medium">Faculty Name & ID</div>
                      <div className="font-bold text-heading mt-1">{selectedTeacher.name}</div>
                      <div className="text-[10px] text-[#3C096C] font-mono font-bold mt-0.5">{selectedTeacher.customId || selectedTeacher.id}</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-100">
                      <div className="text-[11px] text-body/60 font-medium">Email Address</div>
                      <div className="font-bold text-heading mt-1 truncate">{selectedTeacher.email}</div>
                      <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Primary Contact</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-100">
                      <div className="text-[11px] text-body/60 font-medium">Phone & Verification</div>
                      <div className="font-bold text-heading mt-1 font-numeric">
                        {selectedTeacher.phone || "Not provided"}
                      </div>
                      <div className="text-[10px] text-body/60 mt-0.5">
                        {selectedTeacher.phoneVerified ? "OTP Verified" : "Unverified"}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-100">
                      <div className="text-[11px] text-body/60 font-medium">Teaching Experience</div>
                      <div className="font-bold text-heading mt-1 font-numeric">
                        {selectedTeacher.yearsTeaching} Years Conducting Music Lessons
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-100">
                      <div className="text-[11px] text-body/60 font-medium">Languages Spoken</div>
                      <div className="font-bold text-heading mt-1">
                        {selectedTeacher.languages.join(", ") || "English"}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-100">
                      <div className="text-[11px] text-body/60 font-medium">Country & Timezone</div>
                      <div className="font-bold text-heading mt-1">
                        {selectedTeacher.country || "India"} · {selectedTeacher.timezone}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bio & Teaching Philosophy */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-3">
                  <h4 className="font-serif text-base font-bold text-heading">
                    Pedagogical Philosophy & Biography
                  </h4>
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs text-body leading-relaxed whitespace-pre-line">
                    {selectedTeacher.bio || "No biography submitted yet."}
                  </div>
                </div>

                {/* Admin Internal Governance Notes */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-3">
                  <h4 className="font-serif text-base font-bold text-heading">
                    Internal Academy Governance Notes
                  </h4>
                  <textarea
                    value={adminNotesInput}
                    onChange={(e) => setAdminNotesInput(e.target.value)}
                    placeholder="Add verification notes, university background check remarks, audition performance..."
                    rows={4}
                    className="w-full p-3.5 rounded-xl border border-neutral-200 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSavePayoutRate(selectedTeacher.id)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    Save Accreditation Notes
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 7: CHAT LOGS                                               */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "CHAT_LOGS" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Compliance & Export Banner */}
                <div className="bg-gradient-to-r from-[#3C096C]/10 via-[#3C096C]/5 to-transparent rounded-2xl border border-purple-200/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#3C096C] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-bold text-heading">
                        Student-Faculty Chat Logs & Audit Archive
                      </h3>
                      <p className="text-xs text-body/70 mt-0.5">
                        Compliance auditing of all direct messaging conducted between {selectedTeacher.name} and enrolled students.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadAllChatLogs}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white font-bold text-xs shadow-xs active:scale-95 transition-all shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download All Chat Logs (.txt)</span>
                  </button>
                </div>

                {/* Conversations Roster */}
                {(!selectedTeacher.conversations || selectedTeacher.conversations.length === 0) ? (
                  <div className="bg-white rounded-2xl border border-neutral-200/80 p-10 text-center text-xs text-body/60 space-y-2">
                    <MessageSquare className="w-10 h-10 text-neutral-300 mx-auto stroke-1" />
                    <div className="font-semibold text-heading">No student chat conversations recorded</div>
                    <div className="text-[11px] text-body/50 max-w-sm mx-auto">
                      When this faculty member exchanges messages with their allotted students in the portal, full message transcripts and attachments will be archived here.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left Column: Conversation Cards List */}
                    <div className={selectedPreviewConvId ? "lg:col-span-5 space-y-3" : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
                      {selectedTeacher.conversations.map((conv) => {
                        const isSelected = selectedPreviewConvId === conv.id;
                        const lastUpdated = new Date(conv.updatedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });

                        return (
                          <div
                            key={conv.id}
                            className={`p-4 rounded-2xl border transition-all space-y-3 bg-white ${
                              isSelected
                                ? "border-[#3C096C] ring-2 ring-[#3C096C]/10 shadow-xs"
                                : "border-neutral-200/80 shadow-2xs hover:border-purple-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {getInitials(conv.studentName)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-heading truncate">
                                    {conv.studentName}
                                  </div>
                                  <div className="text-[11px] text-body/60 truncate">{conv.studentEmail}</div>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-body/80 shrink-0 font-numeric">
                                {conv.messages.length} msgs
                              </span>
                            </div>

                            <div className="text-[11px] text-body/60 flex items-center justify-between pt-2 border-t border-neutral-100">
                              <span>{conv.instrument || "General Music"}</span>
                              <span className="font-numeric">Updated: {lastUpdated}</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleDownloadSingleChatLog(conv)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 text-purple-800 hover:bg-purple-50 text-xs font-semibold transition-colors active:scale-95"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Log</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPreviewConvId(isSelected ? null : conv.id)
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                                  isSelected
                                    ? "bg-[#3C096C] text-white"
                                    : "bg-neutral-100 hover:bg-neutral-200 text-heading"
                                }`}
                              >
                                {isSelected ? "Hide" : "Transcript"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Column: Inline Transcript Viewer */}
                    {selectedPreviewConvId && (() => {
                      const activeConv = selectedTeacher.conversations.find(
                        (c) => c.id === selectedPreviewConvId
                      );
                      if (!activeConv) return null;

                      return (
                        <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden flex flex-col h-[580px]">
                          {/* Transcript Header */}
                          <div className="p-4 border-b border-neutral-100 bg-neutral-50/60 flex items-center justify-between">
                            <div>
                              <h4 className="font-serif text-sm font-bold text-heading">
                                Transcript: {selectedTeacher.name} & {activeConv.studentName}
                              </h4>
                              <p className="text-[11px] text-body/60 mt-0.5">
                                {activeConv.instrument || "Music"} · Total {activeConv.messages.length} recorded messages
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadSingleChatLog(activeConv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-heading text-[11px] font-semibold hover:bg-neutral-50"
                              >
                                <Download className="w-3 h-3 text-[#3C096C]" />
                                <span>Export</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPreviewConvId(null)}
                                className="p-1 text-body hover:text-heading"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Message Bubble Stream */}
                          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-neutral-50/20">
                            {activeConv.messages.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-xs text-body/50">
                                No messages sent in this conversation yet.
                              </div>
                            ) : (
                              activeConv.messages.map((m) => {
                                const isTeacherSender = m.senderRole === "TEACHER";
                                const timeStr = new Date(m.createdAt).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                                const dateStr = new Date(m.createdAt).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                });

                                return (
                                  <div
                                    key={m.id}
                                    className={`flex flex-col ${
                                      isTeacherSender ? "items-end" : "items-start"
                                    }`}
                                  >
                                    <div className="text-[10px] text-body/50 mb-1 px-1">
                                      <span className="font-semibold text-heading">{m.senderName}</span> ·{" "}
                                      <span className="font-medium text-[9px] uppercase px-1 rounded bg-neutral-100">
                                        {m.senderRole}
                                      </span>
                                    </div>
                                    <div
                                      className={`max-w-[85%] p-3 rounded-2xl text-xs space-y-1.5 shadow-2xs ${
                                        isTeacherSender
                                          ? "bg-[#3C096C] text-white rounded-tr-xs"
                                          : "bg-white border border-neutral-200/80 text-heading rounded-tl-xs"
                                      }`}
                                    >
                                      {m.body && <div className="leading-relaxed whitespace-pre-wrap">{m.body}</div>}
                                      {m.fileName && (
                                        <div
                                          className={`p-2 rounded-xl text-[11px] flex items-center justify-between gap-2 border ${
                                            isTeacherSender
                                              ? "bg-white/10 border-white/20 text-white"
                                              : "bg-neutral-50 border-neutral-200 text-heading"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <FileText className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{m.fileName}</span>
                                          </div>
                                          {m.fileUrl && (
                                            <a
                                              href={m.fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`font-bold hover:underline shrink-0 ${
                                                isTeacherSender ? "text-white" : "text-[#3C096C]"
                                              }`}
                                            >
                                              Open
                                            </a>
                                          )}
                                        </div>
                                      )}
                                      <div
                                        className={`text-[9px] text-right font-numeric ${
                                          isTeacherSender ? "text-white/60" : "text-body/50"
                                        }`}
                                      >
                                        {dateStr}, {timeStr} IST
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ─── MODAL 1: REVIEW FULL APPLICATION ───────────────────────────── */}
      {isReviewApplicationOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#3C096C]/10 text-[#3C096C] font-bold flex items-center justify-center">
                  {getInitials(selectedTeacher.name)}
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-heading">
                    Full Faculty Application
                  </h3>
                  <p className="text-xs text-body/60">
                    {selectedTeacher.name} · {selectedTeacher.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewApplicationOpen(false)}
                className="p-1 text-body hover:text-heading transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Content */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-50/80 border border-neutral-200/60">
                <div>
                  <div className="text-body/60 font-medium">Approval Status</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.approvalStatus}
                  </div>
                </div>
                <div>
                  <div className="text-body/60 font-medium">Years of Experience</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.yearsTeaching} years teaching
                  </div>
                </div>
                <div>
                  <div className="text-body/60 font-medium">Primary Disciplines</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.instruments.join(", ") || "None"}
                  </div>
                </div>
                <div>
                  <div className="text-body/60 font-medium">Languages Spoken</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.languages.join(", ") || "English"}
                  </div>
                </div>
                <div>
                  <div className="text-body/60 font-medium">Verified Phone</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.phone || "Not provided"}
                  </div>
                </div>
                <div>
                  <div className="text-body/60 font-medium">Country / Timezone</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedTeacher.country || "India"} · {selectedTeacher.timezone}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-heading mb-1.5">Submitted Biography</h4>
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-body leading-relaxed whitespace-pre-line">
                  {selectedTeacher.bio || "No biography provided by applicant."}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-heading mb-1.5">Admin Accreditation Notes</h4>
                <textarea
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="Record credentials verification, university degrees, or comments..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-neutral-200 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                />
              </div>
            </div>

            {/* Modal Decision Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setIsReviewApplicationOpen(false);
                  setIsRejectModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors"
              >
                Revoke / Reject Application
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewApplicationOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-body font-semibold text-xs transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStatus(selectedTeacher.id, TeacherApprovalStatus.APPROVED);
                    setIsReviewApplicationOpen(false);
                  }}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white font-bold text-xs transition-colors shadow-xs"
                >
                  Approve Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: REVOKE / REJECT FACULTY ────────────────────────────── */}
      {isRejectModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5 text-rose-700 font-bold text-base">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Revoke or Reject Faculty</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1 text-body hover:text-heading"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-body leading-relaxed">
              Are you sure you want to revoke accreditation for{" "}
              <strong className="text-heading">{selectedTeacher.name}</strong>? This will
              unpublish their public profile and notify them.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-heading block">
                Rejection Rationale / Notice
              </label>
              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Reason for revoking accreditation..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-neutral-200 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-neutral-200 text-body hover:bg-neutral-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(
                    selectedTeacher.id,
                    TeacherApprovalStatus.REJECTED,
                    rejectionReasonInput
                  )
                }
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition-colors shadow-xs"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Confirm Revocation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
