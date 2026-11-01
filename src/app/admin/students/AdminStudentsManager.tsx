"use client";

import { DateTimePicker } from "@/components/ui/DateTimePicker";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Globe,
  Upload,
  UserPlus,
  Plus,
  Search,
  ChevronRight,
  MessageSquare,
  Calendar,
  CheckCircle2,
  BarChart2,
  FileText,
  IndianRupee,
  Clock,
  Play,
  Share2,
  X,
  CreditCard,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  UserCheck,
  UserX,
  BookOpen,
  Download,
  ExternalLink,
  Video,
  Send,
  Sparkles,
  Music,
  FolderArchive,
  Bell,
  History,
  Check,
  Receipt,
  ChevronDown,
  GraduationCap,
} from "lucide-react";
import {
  createStudentAction,
  recordStudentPaymentAction,
  createStudentEnrollmentAction,
  scheduleStudentLessonAction,
  sendStudentCommunicationAction,
  toggleStudentAccessAction,
  updateStudentLessonStatusAction,
} from "@/actions/student-admin";

export interface StudentRecord {
  id: string;
  customId?: string | null;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  timezone: string;
  guardianName: string | null;
  guardianPhone: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  createdAt: string;
  isActive: boolean;
  enrollments: {
    id: string;
    courseId: string;
    courseTitle: string;
    courseLevel: string;
    courseInstrument: string;
    teacherName: string | null;
    sessionsRemaining: number;
    totalSessions: number;
    status: string;
    startedAt: string;
  }[];
  lessons: {
    id: string;
    instrument: string;
    startsAt: string;
    durationMinutes: number;
    status: string;
    teacherName: string | null;
    trackingCode: string | null;
    recordingUrl: string | null;
  }[];
  payments: {
    id: string;
    amountRupees: number;
    status: string;
    gateway: string;
    gatewayPaymentId: string | null;
    notes?: string | null;
    courseTitle?: string | null;
    createdAt: string;
  }[];
  resources: {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    fileName?: string | null;
    fileUrl: string;
    fileSizeBytes?: number;
    sharedAt: string;
    teacherName?: string | null;
    courseTitle?: string | null;
    teacherNote?: string | null;
  }[];
  trials: {
    id: string;
    instrument: string;
    status: string;
    createdAt: string;
    isConverted: boolean;
  }[];
  notifications: {
    id: string;
    title: string;
    message: string;
    type: string;
    createdAt: string;
  }[];
  conversations: {
    id: string;
    teacherId: string;
    teacherName: string;
    teacherEmail: string;
    instrument: string | null;
    updatedAt: string;
    messages: {
      id: string;
      senderId: string;
      senderName: string;
      senderRole: string;
      messageType: string;
      body: string | null;
      fileName?: string | null;
      fileUrl?: string | null;
      fileSizeBytes?: number | null;
      createdAt: string;
    }[];
  }[];
}

interface CourseOption {
  id: string;
  title: string;
  instrument: string;
  level: string;
  sessionCount: number;
  priceMinorUnits: number;
}

interface TeacherOption {
  id: string;
  name: string;
  instruments: string[];
}

interface AdminStudentsManagerProps {
  initialStudents: StudentRecord[];
  courses: CourseOption[];
  teachers: TeacherOption[];
}

export function AdminStudentsManager({
  initialStudents,
  courses,
  teachers,
}: AdminStudentsManagerProps) {
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudents[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DUE">("ALL");
  const [activeTab, setActiveTab] = useState<
    | "OVERVIEW"
    | "CLASSES"
    | "RESOURCES"
    | "PAYMENTS"
    | "COMMUNICATIONS"
    | "TIMELINE"
    | "CHAT_LOGS"
  >("OVERVIEW");

  // Chat Logs interactive state
  const [selectedPreviewConvId, setSelectedPreviewConvId] = useState<string | null>(null);

  // Communications & Timeline interactive states
  const [timelineFilter, setTimelineFilter] = useState<
    "ALL" | "LESSON" | "PAYMENT" | "RESOURCE" | "ENROLLMENT"
  >("ALL");
  const [commTitle, setCommTitle] = useState("");
  const [commMessage, setCommMessage] = useState("");
  const [isSendingComm, setIsSendingComm] = useState(false);

  // Modal dialog states
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isScheduleClassOpen, setIsScheduleClassOpen] = useState(false);
  const [isCreateEnrollmentOpen, setIsCreateEnrollmentOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isTogglingAccess, setIsTogglingAccess] = useState(false);

  const handleToggleAccess = async (studentToToggle?: StudentRecord) => {
    const targetStudent = studentToToggle || selectedStudent;
    if (!targetStudent || isTogglingAccess) return;

    const nextActive = !targetStudent.isActive;
    const confirmMessage = nextActive
      ? `Restore login access for ${targetStudent.name}? They will be able to log in to the student portal.`
      : `Remove login access for ${targetStudent.name}? When this inactive student tries to log in, they will be blocked and shown: "contact adminstrastation".`;

    if (!window.confirm(confirmMessage)) return;

    setIsTogglingAccess(true);
    try {
      const res = await toggleStudentAccessAction(targetStudent.id, nextActive);
      if (res.success) {
        showToast(
          res.message ||
          (nextActive
            ? `Login access granted for ${targetStudent.name}.`
            : `Login access removed for ${targetStudent.name}.`)
        );
        setStudents((prev) =>
          prev.map((s) =>
            s.id === targetStudent.id ? { ...s, isActive: nextActive } : s
          )
        );
      } else {
        showToast(res.error || "Could not update login access.");
      }
    } catch {
      showToast("An unexpected error occurred while updating login access.");
    } finally {
      setIsTogglingAccess(false);
    }
  };

  // Form states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [updatingLessonId, setUpdatingLessonId] = useState<string | null>(null);

  const handleUpdateLessonStatus = async (
    lessonId: string,
    newStatus: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED"
  ) => {
    setUpdatingLessonId(lessonId);
    // Optimistic update across student records
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) =>
          l.id === lessonId ? { ...l, status: newStatus } : l
        ),
      }))
    );

    try {
      const res = await updateStudentLessonStatusAction(lessonId, newStatus as any);
      if (res.success) {
        showToast(
          res.message ||
          `Class status updated to ${newStatus === "COMPLETED"
            ? "Complete"
            : newStatus === "SCHEDULED"
              ? "Upcoming"
              : newStatus
          }.`
        );
      } else {
        showToast(res.error || "Failed to update class status.");
      }
    } catch {
      showToast("An unexpected error occurred while updating class status.");
    } finally {
      setUpdatingLessonId(null);
    }
  };

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0];

  // Filter students for left directory
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.customId && s.customId.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === "ACTIVE") return s.isActive;
    if (statusFilter === "DUE") {
      const pendingDue = s.payments.some((p) => p.status === "CREATED");
      return pendingDue;
    }
    return true;
  });

  const dueStudentsCount = students.filter((s) =>
    s.payments.some((p) => p.status === "CREATED")
  ).length;

  const formattedIstDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  // Metrics for selected student
  const totalLessons = selectedStudent ? selectedStudent.lessons.length : 0;
  const completedLessons = selectedStudent
    ? selectedStudent.lessons.filter((l) => l.status === "COMPLETED").length
    : 0;
  const attendancePct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const totalCourseSessions = selectedStudent
    ? selectedStudent.enrollments.reduce((acc, e) => acc + e.totalSessions, 0)
    : 0;
  const sessionsTaken = selectedStudent
    ? selectedStudent.enrollments.reduce(
      (acc, e) => acc + Math.max(0, e.totalSessions - e.sessionsRemaining),
      0
    )
    : 0;
  const courseProgressPct =
    totalCourseSessions > 0
      ? Math.round((sessionsTaken / totalCourseSessions) * 100)
      : 0;

  const totalResources = selectedStudent
    ? selectedStudent.resources.length
    : 0;

  const outstandingRupees = selectedStudent
    ? selectedStudent.payments
      .filter((p) => p.status === "CREATED")
      .reduce((acc, p) => acc + p.amountRupees, 0)
    : 0;

  const totalPaidRupees = selectedStudent
    ? selectedStudent.payments
      .filter((p) => p.status === "PAID")
      .reduce((acc, p) => acc + p.amountRupees, 0)
    : 0;

  // Selected student avatar initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ST";
  };

  // Filtered classes: Upcoming vs Past
  const upcomingLessons = selectedStudent
    ? selectedStudent.lessons
      .filter((l) => {
        const lDate = new Date(l.startsAt);
        const endTime = new Date(lDate.getTime() + (l.durationMinutes || 60) * 60_000);
        const isFuture = endTime.getTime() >= Date.now();
        return isFuture && l.status !== "CANCELLED" && l.status !== "COMPLETED";
      })
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      )
    : [];

  const pastLessons = selectedStudent
    ? selectedStudent.lessons
      .filter((l) => {
        const lDate = new Date(l.startsAt);
        const endTime = new Date(lDate.getTime() + (l.durationMinutes || 60) * 60_000);
        const isPast = endTime.getTime() < Date.now();
        return l.status === "COMPLETED" || l.status === "CANCELLED" || isPast;
      })
      .sort(
        (a, b) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
      )
    : [];

  // Combined for Overview: upcoming classes shown first (next upcoming first in ascending chronological order), followed by recent past classes
  const overviewLessons = selectedStudent
    ? (() => {
        const combined = [...upcomingLessons, ...pastLessons];
        if (combined.length > 0) return combined.slice(0, 5);
        return [...selectedStudent.lessons]
          .sort(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
          )
          .slice(0, 5);
      })()
    : [];

  // Student timeline events
  const timelineEvents: {
    id: string;
    title: string;
    description?: string;
    date: string;
    rawDate: Date;
    type: "SIGNUP" | "TRIAL" | "ENROLLMENT" | "PAYMENT" | "LESSON" | "RESOURCE" | "COMMUNICATION";
  }[] = [];

  if (selectedStudent) {
    // 1. Signup
    timelineEvents.push({
      id: `reg-${selectedStudent.id}`,
      title: "Account Registered",
      description: `Student account created for ${selectedStudent.name} (${selectedStudent.email})`,
      date: new Date(selectedStudent.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      rawDate: new Date(selectedStudent.createdAt),
      type: "SIGNUP",
    });

    // 2. Trials
    selectedStudent.trials.forEach((t) => {
      timelineEvents.push({
        id: `trial-${t.id}`,
        title: t.isConverted
          ? `Qualified & Converted (${t.instrument})`
          : `Trial Lesson Requested (${t.instrument})`,
        description: t.isConverted
          ? "Trial lead converted by admissions team to active enrolled student."
          : `Status: ${t.status} · Requested instrument: ${t.instrument}`,
        date: new Date(t.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        rawDate: new Date(t.createdAt),
        type: "TRIAL",
      });
    });

    // 3. Enrollments
    selectedStudent.enrollments.forEach((e) => {
      timelineEvents.push({
        id: `enr-${e.id}`,
        title: `Enrolled in ${e.courseTitle}`,
        description: `${e.courseLevel} · ${e.totalSessions} total sessions · Teacher: ${e.teacherName || "Assigned Faculty"}`,
        date: new Date(e.startedAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        rawDate: new Date(e.startedAt),
        type: "ENROLLMENT",
      });
    });

    // 4. Payments
    selectedStudent.payments.forEach((p) => {
      timelineEvents.push({
        id: `pay-${p.id}`,
        title: `Tuition Payment Recorded · ₹${p.amountRupees.toLocaleString("en-IN")}`,
        description: `Method: ${p.gateway.toUpperCase()} · Receipt: ${p.gatewayPaymentId || "DIRECT"}${p.courseTitle ? ` · ${p.courseTitle}` : ""}`,
        date: new Date(p.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        rawDate: new Date(p.createdAt),
        type: "PAYMENT",
      });
    });

    // 5. Lessons
    selectedStudent.lessons.forEach((l) => {
      timelineEvents.push({
        id: `les-${l.id}`,
        title: l.status === "COMPLETED" ? `Class Attended · ${l.instrument}` : `Class Scheduled · ${l.instrument}`,
        description: `Faculty: ${l.teacherName || "Assigned Faculty"} · Status: ${l.status}${l.trackingCode ? ` · ${l.trackingCode}` : ""}`,
        date: new Date(l.startsAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        rawDate: new Date(l.startsAt),
        type: "LESSON",
      });
    });

    // 6. Resources
    selectedStudent.resources.forEach((r) => {
      timelineEvents.push({
        id: `res-${r.id}`,
        title: `Material Shared · ${r.title}`,
        description: `Category: ${r.category}${r.teacherName ? ` · Shared by ${r.teacherName}` : ""}${r.courseTitle ? ` · ${r.courseTitle}` : ""}`,
        date: new Date(r.sharedAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        rawDate: new Date(r.sharedAt),
        type: "RESOURCE",
      });
    });

    // 7. Notifications
    selectedStudent.notifications.forEach((n) => {
      timelineEvents.push({
        id: `notif-${n.id}`,
        title: `Notification Delivered · ${n.title}`,
        description: n.message,
        date: new Date(n.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        rawDate: new Date(n.createdAt),
        type: "COMMUNICATION",
      });
    });

    timelineEvents.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }

  const filteredTimelineEvents = timelineEvents.filter((ev) => {
    if (timelineFilter === "ALL") return true;
    return ev.type === timelineFilter;
  });

  // Chat log download functions
  const handleDownloadSingleChatLog = (conv: StudentRecord["conversations"][0]) => {
    if (!selectedStudent) return;
    const header = `================================================================================
GANDHARVA SCHOOL OF MUSIC - OFFICIAL STUDENT-FACULTY CHAT AUDIT LOG
================================================================================
Student: ${selectedStudent.name} (${selectedStudent.email})
Faculty Maestro: ${conv.teacherName} (${conv.teacherEmail})
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
          ? `\n[Attachment: ${m.fileName}${m.fileSizeBytes ? ` (${(m.fileSizeBytes / 1024).toFixed(0)} KB)` : ""
          }${m.fileUrl ? ` - Link: ${m.fileUrl}` : ""}]`
          : "";
        content += `[${idx + 1}] [${timeStr} IST] ${m.senderName} (${m.senderRole}):\n${m.body || ""}${attachment}\n\n`;
      });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeStudent = selectedStudent.name.replace(/[^a-zA-Z0-9]/g, "_");
    const safeTeacher = conv.teacherName.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Chat_Log_${safeStudent}_${safeTeacher}_${dateStamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded chat log with ${conv.teacherName}`);
  };

  const handleDownloadAllChatLogs = () => {
    if (!selectedStudent) return;
    const convs = selectedStudent.conversations || [];
    let content = `================================================================================
GANDHARVA SCHOOL OF MUSIC - COMPLETE STUDENT CHAT ARCHIVE
================================================================================
Student: ${selectedStudent.name} (${selectedStudent.email})
Phone: ${selectedStudent.phone || "Not provided"}
Guardian: ${selectedStudent.guardianName || "Not provided"} (${selectedStudent.guardianPhone || "N/A"})
Total Faculty Conversations: ${convs.length}
Export Timestamp: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST
================================================================================\n\n`;

    if (convs.length === 0) {
      content += "No chat conversations recorded between this student and any faculty member.\n";
    } else {
      convs.forEach((c, cIdx) => {
        content += `\n--------------------------------------------------------------------------------\n`;
        content += `CONVERSATION #${cIdx + 1}: Faculty Maestro ${c.teacherName} (${c.teacherEmail})\n`;
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
              ? `\n[Attachment: ${m.fileName}${m.fileSizeBytes ? ` (${(m.fileSizeBytes / 1024).toFixed(0)} KB)` : ""
              }]`
              : "";
            content += `[${mIdx + 1}] [${timeStr} IST] ${m.senderName} (${m.senderRole}):\n${m.body || ""}${attachment}\n\n`;
          });
        }
      });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeStudent = selectedStudent.name.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `All_Chat_Logs_${safeStudent}_${dateStamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded all chat logs for ${selectedStudent.name}`);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl shadow-lg border border-purple-200 bg-white text-heading text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. TOP BREADCRUMB & UTILITIES ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-body/70">
          <span className="font-medium">Operations</span>
          <span className="text-body/40">/</span>
          <span className="font-bold text-heading">Students</span>
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
            Students
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Import button */}
          <button
            type="button"
            onClick={() => showToast("Bulk import CSV template ready for upload.")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200/90 text-heading text-xs font-bold transition-all shadow-2xs active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-body/80" />
            <span>Import</span>
          </button>

          {/* + Add student button */}
          <button
            type="button"
            onClick={() => setIsAddStudentOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Add student</span>
          </button>
        </div>
      </div>

      {/* ─── 3. MASTER-DETAIL WORKSPACE (DIRECTORY + 360 OVERVIEW) ──────── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ─── LEFT: DIRECTORY LIST (320px-360px) ───────────────────────── */}
        <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">Directory</h2>
            <p className="text-xs text-body/70 mt-0.5 font-numeric">
              {students.length} active students
            </p>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-body/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, email or student ID"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200/90 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C] transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1 rounded-full transition-colors ${statusFilter === "ALL"
                  ? "bg-purple-100 text-[#3C096C] font-bold"
                  : "bg-neutral-100 text-body/70 hover:bg-neutral-200/60"
                }`}
            >
              All {students.length}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1 rounded-full transition-colors ${statusFilter === "ACTIVE"
                  ? "bg-purple-100 text-[#3C096C] font-bold"
                  : "bg-neutral-100 text-body/70 hover:bg-neutral-200/60"
                }`}
            >
              Active {students.filter((s) => s.isActive).length}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("DUE")}
              className={`px-3 py-1 rounded-full transition-colors ${statusFilter === "DUE"
                  ? "bg-rose-100 text-rose-700 font-bold"
                  : "bg-neutral-100 text-body/70 hover:bg-neutral-200/60"
                }`}
            >
              Due {dueStudentsCount}
            </button>
          </div>

          {/* Student Cards List */}
          <div className="space-y-2 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1 no-scrollbar">
            {filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-body/50">
                No students match your criteria.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const isSelected = selectedStudent?.id === st.id;
                const primaryCourse = st.enrollments[0]?.courseTitle || "No enrollment";
                const isDue = st.payments.some((p) => p.status === "CREATED");

                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStudentId(st.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] ${isSelected
                        ? "border-[#3C096C] bg-purple-50/40 shadow-xs ring-1 ring-[#3C096C]/20"
                        : "border-neutral-200/70 hover:border-purple-200 hover:bg-neutral-50/70 bg-white"
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Initials Avatar */}
                      <div className="w-9 h-9 rounded-full bg-purple-100/90 text-[#3C096C] font-bold text-xs flex items-center justify-center shrink-0 border border-purple-200/50">
                        {getInitials(st.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-xs text-heading truncate group-hover:text-[#3C096C] transition-colors">
                            {st.name}
                          </span>
                          {st.customId && (
                            <span className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-[#3C096C]">
                              {st.customId}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-body/70 truncate mt-0.5">
                          {primaryCourse} · {st.country || "India"}
                        </div>
                        <div className="mt-1">
                          {isDue ? (
                            <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                              Payment due
                            </span>
                          ) : st.isActive ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                              Access Disabled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? "text-[#3C096C]" : "text-body/30 group-hover:text-heading"
                        }`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── RIGHT: STUDENT 360 WORKSPACE (FULL DETAILS) ─────────────── */}
        {selectedStudent ? (
          <div className="flex-1 min-w-0 space-y-5">
            {/* ─── Profile Header Card ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#3C096C]/10 border border-[#3C096C]/20 text-[#3C096C] flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
                    {getInitials(selectedStudent.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-serif text-xl sm:text-2xl font-bold text-heading">
                        {selectedStudent.name}
                      </h2>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${selectedStudent.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                        {selectedStudent.isActive ? "Active" : "Login Disabled"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-purple-100 text-[#3C096C]">
                        {selectedStudent.customId || `S${selectedStudent.id.slice(-4).toUpperCase()}`}
                      </span>
                      <span className="text-xs text-body/60 font-numeric">
                        · student since{" "}
                        {new Date(selectedStudent.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Message button */}
                  <button
                    type="button"
                    onClick={() => setIsMessageOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-heading text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-body" />
                    <span>Message</span>
                  </button>

                  {/* Toggle Login Access button */}
                  <button
                    type="button"
                    onClick={() => handleToggleAccess()}
                    disabled={isTogglingAccess}
                    title={
                      selectedStudent.isActive
                        ? "Remove access from student to login"
                        : "Grant access to student to login"
                    }
                    className={`btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer ${selectedStudent.isActive
                        ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-300 active:scale-95"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300 active:scale-95"
                      }`}
                  >
                    {isTogglingAccess ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : selectedStudent.isActive ? (
                      <UserX className="w-3.5 h-3.5 text-rose-600" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>
                      {selectedStudent.isActive ? "Remove Login Access" : "Grant Login Access"}
                    </span>
                  </button>

                  {/* Direct Enrolment button */}
                  <Link
                    href={`/admin/enrollments?studentId=${selectedStudent.id}&direct=true`}
                    title={`Directly enroll ${selectedStudent.name} into courses & timetable without trial`}
                    className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-purple-200 bg-purple-50 hover:bg-purple-100 text-[#3C096C] hover:border-purple-300 shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-[#3C096C]" />
                    <span>Direct Enrolment</span>
                    <ExternalLink className="w-3 h-3 text-[#3C096C]/70" />
                  </Link>
                </div>
              </div>

              {/* Login Disabled Notice Banner */}
              {!selectedStudent.isActive && (
                <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Login access is disabled for this student.</strong> When trying to log in, they will be blocked with: <code className="bg-rose-100/90 text-rose-950 px-1.5 py-0.5 rounded font-mono font-bold">contact adminstrastation</code>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAccess()}
                    disabled={isTogglingAccess}
                    className="btn-tactile px-3 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-800 text-[11px] font-bold shrink-0 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
                  >
                    Restore Access
                  </button>
                </div>
              )}

              {/* 6-Field Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-4 border-t border-neutral-100 text-xs">
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Email</div>
                  <div className="font-bold text-heading mt-0.5 truncate select-all">
                    {selectedStudent.email}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Phone</div>
                  <div className="font-bold text-heading mt-0.5 font-numeric">
                    {selectedStudent.phone || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Parent / guardian</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedStudent.guardianName || "Not provided"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Guardian contact</div>
                  <div className="font-bold text-heading mt-0.5 font-numeric">
                    {selectedStudent.guardianPhone || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Country / timezone</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedStudent.country || "India"} · {selectedStudent.timezone}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Age / gender</div>
                  <div className="font-bold text-heading mt-0.5">
                    {selectedStudent.age ? `${selectedStudent.age} years` : "—"} ·{" "}
                    {selectedStudent.gender || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Tab Navigation Bar ──────────────────────────────────── */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-semibold">
              {[
                { id: "OVERVIEW", label: "Overview" },
                { id: "CLASSES", label: "Classes" },
                { id: "RESOURCES", label: "Resources" },
                { id: "PAYMENTS", label: "Payments" },
                { id: "COMMUNICATIONS", label: "Communications" },
                { id: "TIMELINE", label: "Timeline" },
                { id: "CHAT_LOGS", label: "Chat Logs" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap active:scale-95 ${activeTab === tab.id
                      ? "bg-[#3C096C] text-white shadow-xs"
                      : "bg-white hover:bg-neutral-100 text-body/70 border border-neutral-200/80"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─── TAB 1: OVERVIEW ─────────────────────────────────────── */}
            {activeTab === "OVERVIEW" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* ─── 4 Executive Metric Cards Row ────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {/* Card 1: Attendance */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Attendance</span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      {attendancePct}%
                    </div>
                    <div className="text-[11px] text-body/60 font-medium mt-0.5 font-numeric">
                      {completedLessons} of {totalLessons} sessions
                    </div>
                  </div>

                  {/* Card 2: Course progress */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Course progress</span>
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                        <BarChart2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      {courseProgressPct}%
                    </div>
                    <div className="text-[11px] text-body/60 font-medium mt-0.5 font-numeric">
                      {sessionsTaken} of {totalCourseSessions} lessons
                    </div>
                  </div>

                  {/* Card 3: Resources */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Resources</span>
                      <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      {totalResources} / {Math.max(totalResources, 10)}
                    </div>
                    <div className="text-[11px] text-body/60 font-medium mt-0.5">
                      {totalResources > 0 ? "Shared materials" : "0 materials shared"}
                    </div>
                  </div>

                  {/* Card 4: Outstanding */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-body font-medium">Outstanding</span>
                      <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                        <IndianRupee className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      ₹{outstandingRupees.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                      {outstandingRupees > 0 ? "Payment pending" : "No dues"}
                    </div>
                  </div>
                </div>

                {/* 2-Column Overview Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* LEFT SUB-COLUMN (7 COLS / ~60%) */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* 1. Enrollments Card */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-base font-bold text-heading">
                            Enrollments
                          </h3>
                          <p className="text-xs text-body/60 mt-0.5">
                            Controlled course catalog records
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedStudent.enrollments.length === 0 ? (
                          <div className="p-4 rounded-xl bg-neutral-50 text-center text-xs text-body/60">
                            No active course enrollments yet.
                          </div>
                        ) : (
                          selectedStudent.enrollments.map((enr) => (
                            <div
                              key={enr.id}
                              className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/40 flex items-center justify-between gap-3"
                            >
                              <div>
                                <div className="font-bold text-xs text-heading">
                                  {enr.courseTitle} · {enr.courseLevel}
                                </div>
                                <div className="text-[11px] text-body/70 mt-0.5 font-numeric">
                                  ENR-{enr.id.slice(-4)} · {enr.teacherName || "Assigned Faculty"} ·{" "}
                                  {Math.max(0, enr.totalSessions - enr.sessionsRemaining)}/
                                  {enr.totalSessions} sessions
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                {enr.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 2. Upcoming & past classes Card */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-base font-bold text-heading">
                            Upcoming & past classes
                          </h3>
                          <p className="text-xs text-body/60 mt-0.5">
                            Individual sessions · {selectedStudent.timezone}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {overviewLessons.length === 0 ? (
                          <div className="p-4 rounded-xl bg-neutral-50 text-center text-xs text-body/60">
                            No scheduled or completed lessons for this student.
                          </div>
                        ) : (
                          overviewLessons.map((l, idx) => {
                            const lDate = new Date(l.startsAt);
                            const endTime = new Date(lDate.getTime() + (l.durationMinutes || 60) * 60_000);
                            const isPastTime = Date.now() >= endTime.getTime();
                            const isUpcoming = (l.status === "SCHEDULED" || l.status === "RESCHEDULED") && !isPastTime;
                            const isCompleted = l.status === "COMPLETED";
                            const isCancelled = l.status === "CANCELLED";

                            return (
                              <div
                                key={l.id}
                                className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/40 flex items-center justify-between gap-3 group hover:border-[#3C096C]/20 transition-colors"
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
                                    Faculty: {l.teacherName || "Assigned Faculty"}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {updatingLessonId === l.id ? (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 text-body/70 text-[10px] font-semibold border border-neutral-200">
                                      <Loader2 className="w-3 h-3 animate-spin text-[#3C096C]" />
                                      <span>Saving...</span>
                                    </div>
                                  ) : (
                                    <div className="relative inline-flex items-center">
                                      <select
                                        value={l.status}
                                        onChange={(e) =>
                                          handleUpdateLessonStatus(
                                            l.id,
                                            e.target.value as any
                                          )
                                        }
                                        className={`appearance-none pl-2.5 pr-6 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-all outline-none ${isCompleted
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70"
                                            : isCancelled
                                              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70"
                                              : isUpcoming
                                                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70"
                                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70"
                                          }`}
                                        title="Click to update session status"
                                      >
                                        <option value="SCHEDULED">Upcoming</option>
                                        <option value="COMPLETED">Complete</option>
                                        <option value="CANCELLED">Cancelled</option>
                                        <option value="RESCHEDULED">Rescheduled</option>
                                      </select>
                                      <ChevronDown className="w-3 h-3 text-body/40 absolute right-1.5 pointer-events-none" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 3. Homework & resources Card */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-base font-bold text-heading">
                            Homework & resources
                          </h3>
                          <p className="text-xs text-body/60 mt-0.5">
                            Assigned practice materials and reference sheet music
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedStudent.resources.length === 0 ? (
                          <div className="p-4 rounded-xl bg-neutral-50 text-center text-xs text-body/60">
                            No shared learning materials or resources yet.
                          </div>
                        ) : (
                          selectedStudent.resources.map((res) => (
                            <div
                              key={res.id}
                              className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/40 flex items-center justify-between gap-3"
                            >
                              <div>
                                <div className="font-bold text-xs text-heading">
                                  {res.title}
                                </div>
                                <div className="text-[11px] text-body/60 mt-0.5">
                                  {res.category} · Shared{" "}
                                  {new Date(res.sharedAt).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                                Shared
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SUB-COLUMN (5 COLS / ~40%) */}
                  <div className="lg:col-span-5 space-y-5">
                    {/* 1. Payment Ledger Card */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-base font-bold text-heading">
                            Payment ledger
                          </h3>
                          <p className="text-xs text-body/60 mt-0.5">INR only</p>
                        </div>
                      </div>

                      {/* Outstanding balance banner */}
                      <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-rose-900">
                          Outstanding balance
                        </span>
                        <span className="font-serif text-base font-bold text-rose-900 font-numeric">
                          ₹{outstandingRupees.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* Past Transactions */}
                      <div className="space-y-2.5">
                        {selectedStudent.payments.length === 0 ? (
                          <div className="p-3 text-center text-xs text-body/50">
                            No transactions recorded for this student.
                          </div>
                        ) : (
                          selectedStudent.payments.map((p) => (
                            <div
                              key={p.id}
                              className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/30 flex items-center justify-between text-xs font-numeric"
                            >
                              <div>
                                <div className="font-bold text-heading">
                                  {new Date(p.createdAt).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                  })}{" "}
                                  · ₹{p.amountRupees.toLocaleString("en-IN")}
                                </div>
                                <div className="text-[11px] text-body/60 mt-0.5 uppercase">
                                  {p.gateway} · {p.gatewayPaymentId || "DIRECT"}
                                </div>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.status === "PAID"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                  }`}
                              >
                                {p.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 2. Communications Card */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                      <h3 className="font-serif text-base font-bold text-heading">
                        Communications
                      </h3>
                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/40">
                          <div className="font-bold text-heading">
                            WhatsApp · Class reminder
                          </div>
                          <div className="text-[11px] text-body/60 mt-0.5">
                            Delivered today · 10:12 IST
                          </div>
                        </div>
                        <div className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/40">
                          <div className="font-bold text-heading">
                            Email · Tuition receipt sent
                          </div>
                          <div className="text-[11px] text-body/60 mt-0.5">
                            Delivered · Automated system
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 2: CLASSES (UPCOMING & PAST CLASSES) ────────────── */}
            {activeTab === "CLASSES" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header & Quick Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-heading">
                      Class Schedules & Attendance
                    </h3>
                    <p className="text-xs text-body/60 mt-0.5">
                      Live virtual sessions and historic attendance for {selectedStudent.name}
                    </p>
                  </div>
                </div>

                {/* Section 1: UPCOMING CLASSES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif text-base font-bold text-heading">
                        Upcoming Classes
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#3C096C] text-xs font-bold font-numeric border border-purple-100">
                        {upcomingLessons.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-body/50">Next scheduled sessions</span>
                  </div>

                  {upcomingLessons.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border border-dashed border-neutral-200 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-purple-50 text-[#3C096C] flex items-center justify-center mx-auto">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-heading text-sm">No upcoming classes scheduled</div>
                        <p className="text-xs text-body/60 mt-1 max-w-sm mx-auto">
                          There are currently no active or pending future classes for this student.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {upcomingLessons.map((l) => (
                        <div
                          key={l.id}
                          className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between hover:border-[#3C096C]/30 transition-all space-y-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#3C096C] flex items-center justify-center shrink-0">
                                <Music className="w-4 h-4" />
                              </div>
                              <div>
                                <h5 className="font-bold text-heading text-sm">{l.instrument} Class</h5>
                                <p className="text-xs text-body/60 mt-0.5">
                                  Faculty: {l.teacherName || "Assigned Maestro"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {updatingLessonId === l.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3C096C]" />
                              ) : (
                                <div className="relative inline-flex items-center">
                                  <select
                                    value={l.status}
                                    onChange={(e) =>
                                      handleUpdateLessonStatus(l.id, e.target.value as any)
                                    }
                                    className="appearance-none pl-2 pr-5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold cursor-pointer outline-none hover:bg-purple-100/60"
                                    title="Change class status"
                                  >
                                    <option value="SCHEDULED">Scheduled</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                    <option value="RESCHEDULED">Rescheduled</option>
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-purple-700 absolute right-1 pointer-events-none" />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-neutral-50/70 text-xs">
                            <div>
                              <div className="text-[10px] text-body/60 font-medium">Session Date & Time</div>
                              <div className="font-bold text-heading font-numeric mt-0.5">
                                {new Date(l.startsAt).toLocaleDateString("en-GB", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                })} · {new Date(l.startsAt).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-body/60 font-medium">Duration</div>
                              <div className="font-bold text-heading font-numeric mt-0.5">
                                {l.durationMinutes} minutes
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-neutral-100 text-xs">
                            <div className="text-[11px] text-body/60 font-numeric">
                              Tracking code: <span className="font-semibold text-heading">{l.trackingCode || "TRK-" + l.id.slice(-6)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: PAST CLASSES */}
                <div className="space-y-3 pt-4 border-t border-neutral-200/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif text-base font-bold text-heading">
                        Past Classes
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-body/70 text-xs font-bold font-numeric border border-neutral-200">
                        {pastLessons.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-body/50">Completed & historic sessions</span>
                  </div>

                  {pastLessons.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border border-dashed border-neutral-200 text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 text-body/60 flex items-center justify-center mx-auto">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-heading text-sm">No past classes yet</div>
                      <p className="text-xs text-body/60 max-w-sm mx-auto">
                        Once sessions are conducted or marked complete, they will appear here with attendance logs.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs divide-y divide-neutral-100 overflow-hidden">
                      {pastLessons.map((l) => (
                        <div
                          key={l.id}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${l.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-neutral-100 text-neutral-600"
                              }`}>
                              {l.status === "COMPLETED" ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-heading text-sm">{l.instrument} Lesson</span>
                                {updatingLessonId === l.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3C096C]" />
                                ) : (
                                  <div className="relative inline-flex items-center">
                                    <select
                                      value={l.status}
                                      onChange={(e) =>
                                        handleUpdateLessonStatus(l.id, e.target.value as any)
                                      }
                                      className={`appearance-none pl-2 pr-5 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer outline-none transition-all ${l.status === "COMPLETED"
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70"
                                          : l.status === "CANCELLED"
                                            ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70"
                                            : "bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200/60"
                                        }`}
                                      title="Change class status"
                                    >
                                      <option value="COMPLETED">Completed</option>
                                      <option value="SCHEDULED">Scheduled</option>
                                      <option value="CANCELLED">Cancelled</option>
                                      <option value="RESCHEDULED">Rescheduled</option>
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-body/40 absolute right-1 pointer-events-none" />
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-body/60 mt-0.5">
                                Faculty: {l.teacherName || "Assigned Maestro"} · {l.durationMinutes} mins
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <div className="text-right">
                              <div className="font-bold text-heading font-numeric">
                                {new Date(l.startsAt).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                              <div className="text-[11px] text-body/60 font-numeric">
                                {new Date(l.startsAt).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })} IST
                              </div>
                            </div>

                            {l.recordingUrl && (
                              <Link
                                href={l.recordingUrl}
                                target="_blank"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-heading text-xs font-semibold transition-all active:scale-95"
                              >
                                <Play className="w-3.5 h-3.5 text-purple-700" />
                                <span>Recording</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 3: RESOURCES (SHARED STUDENT RESOURCES) ─────────── */}
            {activeTab === "RESOURCES" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg font-bold text-heading">
                        Shared Learning Materials
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#3C096C] text-xs font-bold font-numeric border border-purple-100">
                        {selectedStudent.resources.length}
                      </span>
                    </div>
                    <p className="text-xs text-body/60 mt-0.5">
                      Curated practice guides, ragas notation, and reference audio for {selectedStudent.name}
                    </p>
                  </div>
                </div>

                {selectedStudent.resources.length === 0 ? (
                  <div className="p-12 rounded-2xl bg-white border border-dashed border-neutral-200 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#3C096C] flex items-center justify-center mx-auto">
                      <FolderArchive className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-serif text-base font-bold text-heading">No shared resources yet</div>
                      <p className="text-xs text-body/60 mt-1 max-w-sm mx-auto">
                        Faculty members haven&apos;t shared custom study guides, sheet music, or practice audio with this student yet.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedStudent.resources.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 flex flex-col justify-between hover:border-[#3C096C]/30 hover:shadow-sm transition-all space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-[#3C096C] text-[11px] font-bold border border-purple-100 uppercase tracking-wider">
                              {r.category.replace(/_/g, " ")}
                            </span>
                            <span className="text-[11px] text-body/50 font-numeric">
                              {new Date(r.sharedAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold text-heading text-sm leading-snug">
                              {r.title}
                            </h4>
                            {r.description && (
                              <p className="text-xs text-body/70 mt-1 line-clamp-2">
                                {r.description}
                              </p>
                            )}
                          </div>

                          {r.teacherNote && (
                            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900">
                              <span className="font-semibold">Note:</span> {r.teacherNote}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 pt-3 border-t border-neutral-100 text-xs">
                          <div className="flex items-center justify-between text-[11px] text-body/60">
                            <span>By {r.teacherName || "Assigned Faculty"}</span>
                            {r.fileSizeBytes ? (
                              <span className="font-numeric">
                                {(r.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            ) : null}
                          </div>

                          <Link
                            href={r.fileUrl}
                            target="_blank"
                            download
                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-heading font-semibold text-xs transition-all active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5 text-[#3C096C]" />
                            <span>Download Material</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 4: PAYMENTS (ALL PAYMENTS MADE BY HIM) ───────────── */}
            {activeTab === "PAYMENTS" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Financial Summary Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5">
                    <div className="flex items-center justify-between text-xs text-body/60">
                      <span>Total Tuition Paid</span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      ₹{totalPaidRupees.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                      Cleared & verified
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5">
                    <div className="flex items-center justify-between text-xs text-body/60">
                      <span>Outstanding Balance</span>
                      <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                        <IndianRupee className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                      ₹{outstandingRupees.toLocaleString("en-IN")}
                    </div>
                    <div className={`text-[11px] font-semibold mt-0.5 ${outstandingRupees > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {outstandingRupees > 0 ? "Action required" : "No outstanding dues"}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-body/60">
                        <span>Payment Records</span>
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#3C096C] flex items-center justify-center">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="font-serif text-2xl font-bold text-heading mt-2 font-numeric">
                        {selectedStudent.payments.length}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRecordPaymentOpen(true)}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3C096C] hover:bg-[#3C096C]/90 text-white font-semibold text-xs shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Offline Payment</span>
                    </button>
                  </div>
                </div>

                {/* Transactions Ledger */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-serif text-base font-bold text-heading">
                        Payment Transactions & Receipts
                      </h4>
                      <p className="text-xs text-body/60 mt-0.5">
                        Full audit log of fees collected via Razorpay, UPI, or Direct Cash
                      </p>
                    </div>
                  </div>

                  {selectedStudent.payments.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 text-body/60 flex items-center justify-center mx-auto">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-heading text-sm">No payment records found</div>
                      <p className="text-xs text-body/60 max-w-sm mx-auto">
                        No payments have been recorded for this student yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 overflow-x-auto">
                      {selectedStudent.payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                              }`}>
                              <CreditCard className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-heading text-sm">
                                  {p.courseTitle || "Academy Tuition Fee"}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.status === "PAID"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}>
                                  {p.status}
                                </span>
                              </div>
                              <div className="text-xs text-body/60 mt-0.5 flex items-center gap-2">
                                <span>Receipt: <span className="font-numeric font-medium text-heading">{p.gatewayPaymentId || "DIR-" + p.id.slice(0, 8)}</span></span>
                                <span>·</span>
                                <span className="uppercase text-[11px] font-semibold">{p.gateway}</span>
                                {p.notes && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate max-w-xs">{p.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <div className="font-serif text-lg font-bold text-heading font-numeric">
                              ₹{p.amountRupees.toLocaleString("en-IN")}
                            </div>
                            <div className="text-[11px] text-body/60 font-numeric mt-0.5">
                              {new Date(p.createdAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })} · {new Date(p.createdAt).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 5: COMMUNICATIONS (MESSAGING & CONTACT) ─────────── */}
            {activeTab === "COMMUNICATIONS" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in duration-200">
                {/* Left Column: Quick Contact + In-App Messenger Composer */}
                <div className="lg:col-span-6 space-y-5">
                  {/* Direct Contact Triggers */}
                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 space-y-4">
                    <h4 className="font-serif text-base font-bold text-heading">
                      Direct Channels
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* WhatsApp */}
                      <a
                        href={
                          selectedStudent.phone
                            ? `https://wa.me/${selectedStudent.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                              `Namaste ${selectedStudent.name}, greetings from Gandharva School of Music.`
                            )}`
                            : "#"
                        }
                        target={selectedStudent.phone ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className={`p-3.5 rounded-xl border transition-all active:scale-95 flex items-center gap-3 ${selectedStudent.phone
                            ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-900"
                            : "border-neutral-200 bg-neutral-50/50 text-body/40 cursor-not-allowed"
                          }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs">WhatsApp Student</div>
                          <div className="text-[11px] truncate font-numeric text-emerald-700">
                            {selectedStudent.phone || "No phone linked"}
                          </div>
                        </div>
                      </a>

                      {/* Email */}
                      <a
                        href={`mailto:${selectedStudent.email}?subject=${encodeURIComponent(
                          "Gandharva School of Music - Academic Update"
                        )}`}
                        className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50 transition-all active:scale-95 flex items-center gap-3 text-purple-900"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#3C096C] text-white flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs">Send Official Email</div>
                          <div className="text-[11px] truncate text-purple-700">
                            {selectedStudent.email}
                          </div>
                        </div>
                      </a>
                    </div>

                    {/* Guardian details if available */}
                    {selectedStudent.guardianPhone && (
                      <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[11px] text-body/60">Guardian Contact ({selectedStudent.guardianName || "Parent"}):</span>
                          <div className="font-bold text-heading font-numeric">{selectedStudent.guardianPhone}</div>
                        </div>
                        <a
                          href={`https://wa.me/${selectedStudent.guardianPhone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-heading text-xs font-semibold hover:bg-neutral-50 active:scale-95"
                        >
                          WhatsApp Guardian
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Compose Notification / Dispatcher */}
                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 space-y-4">
                    <div>
                      <h4 className="font-serif text-base font-bold text-heading">
                        Send In-App Notification
                      </h4>
                      <p className="text-xs text-body/60 mt-0.5">
                        Delivers instantly to {selectedStudent.name}&apos;s student portal banner and notification tray.
                      </p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!commTitle.trim() || !commMessage.trim()) return;
                        setIsSendingComm(true);
                        try {
                          const res = await sendStudentCommunicationAction({
                            studentId: selectedStudent.id,
                            title: commTitle.trim(),
                            message: commMessage.trim(),
                          });
                          if (res.success) {
                            showToast("Notification delivered to student portal!");
                            // Optimistically update notifications in state
                            setStudents((prev) =>
                              prev.map((s) => {
                                if (s.id !== selectedStudent.id) return s;
                                return {
                                  ...s,
                                  notifications: [
                                    {
                                      id: `comm-${Date.now()}`,
                                      title: commTitle.trim(),
                                      message: commMessage.trim(),
                                      type: "SYSTEM",
                                      createdAt: new Date().toISOString(),
                                    },
                                    ...s.notifications,
                                  ],
                                };
                              })
                            );
                            setCommTitle("");
                            setCommMessage("");
                          } else {
                            alert(res.error || "Failed to deliver notification.");
                          }
                        } catch (err: any) {
                          alert(err.message || "Something went wrong.");
                        } finally {
                          setIsSendingComm(false);
                        }
                      }}
                      className="space-y-3.5 text-xs"
                    >
                      <div>
                        <label className="block font-semibold text-heading mb-1">
                          Message Subject / Title *
                        </label>
                        <input
                          type="text"
                          value={commTitle}
                          onChange={(e) => setCommTitle(e.target.value)}
                          required
                          placeholder="e.g. Schedule Update for Raga Yaman Masterclass"
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-heading mb-1">
                          Notification Body *
                        </label>
                        <textarea
                          rows={4}
                          value={commMessage}
                          onChange={(e) => setCommMessage(e.target.value)}
                          required
                          placeholder="Write message details for the student..."
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C] resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingComm || !commTitle.trim() || !commMessage.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#3C096C]/90 text-white font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 shadow-xs"
                      >
                        {isSendingComm ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Delivering Notification...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Notification</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Right Column: Delivered Notifications History */}
                <div className="lg:col-span-6 space-y-5">
                  <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-base font-bold text-heading">
                        Delivery History
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#3C096C] text-xs font-bold font-numeric border border-purple-100">
                        {selectedStudent.notifications.length} delivered
                      </span>
                    </div>

                    {selectedStudent.notifications.length === 0 ? (
                      <div className="p-8 rounded-xl bg-neutral-50 text-center space-y-2">
                        <Bell className="w-6 h-6 text-body/40 mx-auto" />
                        <div className="font-bold text-heading text-xs">No communications sent yet</div>
                        <p className="text-[11px] text-body/60">
                          When notifications or announcements are delivered, they will be archived here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {selectedStudent.notifications.map((n) => (
                          <div
                            key={n.id}
                            className="p-3.5 rounded-xl border border-neutral-200/70 bg-white hover:border-[#3C096C]/30 transition-colors space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-bold text-heading text-xs">
                                {n.title}
                              </div>
                              <span className="px-2 py-0.5 rounded bg-purple-50 text-[#3C096C] text-[10px] font-bold shrink-0">
                                {n.type}
                              </span>
                            </div>
                            <p className="text-xs text-body/70 whitespace-pre-wrap">
                              {n.message}
                            </p>
                            <div className="text-[10px] text-body/50 font-numeric pt-1 border-t border-neutral-100">
                              Delivered on {new Date(n.createdAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })} at {new Date(n.createdAt).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} IST
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 6: TIMELINE (LIFECYCLE AUDIT TRAIL) ──────────────── */}
            {activeTab === "TIMELINE" && (
              <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-heading">
                      Student Lifecycle Timeline
                    </h3>
                    <p className="text-xs text-body/60 mt-0.5">
                      Auditable chronological record of all interactions and status changes for {selectedStudent.name}
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                    {[
                      { id: "ALL", label: "All Events" },
                      { id: "LESSON", label: "Classes" },
                      { id: "PAYMENT", label: "Payments" },
                      { id: "RESOURCE", label: "Materials" },
                      { id: "ENROLLMENT", label: "Enrollments" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setTimelineFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 whitespace-nowrap ${timelineFilter === f.id
                            ? "bg-[#3C096C] text-white shadow-2xs"
                            : "bg-neutral-100 hover:bg-neutral-200/70 text-body"
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTimelineEvents.length === 0 ? (
                  <div className="p-12 text-center text-xs text-body/60">
                    No events match the selected timeline filter.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-purple-100">
                    {filteredTimelineEvents.map((ev) => (
                      <div key={ev.id} className="relative group">
                        {/* Timeline node icon / ring */}
                        <div className={`absolute -left-[27px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white ${ev.type === "PAYMENT"
                            ? "bg-emerald-600 text-white"
                            : ev.type === "LESSON"
                              ? "bg-[#3C096C] text-white"
                              : ev.type === "RESOURCE"
                                ? "bg-sky-600 text-white"
                                : ev.type === "ENROLLMENT"
                                  ? "bg-indigo-600 text-white"
                                  : "bg-neutral-800 text-white"
                          }`}>
                          {ev.type === "PAYMENT" && <IndianRupee className="w-3 h-3" />}
                          {ev.type === "LESSON" && <Calendar className="w-3 h-3" />}
                          {ev.type === "RESOURCE" && <FileText className="w-3 h-3" />}
                          {ev.type === "ENROLLMENT" && <BookOpen className="w-3 h-3" />}
                          {ev.type === "SIGNUP" && <UserCheck className="w-3 h-3" />}
                          {ev.type === "TRIAL" && <Music className="w-3 h-3" />}
                          {ev.type === "COMMUNICATION" && <Bell className="w-3 h-3" />}
                        </div>

                        <div className="bg-neutral-50/60 hover:bg-neutral-50 rounded-xl p-4 border border-neutral-100 transition-colors space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-heading text-xs">
                              {ev.title}
                            </span>
                            <span className="text-[11px] font-numeric text-body/50">
                              {ev.date}
                            </span>
                          </div>
                          {ev.description && (
                            <p className="text-xs text-body/70 mt-0.5">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 7: CHAT LOGS (STUDENT-TEACHER ARCHIVE & DOWNLOAD) ─── */}
            {activeTab === "CHAT_LOGS" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header & Quick Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-neutral-200/80 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-serif text-lg font-bold text-heading">
                        Student-Teacher Chat Logs
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-[#3C096C] text-xs font-bold font-numeric border border-purple-100">
                        {selectedStudent.conversations?.length || 0} Faculty Threads
                      </span>
                    </div>
                    <p className="text-xs text-body/60 mt-0.5">
                      Supervise, inspect, and export verified communication logs between {selectedStudent.name} and academy faculty.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadAllChatLogs}
                      disabled={!selectedStudent.conversations || selectedStudent.conversations.length === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#3C096C]/90 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download All Chat Logs (.txt)</span>
                    </button>
                  </div>
                </div>

                {/* If viewing a single conversation transcript */}
                {selectedPreviewConvId ? (
                  (() => {
                    const activeConv = selectedStudent.conversations?.find(
                      (c) => c.id === selectedPreviewConvId
                    );
                    if (!activeConv) return null;
                    return (
                      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden space-y-4">
                        {/* Conversation Header */}
                        <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedPreviewConvId(null)}
                              className="px-2.5 py-1.5 rounded-xl border border-neutral-200 hover:bg-white text-xs font-semibold text-heading transition-all active:scale-95"
                            >
                              ← Back to Threads
                            </button>
                            <div>
                              <h4 className="font-bold text-heading text-sm">
                                {activeConv.teacherName}
                              </h4>
                              <p className="text-xs text-body/60">
                                {activeConv.teacherEmail} · {activeConv.instrument || "Curriculum"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownloadSingleChatLog(activeConv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3C096C] text-white text-xs font-semibold hover:bg-[#3C096C]/90 transition-all active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download This Transcript (.txt)</span>
                          </button>
                        </div>

                        {/* Transcript Bubble Stream */}
                        <div className="p-4 sm:p-6 space-y-3 max-h-[550px] overflow-y-auto">
                          {activeConv.messages.length === 0 ? (
                            <div className="p-8 text-center text-xs text-body/60">
                              No messages recorded in this conversation yet.
                            </div>
                          ) : (
                            activeConv.messages.map((msg) => {
                              const isStudent = msg.senderId === selectedStudent.id;
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col ${isStudent ? "items-end" : "items-start"
                                    }`}
                                >
                                  <div className="flex items-center gap-1.5 text-[10px] text-body/50 mb-1 px-1">
                                    <span className="font-semibold text-heading">
                                      {msg.senderName}
                                    </span>
                                    <span>({msg.senderRole})</span>
                                    <span>·</span>
                                    <span className="font-numeric">
                                      {new Date(msg.createdAt).toLocaleTimeString("en-GB", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <div
                                    className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs space-y-1.5 ${isStudent
                                        ? "bg-[#3C096C] text-white rounded-br-xs"
                                        : "bg-neutral-100 text-heading rounded-bl-xs"
                                      }`}
                                  >
                                    {msg.body && (
                                      <p className="whitespace-pre-wrap leading-relaxed">
                                        {msg.body}
                                      </p>
                                    )}
                                    {msg.fileName && (
                                      <div
                                        className={`p-2 rounded-xl text-xs flex items-center gap-2 ${isStudent
                                            ? "bg-white/10 text-white"
                                            : "bg-white text-heading border border-neutral-200"
                                          }`}
                                      >
                                        <FileText className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate font-medium">
                                          {msg.fileName}
                                        </span>
                                        {msg.fileUrl && (
                                          <a
                                            href={msg.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline text-[11px] shrink-0 ml-auto"
                                          >
                                            View
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* Conversation Threads Grid */
                  <div>
                    {!selectedStudent.conversations || selectedStudent.conversations.length === 0 ? (
                      <div className="p-12 rounded-2xl bg-white border border-dashed border-neutral-200 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#3C096C] flex items-center justify-center mx-auto">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-serif text-base font-bold text-heading">
                            No Chat Logs Available
                          </div>
                          <p className="text-xs text-body/60 mt-1 max-w-sm mx-auto">
                            No direct messages have been exchanged between {selectedStudent.name} and their assigned faculty members yet.
                          </p>
                        </div>
                        <div className="p-3 max-w-md mx-auto rounded-xl bg-neutral-50 border border-neutral-100 text-[11px] text-body/70 text-left">
                          <span className="font-semibold text-heading">Administrative Notice:</span> When teachers or students exchange learning queries, practice reviews, or feedback via the student-teacher messaging portal, their conversations will be continuously logged and exportable here for audit and compliance.
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedStudent.conversations.map((conv) => {
                          const lastMsg = conv.messages[conv.messages.length - 1];
                          return (
                            <div
                              key={conv.id}
                              className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 flex flex-col justify-between hover:border-[#3C096C]/30 transition-all space-y-4"
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#3C096C] flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100">
                                      {getInitials(conv.teacherName)}
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-heading text-sm">
                                        {conv.teacherName}
                                      </h4>
                                      <p className="text-xs text-body/60 mt-0.5">
                                        {conv.teacherEmail}
                                      </p>
                                    </div>
                                  </div>

                                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#3C096C] text-[11px] font-bold border border-purple-100 shrink-0 font-numeric">
                                    {conv.messages.length} msgs
                                  </span>
                                </div>

                                <div className="p-3 rounded-xl bg-neutral-50/70 border border-neutral-100 text-xs space-y-1">
                                  <div className="text-[10px] text-body/50 font-medium">
                                    Discipline / Instrument
                                  </div>
                                  <div className="font-semibold text-heading">
                                    {conv.instrument || "Curriculum & General Lessons"}
                                  </div>
                                </div>

                                {lastMsg && (
                                  <div className="text-xs text-body/70">
                                    <span className="font-semibold text-heading">
                                      Last message:
                                    </span>{" "}
                                    <span className="line-clamp-1 italic">
                                      &ldquo;{lastMsg.body || (lastMsg.fileName ? `[Attachment: ${lastMsg.fileName}]` : "—")}&rdquo;
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-3 border-t border-neutral-100 text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSingleChatLog(conv)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#3C096C] hover:bg-[#3C096C]/90 text-white font-semibold transition-all active:scale-95 shadow-2xs"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download Log (.txt)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSelectedPreviewConvId(conv.id)}
                                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-heading font-semibold transition-all active:scale-95"
                                >
                                  <span>View Transcript</span>
                                </button>
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
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-2xl border border-neutral-200/80 p-12 text-center text-body/60 text-sm">
            Select a student from the directory to view complete details.
          </div>
        )}
      </div>

      {/* ─── MODAL 1: ADD STUDENT MODAL ──────────────────────────────────── */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="font-serif text-lg font-bold text-heading">Add new student</h3>
              <button
                type="button"
                onClick={() => setIsAddStudentOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-body"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await createStudentAction({
                    name: String(formData.get("name")),
                    email: String(formData.get("email")),
                    phone: String(formData.get("phone")),
                    age: formData.get("age") ? Number(formData.get("age")) : undefined,
                    gender: String(formData.get("gender") || ""),
                    guardianName: String(formData.get("guardianName") || ""),
                    guardianPhone: String(formData.get("guardianPhone") || ""),
                    country: String(formData.get("country") || "India"),
                  });
                  if (res.success) {
                    showToast(res.message || "Student created successfully.");
                    setIsAddStudentOpen(false);
                  } else {
                    alert(res.error || "Failed to create student.");
                  }
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-heading mb-1">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-heading mb-1">Email *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-heading mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-heading mb-1">Age</label>
                  <input
                    type="number"
                    name="age"
                    min="4"
                    max="99"
                    placeholder="14"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-heading mb-1">Gender</label>
                  <select
                    name="gender"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-heading mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    name="guardianName"
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-heading mb-1">
                    Guardian Phone
                  </label>
                  <input
                    type="tel"
                    name="guardianPhone"
                    placeholder="+91 9988776655"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-body font-semibold hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#3C096C] text-white font-bold hover:bg-[#2F0755] transition-all flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: RECORD PAYMENT MODAL ───────────────────────────────── */}
      {isRecordPaymentOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="font-serif text-lg font-bold text-heading">Record payment</h3>
              <button
                type="button"
                onClick={() => setIsRecordPaymentOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-body"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await recordStudentPaymentAction({
                    studentId: selectedStudent.id,
                    amountRupees: Number(formData.get("amount")),
                    paymentMethod: formData.get("method") as any,
                    referenceId: String(formData.get("reference") || ""),
                  });
                  if (res.success) {
                    showToast(res.message || "Payment recorded.");
                    setIsRecordPaymentOpen(false);
                  } else {
                    alert(res.error || "Failed to record payment.");
                  }
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-heading mb-1">Student</label>
                <div className="p-2.5 rounded-xl bg-neutral-50 text-heading font-medium">
                  {selectedStudent.name} ({selectedStudent.email})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-heading mb-1">Amount (INR) *</label>
                <input
                  type="number"
                  name="amount"
                  required
                  min="1"
                  placeholder="6500"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                />
              </div>

              <div>
                <label className="block font-semibold text-heading mb-1">Payment Method</label>
                <select
                  name="method"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                >
                  <option value="UPI">UPI</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="NETBANKING">Net Banking</option>
                  <option value="BANK_TRANSFER">Bank Wire / IMPS</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-heading mb-1">
                  Reference / Receipt Number
                </label>
                <input
                  type="text"
                  name="reference"
                  placeholder="RCPT-8621"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-body font-semibold hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#3C096C] text-white font-bold hover:bg-[#2F0755] transition-all flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save transaction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: SCHEDULE CLASS MODAL ───────────────────────────────── */}
      {isScheduleClassOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="font-serif text-lg font-bold text-heading">Schedule class</h3>
              <button
                type="button"
                onClick={() => setIsScheduleClassOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-body"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await scheduleStudentLessonAction({
                    studentId: selectedStudent.id,
                    teacherId: String(formData.get("teacherId")),
                    instrument: String(formData.get("instrument") || "Hindustani Vocal"),
                    startsAtIso: new Date(String(formData.get("datetime"))).toISOString(),
                    durationMinutes: Number(formData.get("duration") || 60),
                  });
                  if (res.success) {
                    showToast(res.message || "Class scheduled.");
                    setIsScheduleClassOpen(false);
                  } else {
                    alert(res.error || "Failed to schedule class.");
                  }
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-heading mb-1">Faculty Teacher *</label>
                <select
                  name="teacherId"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-heading mb-1">Instrument / Subject</label>
                <input
                  type="text"
                  name="instrument"
                  defaultValue="Hindustani Vocal"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                />
              </div>

              <div>
                <label className="block font-semibold text-heading mb-1">Date & Time *</label>
                <DateTimePicker
                  name="datetime"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleClassOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-body font-semibold hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#3C096C] text-white font-bold hover:bg-[#2F0755] transition-all flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm session</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: CREATE ENROLLMENT MODAL ────────────────────────────── */}
      {isCreateEnrollmentOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="font-serif text-lg font-bold text-heading">Enroll in course</h3>
              <button
                type="button"
                onClick={() => setIsCreateEnrollmentOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-body"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await createStudentEnrollmentAction({
                    studentId: selectedStudent.id,
                    courseId: String(formData.get("courseId")),
                    teacherId: String(formData.get("teacherId") || ""),
                    sessionsRemaining: formData.get("sessions")
                      ? Number(formData.get("sessions"))
                      : undefined,
                  });
                  if (res.success) {
                    showToast(res.message || "Enrolled successfully.");
                    setIsCreateEnrollmentOpen(false);
                  } else {
                    alert(res.error || "Failed to create enrollment.");
                  }
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-heading mb-1">Select Course *</label>
                <select
                  name="courseId"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.level} · {c.sessionCount} sessions)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-heading mb-1">Allot Faculty Teacher</label>
                <select
                  name="teacherId"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                >
                  <option value="">Choose teacher (or allot later)</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-heading mb-1">
                  Sessions Granted (default: course total)
                </label>
                <input
                  type="number"
                  name="sessions"
                  placeholder="e.g. 24"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-heading focus:outline-none focus:border-[#3C096C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreateEnrollmentOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-body font-semibold hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#3C096C] text-white font-bold hover:bg-[#2F0755] transition-all flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enroll student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: QUICK MESSAGE MODAL ────────────────────────────────── */}
      {isMessageOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="font-serif text-lg font-bold text-heading">
                Message {selectedStudent.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsMessageOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-body"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-body/70">
                Reach out to {selectedStudent.name} via email or phone:
              </p>
              <div className="space-y-2">
                <a
                  href={`mailto:${selectedStudent.email}`}
                  className="p-3 rounded-xl border border-neutral-200 hover:bg-purple-50 flex items-center gap-2.5 text-heading font-medium transition-colors"
                >
                  <Mail className="w-4 h-4 text-[#3C096C]" />
                  <span>Send Email ({selectedStudent.email})</span>
                </a>
                {selectedStudent.phone && (
                  <a
                    href={`https://wa.me/${selectedStudent.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-neutral-200 hover:bg-emerald-50 flex items-center gap-2.5 text-heading font-medium transition-colors"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Open WhatsApp ({selectedStudent.phone})</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsMessageOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-body font-semibold hover:bg-neutral-50 text-xs"
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
