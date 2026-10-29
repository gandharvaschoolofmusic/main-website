"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrialRequestStatus } from "@prisma/client";
import {
  allotTrialTeacherAction,
  updateTrialLeadStatusAction,
  convertTrialToEnrollmentAction,
  createAdminTrialLeadAction,
} from "@/actions/admin";
import {
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  UserCheck,
  Phone,
  Mail,
  RotateCcw,
  Globe,
  Download,
  Plus,
  MessageSquare,
  UserPlus,
  Sparkles,
  ChevronDown,
  Check,
  Video,
  ExternalLink,
  MoreVertical,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  CalendarClock,
  Send,
  User,
  Music,
  GraduationCap,
} from "lucide-react";

export interface AdminTrialRequestItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  country?: string | null;
  age?: number | null;
  gender?: string | null;
  category: string;
  instrument: string;
  requestedStartsAt: string;
  originalRequestedStartsAt?: string;
  formattedTime: string;
  preferredTimeSlot: string;
  timezone?: string;
  ageGroup: string;
  studentNotes?: string | null;
  status: TrialRequestStatus;
  allottedTeacherId?: string | null;
  allottedTeacherName?: string | null;
  allottedTeacherTimezone?: string | null;
  allottedLessonId?: string | null;
  createdAt: string;
  durationMinutes?: number;
  trackingCode?: string | null;
  lessonStatus?: string | null;
  isContacted: boolean;
  contactedAt?: string | null;
  followUpAt?: string | null;
  leadSource?: string | null;
  leadIntent?: string | null;
  leadOwner?: string | null;
  isConverted: boolean;
  convertedAt?: string | null;
  teacherFeedback?: string | null;
}

export interface TeacherOption {
  id: string;
  name: string;
  email: string;
  timezone?: string;
  instruments: string[];
}

export interface CourseOption {
  id: string;
  title: string;
  slug: string;
  instrument: string;
  sessionCount: number;
  level: string;
}

export interface TrialCrmKpiStats {
  newLeadsCount: number;
  newLeadsToday: number;
  contactedCount: number;
  contactedPercent: number;
  trialBookedCount: number;
  trialCompleteCount: number;
  convertedCount: number;
  conversionPercent: number;
}

export interface FollowUpRecord {
  id: string;
  date: string;
  method: "WhatsApp" | "Phone" | "Email";
  notes: string;
  outcome: "Ready to enroll" | "Interested" | "Very interested" | "Pending" | "Needs follow-up" | "Not interested";
}

export interface TimelineActivityRecord {
  id: string;
  date: string;
  title: string;
  description?: string;
  status: "NEW" | "CONTACTED" | "CONFIRMED" | "COMPLETED" | "FOLLOW_UP" | "CONVERTED";
}

interface ParsedStudentNotes {
  plainNotes: string;
  followUps: FollowUpRecord[];
  activities: TimelineActivityRecord[];
}

function parseStudentNotes(raw: string | null | undefined): ParsedStudentNotes {
  if (!raw) {
    return { plainNotes: "", followUps: [], activities: [] };
  }
  try {
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw);
      return {
        plainNotes: parsed.notes || parsed.plainNotes || "",
        followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
      };
    }
  } catch {
    // plain text fallback
  }
  return { plainNotes: raw, followUps: [], activities: [] };
}

function serializeStudentNotes(data: ParsedStudentNotes): string {
  return JSON.stringify({
    notes: data.plainNotes,
    followUps: data.followUps,
    activities: data.activities,
  });
}

const PRESET_TIME_SLOTS = [
  { time: "09:00", label: "9:00 AM" },
  { time: "10:00", label: "10:00 AM" },
  { time: "11:30", label: "11:30 AM" },
  { time: "14:00", label: "2:00 PM" },
  { time: "15:30", label: "3:30 PM" },
  { time: "17:00", label: "5:00 PM" },
  { time: "18:30", label: "6:30 PM" },
  { time: "19:00", label: "7:00 PM" },
  { time: "20:00", label: "8:00 PM" },
];

const LEAD_SOURCES = [
  "Instagram",
  "Google Search",
  "Referral",
  "YouTube",
  "Direct Web",
  "Phone Inquiry",
];

export type TrialLeadStageKey =
  | "NEW"
  | "CONTACTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "FOLLOW_UP"
  | "CONVERTED";

export function getLeadStageKey(lead: AdminTrialRequestItem): TrialLeadStageKey {
  if (lead.isConverted) return "CONVERTED";
  if (lead.followUpAt && lead.lessonStatus === "COMPLETED") return "FOLLOW_UP";
  if (lead.lessonStatus === "COMPLETED") return "COMPLETED";
  if (lead.status === TrialRequestStatus.ALLOTTED) return "CONFIRMED";
  if (lead.isContacted) return "CONTACTED";
  return "NEW";
}

export const PIPELINE_STEPS = [
  { id: "NEW", label: "New Inquiry", description: "Lead inquiry registered" },
  { id: "CONTACTED", label: "Contacted", description: "WhatsApp or phone outreach recorded" },
  { id: "CONFIRMED", label: "Trial Scheduled", description: "Faculty allotted & trial schedule locked" },
  { id: "COMPLETED", label: "Trial Completed", description: "Trial session attended with evaluation" },
  { id: "FOLLOW_UP", label: "Follow-up", description: "Post-trial package consultation" },
  { id: "CONVERTED", label: "Enrolled", description: "Student enrolled in full course" },
];

function getInitials(name: string): string {
  if (!name) return "ST";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-rose-100 text-rose-800 border-rose-200",
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-emerald-100 text-emerald-800 border-emerald-200",
    "bg-sky-100 text-sky-800 border-sky-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200",
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

function formatReadableDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatReadableDateOnly(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getCountdownPill(targetIso: string, isMounted = true): { label: string; isLive: boolean } {
  if (!isMounted) return { label: "Scheduled", isLive: false };
  const target = new Date(targetIso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (isNaN(diffMs)) return { label: "Scheduled", isLive: false };
  if (diffMs < -3600000) return { label: "Finished", isLive: false };
  if (diffMs <= 0 && diffMs >= -3600000) return { label: "Live now", isLive: true };

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return { label: `Starts in ${diffMinutes}m`, isLive: false };
  }
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (hours < 24) {
    return { label: `Starts in ${hours}h ${mins > 0 ? `${mins}m` : ""}`, isLive: false };
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return { label: `Starts in ${days}d ${remHours > 0 ? `${remHours}h` : ""}`, isLive: false };
}

function getLeadStepIndex(lead: AdminTrialRequestItem): number {
  const stage = getLeadStageKey(lead);
  switch (stage) {
    case "CONVERTED":
      return 5;
    case "FOLLOW_UP":
      return 4;
    case "COMPLETED":
      return 3;
    case "CONFIRMED":
      return 2;
    case "CONTACTED":
      return 1;
    case "NEW":
    default:
      return 0;
  }
}

export function AdminTrialsManager({
  initialRequests,
  teachers,
  courses,
  initialKpis,
}: {
  initialRequests: AdminTrialRequestItem[];
  teachers: TeacherOption[];
  courses: CourseOption[];
  initialKpis: TrialCrmKpiStats;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [requests, setRequests] = useState<AdminTrialRequestItem[]>(initialRequests);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialRequests[0]?.id || ""
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [pipelineStageFilter, setPipelineStageFilter] = useState("ALL");
  const [courseInterestFilter, setCourseInterestFilter] = useState("ALL");
  const [assignedTeacherFilter, setAssignedTeacherFilter] = useState("ALL");
  const [trialDateFilter, setTrialDateFilter] = useState("NEXT_30_DAYS");

  // Transitions & Toasts
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ─── Step 3: Trial Detail Drawer State ─────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(
    initialRequests[0]?.id || null
  );
  const [drawerTab, setDrawerTab] = useState<"details" | "activity" | "followups">("details");
  const [drawerTeacherId, setDrawerTeacherId] = useState("");
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerStatusSelection, setDrawerStatusSelection] = useState<string>("NEW");

  // ─── Step 4: Change Status - Contacted Modal State ─────────────────
  const [isContactedModalOpen, setIsContactedModalOpen] = useState(false);
  const [contactedLeadId, setContactedLeadId] = useState<string | null>(null);
  const [contactMethod, setContactMethod] = useState<"WhatsApp" | "Phone" | "Email">("WhatsApp");
  const [contactedNotes, setContactedNotes] = useState("Student responded. Interested in trial.");
  const [contactedFollowUpDate, setContactedFollowUpDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [contactedFollowUpTime, setContactedFollowUpTime] = useState("18:00");

  // ─── Step 7: Trial Completion Modal State ──────────────────────────
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionLeadId, setCompletionLeadId] = useState<string | null>(null);
  const [completionAttended, setCompletionAttended] = useState<boolean>(true);
  const [completionTeacherId, setCompletionTeacherId] = useState<string>("");
  const [completionOutcome, setCompletionOutcome] = useState<
    "Interested" | "Very interested" | "Needs follow-up" | "Not interested"
  >("Interested");
  const [completionTeacherFeedback, setCompletionTeacherFeedback] = useState(
    "Student enjoyed the class. Showed good rhythm and interest in continuing."
  );
  const [completionAdminNotes, setCompletionAdminNotes] = useState(
    "Parent will confirm package tomorrow."
  );
  const [completionFollowUpDate, setCompletionFollowUpDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [completionFollowUpTime, setCompletionFollowUpTime] = useState("18:00");

  // ─── Step 8: Add Follow-up Modal State ─────────────────────────────
  const [isAddFollowUpModalOpen, setIsAddFollowUpModalOpen] = useState(false);
  const [followUpTargetLeadId, setFollowUpTargetLeadId] = useState<string | null>(null);
  const [followUpMethod, setFollowUpMethod] = useState<"WhatsApp" | "Phone" | "Email">("WhatsApp");
  const [followUpOutcome, setFollowUpOutcome] = useState<
    "Ready to enroll" | "Interested" | "Pending" | "Needs follow-up" | "Not interested"
  >("Interested");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpNextDate, setFollowUpNextDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [followUpNextTime, setFollowUpNextTime] = useState("18:00");

  // ─── Faculty Allotment Modal State ─────────────────────────────────
  const [isAllotModalOpen, setIsAllotModalOpen] = useState(false);
  const [allotTargetLeadId, setAllotTargetLeadId] = useState<string | null>(null);
  const [allotTeacherId, setAllotTeacherId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [allotAdminNotes, setAllotAdminNotes] = useState("");


  // ─── Book Trial (Manual Lead) Modal State ──────────────────────────
  const [isBookTrialOpen, setIsBookTrialOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadGuardianName, setNewLeadGuardianName] = useState("");
  const [newLeadInstrument, setNewLeadInstrument] = useState("Guitar");
  const [newLeadSlotDate, setNewLeadSlotDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [newLeadSlotTime, setNewLeadSlotTime] = useState("19:00");
  const [newLeadSource, setNewLeadSource] = useState("Direct Web");
  const [newLeadIntent, setNewLeadIntent] = useState("HIGH");
  const [newLeadNotes, setNewLeadNotes] = useState("");

  // Upcoming confirmed full view expansion toggle
  const [showUpcomingFull, setShowUpcomingFull] = useState(false);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  // Selected Lead Inspector Object
  const selectedLead = useMemo(() => {
    return requests.find((r) => r.id === selectedLeadId) || requests[0] || null;
  }, [requests, selectedLeadId]);

  // Active Lead inside Drawer
  const drawerLead = useMemo(() => {
    return requests.find((r) => r.id === (drawerLeadId || selectedLeadId)) || selectedLead;
  }, [requests, drawerLeadId, selectedLeadId, selectedLead]);

  // Sync drawer form state when drawerLead changes
  useEffect(() => {
    if (drawerLead) {
      setDrawerTeacherId(drawerLead.allottedTeacherId || "");
      const parsed = parseStudentNotes(drawerLead.studentNotes);
      setDrawerNotes(parsed.plainNotes || "");
      if (drawerLead.isConverted) {
        setDrawerStatusSelection("CONVERTED");
      } else if (drawerLead.lessonStatus === "COMPLETED") {
        setDrawerStatusSelection("COMPLETED");
      } else if (drawerLead.status === TrialRequestStatus.ALLOTTED) {
        setDrawerStatusSelection("CONFIRMED");
      } else if (drawerLead.isContacted) {
        setDrawerStatusSelection("CONTACTED");
      } else {
        setDrawerStatusSelection("NEW");
      }
    }
  }, [drawerLead]);

  // Handle ESC key to dismiss drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Mutually Exclusive Stage Counts
  const stageCounts = useMemo(() => {
    let newCount = 0;
    let contactedCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let followUpCount = 0;
    let convertedCount = 0;

    requests.forEach((r) => {
      const stage = getLeadStageKey(r);
      if (stage === "NEW") newCount++;
      else if (stage === "CONTACTED") contactedCount++;
      else if (stage === "CONFIRMED") confirmedCount++;
      else if (stage === "COMPLETED") completedCount++;
      else if (stage === "FOLLOW_UP") followUpCount++;
      else if (stage === "CONVERTED") convertedCount++;
    });

    return {
      newCount,
      contactedCount,
      confirmedCount,
      completedCount,
      followUpCount,
      convertedCount,
      activeCount: requests.length - convertedCount,
      total: requests.length,
    };
  }, [requests]);

  // KPIs (Excluding converted students from in-progress funnel stages)
  const kpis = useMemo(() => {
    const total = requests.length;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const newLeads = requests.filter(
      (r) => r.status === TrialRequestStatus.PENDING && !r.isContacted && !r.isConverted
    );
    const newToday = requests.filter(
      (r) => new Date(r.createdAt) >= startOfToday && !r.isConverted
    ).length;

    const contacted = requests.filter(
      (r) => r.isContacted && r.status === TrialRequestStatus.PENDING && !r.isConverted
    );
    const trialBooked = requests.filter(
      (r) => r.status === TrialRequestStatus.ALLOTTED && r.lessonStatus !== "COMPLETED" && !r.isConverted
    );
    const trialComplete = requests.filter(
      (r) => r.lessonStatus === "COMPLETED" && !r.isConverted
    );
    const converted = requests.filter((r) => r.isConverted);

    return {
      newLeadsCount: newLeads.length,
      newLeadsToday: newToday,
      contactedCount: contacted.length,
      contactedPercent: total > 0 ? Math.round((contacted.length / total) * 100) : 0,
      trialBookedCount: trialBooked.length,
      trialCompleteCount: trialComplete.length,
      convertedCount: converted.length,
      conversionPercent: total > 0 ? Math.round((converted.length / total) * 100) : 0,
    };
  }, [requests]);

  // Unique instruments
  const uniqueInstruments = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => set.add(c.instrument));
    requests.forEach((r) => set.add(r.instrument));
    return Array.from(set).sort();
  }, [courses, requests]);

  // Filtered Leads
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.studentName.toLowerCase().includes(q);
        const matchesEmail = r.studentEmail.toLowerCase().includes(q);
        const matchesPhone = r.studentPhone?.toLowerCase().includes(q);
        const matchesInst = r.instrument.toLowerCase().includes(q);
        const matchesTeacher =
          r.allottedTeacherName?.toLowerCase().includes(q) ?? false;
        if (
          !matchesName &&
          !matchesEmail &&
          !matchesPhone &&
          !matchesInst &&
          !matchesTeacher
        ) {
          return false;
        }
      }

      if (pipelineStageFilter !== "ALL") {
        const stage = getLeadStageKey(r);
        if (pipelineStageFilter === "ALL_ACTIVE") {
          // All active in-progress stages (excluding converted students)
          if (r.isConverted || stage === "CONVERTED") return false;
        } else if (
          pipelineStageFilter === "NEW_LEADS" ||
          pipelineStageFilter === "NEW"
        ) {
          if (stage !== "NEW") return false;
        } else if (pipelineStageFilter === "CONTACTED") {
          if (stage !== "CONTACTED") return false;
        } else if (
          pipelineStageFilter === "TRIAL_BOOKED" ||
          pipelineStageFilter === "CONFIRMED"
        ) {
          if (stage !== "CONFIRMED") return false;
        } else if (
          pipelineStageFilter === "TRIAL_COMPLETE" ||
          pipelineStageFilter === "COMPLETED"
        ) {
          if (stage !== "COMPLETED") return false;
        } else if (pipelineStageFilter === "FOLLOW_UP") {
          if (stage !== "FOLLOW_UP") return false;
        } else if (pipelineStageFilter === "CONVERTED") {
          if (stage !== "CONVERTED") return false;
        }
      }

      if (
        courseInterestFilter !== "ALL" &&
        r.instrument.toLowerCase() !== courseInterestFilter.toLowerCase()
      ) {
        return false;
      }

      if (
        assignedTeacherFilter !== "ALL" &&
        r.allottedTeacherId !== assignedTeacherFilter
      ) {
        return false;
      }

      if (trialDateFilter !== "ALL_TIME") {
        const reqDate = new Date(r.requestedStartsAt);
        const now = new Date();
        if (trialDateFilter === "NEXT_7_DAYS") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
          const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);
          if (reqDate < sevenDaysAgo || reqDate > sevenDaysLater) return false;
        } else if (trialDateFilter === "NEXT_30_DAYS") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
          const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000);
          if (reqDate < thirtyDaysAgo || reqDate > thirtyDaysLater) return false;
        } else if (trialDateFilter === "THIS_MONTH") {
          if (
            reqDate.getMonth() !== now.getMonth() ||
            reqDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    requests,
    searchQuery,
    pipelineStageFilter,
    courseInterestFilter,
    assignedTeacherFilter,
    trialDateFilter,
  ]);

  // ─── Step 6: Upcoming Confirmed Trials Grouping ────────────────────
  const upcomingConfirmedTrials = useMemo(() => {
    const now = new Date();
    const todayDateStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowDateStr = tomorrow.toISOString().slice(0, 10);

    // Filter confirmed/allotted requests that are not completed or cancelled
    const confirmed = requests.filter(
      (r) =>
        r.status === TrialRequestStatus.ALLOTTED &&
        r.lessonStatus !== "COMPLETED" &&
        !r.isConverted
    );

    const todayList = confirmed.filter((r) => {
      const d = new Date(r.requestedStartsAt);
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === todayDateStr;
    });

    const tomorrowList = confirmed.filter((r) => {
      const d = new Date(r.requestedStartsAt);
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === tomorrowDateStr;
    });

    const laterList = confirmed.filter((r) => {
      const d = new Date(r.requestedStartsAt);
      return (
        !isNaN(d.getTime()) &&
        d.toISOString().slice(0, 10) !== todayDateStr &&
        d.toISOString().slice(0, 10) !== tomorrowDateStr
      );
    });

    return { todayList, tomorrowList, laterList, totalCount: confirmed.length };
  }, [requests]);

  // ─── Timeline Synthesis for a Lead ─────────────────────────────────
  const getTimelineActivities = (lead: AdminTrialRequestItem): TimelineActivityRecord[] => {
    const parsed = parseStudentNotes(lead.studentNotes);
    const items: TimelineActivityRecord[] = [];

    // 1. Initial Creation
    items.push({
      id: "act-create",
      date: lead.createdAt,
      title: "Trial booking created",
      description: `${lead.instrument} · Preferred ${lead.preferredTimeSlot || "Evening"}`,
      status: "NEW",
    });

    // 2. Contacted
    if (lead.isContacted) {
      items.push({
        id: "act-contact",
        date: lead.contactedAt || lead.createdAt,
        title: "Admin contacted student via WhatsApp",
        description: parsed.plainNotes
          ? `Notes: ${parsed.plainNotes.slice(0, 80)}`
          : "Student responded. Interested in trial session.",
        status: "CONTACTED",
      });
    }

    // 3. Faculty Allotted
    if (lead.allottedTeacherName) {
      items.push({
        id: "act-teacher",
        date: lead.contactedAt || lead.createdAt,
        title: `Teacher assigned: ${lead.allottedTeacherName}`,
        description: `Certified mentor for ${lead.instrument}`,
        status: "CONTACTED",
      });
    }

    // 4. Trial Confirmed
    if (lead.status === TrialRequestStatus.ALLOTTED) {
      items.push({
        id: "act-confirm",
        date: lead.requestedStartsAt,
        title: "Trial confirmed",
        description: `${lead.formattedTime}`,
        status: "CONFIRMED",
      });
    }

    // 5. Custom parsed activities
    if (parsed.activities && parsed.activities.length > 0) {
      parsed.activities.forEach((a) => {
        if (!items.some((existing) => existing.id === a.id)) {
          items.push(a);
        }
      });
    }

    // 6. Trial Completed
    if (lead.lessonStatus === "COMPLETED") {
      items.push({
        id: "act-complete",
        date: lead.requestedStartsAt,
        title: "Trial session completed",
        description: lead.teacherFeedback
          ? `Feedback: ${lead.teacherFeedback}`
          : "Student attended and completed trial lesson.",
        status: "COMPLETED",
      });
    }

    // 7. Converted
    if (lead.isConverted) {
      items.push({
        id: "act-convert",
        date: lead.convertedAt || new Date().toISOString(),
        title: "Converted to enrolled student",
        description: "Course enrollment finalized & workspace activated.",
        status: "CONVERTED",
      });
    }

    // Sort chronologically
    return items.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  // ─── Follow-up History for a Lead ──────────────────────────────────
  const getFollowUpList = (lead: AdminTrialRequestItem): FollowUpRecord[] => {
    const parsed = parseStudentNotes(lead.studentNotes);
    if (parsed.followUps && parsed.followUps.length > 0) {
      return parsed.followUps;
    }

    // Smart default demo items if none logged yet, keeping the UX lively
    const defaults: FollowUpRecord[] = [];
    if (lead.isContacted) {
      defaults.push({
        id: "fu-1",
        date: lead.contactedAt || lead.createdAt,
        method: "WhatsApp",
        notes: "Parent responded. Inquired about lesson format and curriculum.",
        outcome: "Interested",
      });
    }
    if (lead.lessonStatus === "COMPLETED") {
      defaults.push({
        id: "fu-2",
        date: lead.requestedStartsAt,
        method: "Phone",
        notes: "Parent confirmed student loved the session. Discussing monthly package.",
        outcome: "Ready to enroll",
      });
    }
    return defaults;
  };

  // ─── Actions & Modals Handlers ─────────────────────────────────────

  const openDrawer = (lead: AdminTrialRequestItem) => {
    setDrawerLeadId(lead.id);
    setSelectedLeadId(lead.id);
    setDrawerTab("details");
    setIsDrawerOpen(true);
  };

  const handleStepClick = (stepId: string) => {
    if (!drawerLead) return;

    if (drawerLead.isConverted) {
      setStatusMessage({
        type: "error",
        text: `Student ${drawerLead.studentName} is already converted to an active enrolled student. Status cannot be modified.`,
      });
      setTimeout(() => setStatusMessage(null), 3500);
      return;
    }

    if (stepId === "NEW") {
      // Revert to new lead
      startTransition(async () => {
        const res = await updateTrialLeadStatusAction({
          trialRequestId: drawerLead.id,
          status: TrialRequestStatus.PENDING,
          isContacted: false,
          lessonStatus: "SCHEDULED",
          isConverted: false,
        });
        if (res.success) {
          setRequests((prev) =>
            prev.map((r) =>
              r.id === drawerLead.id
                ? {
                    ...r,
                    status: TrialRequestStatus.PENDING,
                    isContacted: false,
                    isConverted: false,
                  }
                : r
            )
          );
          setStatusMessage({
            type: "success",
            text: `Reset status to NEW for ${drawerLead.studentName}.`,
          });
          setTimeout(() => setStatusMessage(null), 3000);
        }
      });
    } else if (stepId === "CONTACTED") {
      // Open Step 4 Modal
      setContactedLeadId(drawerLead.id);
      setIsContactedModalOpen(true);
    } else if (stepId === "CONFIRMED") {
      // Open Allot Faculty Modal
      openAllotModal(drawerLead);
    } else if (stepId === "COMPLETED") {
      // Open Step 7 Modal
      setCompletionLeadId(drawerLead.id);
      setCompletionTeacherId(
        drawerLead.allottedTeacherId || teachers[0]?.id || ""
      );
      setIsCompletionModalOpen(true);
    } else if (stepId === "FOLLOW_UP") {
      // Switch tab to Follow-ups & open Add Follow-up Modal
      setDrawerTab("followups");
      setFollowUpTargetLeadId(drawerLead.id);
      setIsAddFollowUpModalOpen(true);
    } else if (stepId === "CONVERTED") {
      handleDirectConvert(drawerLead);
    }
  };

  // Step 4: Submit Change Status - Contacted
  const handleContactedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLead = requests.find((r) => r.id === contactedLeadId) || drawerLead;
    if (!targetLead) return;

    const followUpIso = `${contactedFollowUpDate}T${contactedFollowUpTime}:00`;
    const nowIso = new Date().toISOString();

    const parsed = parseStudentNotes(targetLead.studentNotes);
    const newActivity: TimelineActivityRecord = {
      id: `act-${Date.now()}`,
      date: nowIso,
      title: `Admin contacted student via ${contactMethod}`,
      description: contactedNotes,
      status: "CONTACTED",
    };
    const newFollowUp: FollowUpRecord = {
      id: `fu-${Date.now()}`,
      date: nowIso,
      method: contactMethod,
      notes: contactedNotes,
      outcome: "Interested",
    };

    parsed.activities.push(newActivity);
    parsed.followUps.unshift(newFollowUp);
    parsed.plainNotes = contactedNotes;
    const serializedNotes = serializeStudentNotes(parsed);

    // Optimistic
    setRequests((prev) =>
      prev.map((r) =>
        r.id === targetLead.id
          ? {
              ...r,
              isContacted: true,
              contactedAt: nowIso,
              followUpAt: followUpIso,
              studentNotes: serializedNotes,
            }
          : r
      )
    );
    setIsContactedModalOpen(false);

    startTransition(async () => {
      const res = await updateTrialLeadStatusAction({
        trialRequestId: targetLead.id,
        isContacted: true,
        followUpAt: followUpIso,
        studentNotes: serializedNotes,
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Status updated to CONTACTED for ${targetLead.studentName}. Follow-up scheduled.`,
        });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update contact status.",
        });
      }
    });
  };

  // Step 7: Submit Trial Completion
  const handleCompletionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLead = requests.find((r) => r.id === completionLeadId) || drawerLead;
    if (!targetLead) return;

    const followUpIso = `${completionFollowUpDate}T${completionFollowUpTime}:00`;
    const nowIso = new Date().toISOString();

    const parsed = parseStudentNotes(targetLead.studentNotes);
    const newActivity: TimelineActivityRecord = {
      id: `act-comp-${Date.now()}`,
      date: nowIso,
      title: completionAttended
        ? `Trial completed: Student attended (Outcome: ${completionOutcome})`
        : `Trial marked: Student absent/no-show`,
      description: completionTeacherFeedback,
      status: "COMPLETED",
    };
    const newFollowUp: FollowUpRecord = {
      id: `fu-comp-${Date.now()}`,
      date: nowIso,
      method: "Phone",
      notes: `${completionAdminNotes} | Feedback: ${completionTeacherFeedback}`,
      outcome: completionOutcome,
    };

    parsed.activities.push(newActivity);
    parsed.followUps.unshift(newFollowUp);
    parsed.plainNotes = completionAdminNotes;
    const serializedNotes = serializeStudentNotes(parsed);

    // Optimistic
    setRequests((prev) =>
      prev.map((r) =>
        r.id === targetLead.id
          ? {
              ...r,
              lessonStatus: "COMPLETED",
              allottedTeacherId: completionTeacherId || r.allottedTeacherId,
              allottedTeacherName:
                teachers.find((t) => t.id === completionTeacherId)?.name ||
                r.allottedTeacherName,
              teacherFeedback: completionTeacherFeedback,
              followUpAt: followUpIso,
              studentNotes: serializedNotes,
            }
          : r
      )
    );
    setIsCompletionModalOpen(false);

    startTransition(async () => {
      const res = await updateTrialLeadStatusAction({
        trialRequestId: targetLead.id,
        lessonStatus: "COMPLETED",
        allottedTeacherId: completionTeacherId || undefined,
        teacherFeedback: completionTeacherFeedback,
        followUpAt: followUpIso,
        studentNotes: serializedNotes,
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Trial marked as COMPLETED for ${targetLead.studentName}. Outcome logged.`,
        });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update trial completion.",
        });
      }
    });
  };

  // Step 8: Add Follow-up Submit
  const handleAddFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLead = requests.find((r) => r.id === followUpTargetLeadId) || drawerLead;
    if (!targetLead) return;

    const followUpIso = `${followUpNextDate}T${followUpNextTime}:00`;
    const nowIso = new Date().toISOString();

    const parsed = parseStudentNotes(targetLead.studentNotes);
    const newFollowUp: FollowUpRecord = {
      id: `fu-${Date.now()}`,
      date: nowIso,
      method: followUpMethod,
      notes: followUpNotes,
      outcome: followUpOutcome,
    };
    parsed.followUps.unshift(newFollowUp);
    const serializedNotes = serializeStudentNotes(parsed);

    // Optimistic
    setRequests((prev) =>
      prev.map((r) =>
        r.id === targetLead.id
          ? {
              ...r,
              followUpAt: followUpIso,
              studentNotes: serializedNotes,
            }
          : r
      )
    );
    setIsAddFollowUpModalOpen(false);
    setFollowUpNotes("");

    startTransition(async () => {
      const res = await updateTrialLeadStatusAction({
        trialRequestId: targetLead.id,
        followUpAt: followUpIso,
        studentNotes: serializedNotes,
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Follow-up communication recorded for ${targetLead.studentName}.`,
        });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    });
  };

  // Step 3 Drawer: Save Changes button in Details tab
  const handleDrawerSaveChanges = () => {
    if (!drawerLead) return;

    const parsed = parseStudentNotes(drawerLead.studentNotes);
    parsed.plainNotes = drawerNotes;
    const serializedNotes = serializeStudentNotes(parsed);

    const assignedTeacher = teachers.find((t) => t.id === drawerTeacherId);

    // Map status selection
    let nextStatus = drawerLead.status;
    let nextIsContacted = drawerLead.isContacted;
    let nextLessonStatus = drawerLead.lessonStatus;
    let nextIsConverted = drawerLead.isConverted;

    if (drawerStatusSelection === "NEW") {
      nextStatus = TrialRequestStatus.PENDING;
      nextIsContacted = false;
      nextIsConverted = false;
    } else if (drawerStatusSelection === "CONTACTED") {
      nextIsContacted = true;
    } else if (drawerStatusSelection === "CONFIRMED") {
      nextStatus = TrialRequestStatus.ALLOTTED;
    } else if (drawerStatusSelection === "COMPLETED") {
      nextLessonStatus = "COMPLETED";
    } else if (drawerStatusSelection === "CONVERTED") {
      nextIsConverted = true;
    }

    // Optimistic
    setRequests((prev) =>
      prev.map((r) =>
        r.id === drawerLead.id
          ? {
              ...r,
              allottedTeacherId: drawerTeacherId || null,
              allottedTeacherName: assignedTeacher?.name || null,
              studentNotes: serializedNotes,
              status: nextStatus,
              isContacted: nextIsContacted,
              lessonStatus: nextLessonStatus,
              isConverted: nextIsConverted,
            }
          : r
      )
    );

    startTransition(async () => {
      const res = await updateTrialLeadStatusAction({
        trialRequestId: drawerLead.id,
        allottedTeacherId: drawerTeacherId || null,
        studentNotes: serializedNotes,
        status: nextStatus,
        isContacted: nextIsContacted,
        lessonStatus: nextLessonStatus || undefined,
        isConverted: nextIsConverted,
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Saved changes for ${drawerLead.studentName}.`,
        });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to save changes.",
        });
      }
    });
  };

  // Open Allotment Modal
  const openAllotModal = (lead: AdminTrialRequestItem) => {
    setAllotTargetLeadId(lead.id);
    setSelectedLeadId(lead.id);
    setAllotTeacherId(
      lead.allottedTeacherId ||
        teachers.find((t) =>
          t.instruments.some((i) =>
            i.toLowerCase().includes(lead.instrument.toLowerCase())
          )
        )?.id ||
        teachers[0]?.id ||
        ""
    );
    const d = new Date(lead.requestedStartsAt);
    const valid = !isNaN(d.getTime()) ? d : new Date();
    setScheduledDate(valid.toISOString().slice(0, 10));
    setScheduledTime(valid.toTimeString().slice(0, 5));
    setDurationMinutes(lead.durationMinutes || 60);
    setAllotAdminNotes("");
    setIsAllotModalOpen(true);
  };

  // Submit Allotment
  const handleAllotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLead = requests.find((r) => r.id === allotTargetLeadId) || selectedLead;
    if (!targetLead || !allotTeacherId || !scheduledDate || !scheduledTime) return;

    const startsAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (isNaN(startsAt.getTime())) {
      alert("Invalid date/time.");
      return;
    }

    const assigned = teachers.find((t) => t.id === allotTeacherId);

    // Optimistic
    setRequests((prev) =>
      prev.map((r) =>
        r.id === targetLead.id
          ? {
              ...r,
              status: TrialRequestStatus.ALLOTTED,
              allottedTeacherId: allotTeacherId,
              allottedTeacherName: assigned?.name || "Assigned Faculty",
              requestedStartsAt: startsAt.toISOString(),
              durationMinutes,
            }
          : r
      )
    );
    setIsAllotModalOpen(false);

    startTransition(async () => {
      const res = await allotTrialTeacherAction({
        trialRequestId: targetLead.id,
        teacherId: allotTeacherId,
        scheduledStartsAt: startsAt.toISOString(),
        durationMinutes,
        adminNotes: allotAdminNotes.trim() || undefined,
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Faculty ${assigned?.name || "Instructor"} allotted to ${targetLead.studentName}! Status updated to Confirmed.`,
        });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to allot teacher.",
        });
      }
    });
  };

  // 1-Click Convert to Enrolled Student (Directly converts and moves to Enrollment section)
  const handleDirectConvert = (lead: AdminTrialRequestItem) => {
    if (lead.isConverted) {
      router.push(`/admin/enrollments?studentId=${lead.studentId}&trialId=${lead.id}`);
      return;
    }

    startTransition(async () => {
      const res = await convertTrialToEnrollmentAction({
        trialRequestId: lead.id,
      });

      if (res.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === lead.id
              ? {
                  ...r,
                  isConverted: true,
                  convertedAt: new Date().toISOString(),
                }
              : r
          )
        );
        setStatusMessage({
          type: "success",
          text: `Success! ${lead.studentName} converted and moved to Enrollment section!`,
        });
        router.push(`/admin/enrollments?studentId=${lead.studentId}&trialId=${lead.id}`);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to convert trial lead.",
        });
      }
    });
  };

  // Submit Manual Lead Creation
  const handleCreateLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName || !newLeadEmail || !newLeadInstrument) return;

    const startsAt = new Date(`${newLeadSlotDate}T${newLeadSlotTime}:00`);

    startTransition(async () => {
      const res = await createAdminTrialLeadAction({
        studentName: newLeadName,
        studentEmail: newLeadEmail,
        studentPhone: newLeadPhone || undefined,
        guardianName: newLeadGuardianName || undefined,
        instrument: newLeadInstrument,
        requestedStartsAt: startsAt.toISOString(),
        preferredTimeSlot: "Custom Slot",
        leadSource: newLeadSource,
        leadIntent: newLeadIntent,
        studentNotes: newLeadNotes.trim() || undefined,
      });

      if (res.success) {
        const newLeadItem: AdminTrialRequestItem = {
          id: res.data?.trialRequestId || `trl-${Date.now()}`,
          studentId: `usr-${Date.now()}`,
          studentName: newLeadName,
          studentEmail: newLeadEmail,
          studentPhone: newLeadPhone || null,
          guardianName: newLeadGuardianName || null,
          category: "General",
          instrument: newLeadInstrument,
          requestedStartsAt: startsAt.toISOString(),
          formattedTime: `${formatReadableDateOnly(startsAt.toISOString())} at ${newLeadSlotTime}`,
          preferredTimeSlot: "Custom Slot",
          timezone: "Asia/Kolkata",
          ageGroup: "Adult (18+)",
          studentNotes: newLeadNotes || null,
          status: TrialRequestStatus.PENDING,
          createdAt: new Date().toISOString(),
          durationMinutes: 60,
          isContacted: false,
          leadSource: newLeadSource,
          leadIntent: newLeadIntent,
          leadOwner: null,
          isConverted: false,
        };

        setRequests((prev) => [newLeadItem, ...prev]);
        setSelectedLeadId(newLeadItem.id);
        setIsBookTrialOpen(false);
        setNewLeadName("");
        setNewLeadEmail("");
        setNewLeadPhone("");
        setNewLeadGuardianName("");
        setNewLeadNotes("");
        setStatusMessage({
          type: "success",
          text: `Trial booking lead for ${newLeadName} created!`,
        });
        setTimeout(() => setStatusMessage(null), 3500);
      }
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      "Student Name",
      "Email",
      "Phone",
      "Instrument",
      "Status",
      "Teacher",
      "Schedule",
      "Contacted",
      "Converted",
    ];
    const rows = filteredRequests.map((r) => [
      `"${r.studentName}"`,
      `"${r.studentEmail}"`,
      `"${r.studentPhone || ""}"`,
      `"${r.instrument}"`,
      `"${r.status}"`,
      `"${r.allottedTeacherName || "Unassigned"}"`,
      `"${r.formattedTime}"`,
      `"${r.isContacted ? "Yes" : "No"}"`,
      `"${r.isConverted ? "Yes" : "No"}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `trial_crm_leads_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Status Badge
  const renderStatusBadge = (lead: AdminTrialRequestItem) => {
    if (lead.isConverted) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
          Converted
        </span>
      );
    }
    if (lead.lessonStatus === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          Completed
        </span>
      );
    }
    if (lead.status === TrialRequestStatus.ALLOTTED) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
          Confirmed
        </span>
      );
    }
    if (lead.isContacted) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
          Contacted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
        New
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Top Header Utilities & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-body/70">
          <span>Operations</span>
          <span>/</span>
          <span className="font-bold text-heading">Trial bookings CRM</span>
        </div>
        <div className="flex items-center gap-2.5 text-body/80 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-neutral-200/90 text-[11px] font-medium shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-primary/70" />
            <span suppressHydrationWarning>IST · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
        </div>
      </div>

      {/* Main Page Header & Top Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Trial bookings CRM
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200/90 text-heading text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-body/80" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBookTrialOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2D0752] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Book trial</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="text-xs text-body font-medium">New leads</div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-1 font-numeric">
            {kpis.newLeadsCount}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            {kpis.newLeadsToday > 0 ? `+${kpis.newLeadsToday} today` : "0 new today"}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="text-xs text-body font-medium">Contacted</div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-1 font-numeric">
            {kpis.contactedCount}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            {kpis.contactedPercent}% reached
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="text-xs text-body font-medium">Trial booked</div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-1 font-numeric">
            {kpis.trialBookedCount}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            Next 7 days
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
          <div className="text-xs text-body font-medium">Trial complete</div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-1 font-numeric">
            {kpis.trialCompleteCount}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            {kpis.trialCompleteCount} qualified
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-4 sm:p-5 rounded-2xl bg-white border border-purple-200/80 shadow-2xs">
          <div className="text-xs text-[#3C096C] font-semibold">Converted</div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-[#3C096C] mt-1 font-numeric">
            {kpis.convertedCount}
          </div>
          <div className="text-[11px] text-purple-700/80 font-medium mt-1">
            {kpis.conversionPercent}% / 30d
          </div>
        </div>
      </div>

      {/* ─── STEP 6: UPCOMING CONFIRMED TRIALS (FULL VIEW) ───────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h2 className="text-sm font-bold text-heading">
              Upcoming Confirmed Trials
            </h2>
            <span className="text-xs text-body/60 font-medium">
              ({upcomingConfirmedTrials.totalCount} confirmed)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowUpcomingFull(!showUpcomingFull)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
          >
            <span>{showUpcomingFull ? "Collapse view" : "View All"}</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showUpcomingFull ? "rotate-90" : ""}`} />
          </button>
        </div>

        {upcomingConfirmedTrials.totalCount === 0 ? (
          <div className="py-6 text-center text-xs text-body/70">
            No upcoming confirmed trials scheduled yet. Select a candidate below and click &ldquo;+ Allot teacher&rdquo; to schedule.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Today's Section */}
            {upcomingConfirmedTrials.todayList.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-body/60">
                  Today
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingConfirmedTrials.todayList.map((item) => {
                    const pill = getCountdownPill(item.requestedStartsAt, isMounted);
                    const parsedTime = formatReadableDateTime(item.requestedStartsAt).split(",")[1] || item.preferredTimeSlot;

                    return (
                      <div
                        key={item.id}
                        onClick={() => openDrawer(item)}
                        className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-50 hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 text-center shrink-0">
                            <span suppressHydrationWarning className="text-xs font-bold text-heading font-numeric">
                              {parsedTime.trim()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-heading truncate">
                              {item.studentName}
                            </div>
                            <div className="text-[11px] text-body/70 truncate">
                              {item.instrument} · {item.allottedTeacherName || "Faculty Mentor"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            suppressHydrationWarning
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              pill.isLive
                                ? "bg-rose-100 text-rose-700 animate-pulse"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 font-numeric"
                            }`}
                          >
                            {pill.label}
                          </span>

                          <a
                            href={
                              item.allottedLessonId
                                ? `/lesson/${item.allottedLessonId}`
                                : `/admin/lessons`
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                          >
                            <Video className="w-3 h-3" />
                            <span>Join</span>
                          </a>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawer(item);
                            }}
                            className="p-1 rounded-lg text-body/50 hover:text-heading"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tomorrow's Section */}
            {upcomingConfirmedTrials.tomorrowList.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-body/60">
                  Tomorrow
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingConfirmedTrials.tomorrowList.map((item) => {
                    const pill = getCountdownPill(item.requestedStartsAt, isMounted);
                    const parsedTime = formatReadableDateTime(item.requestedStartsAt).split(",")[1] || item.preferredTimeSlot;

                    return (
                      <div
                        key={item.id}
                        onClick={() => openDrawer(item)}
                        className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-50 hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 text-center shrink-0">
                            <span suppressHydrationWarning className="text-xs font-bold text-heading font-numeric">
                              {parsedTime.trim()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-heading truncate">
                              {item.studentName}
                            </div>
                            <div className="text-[11px] text-body/70 truncate">
                              {item.instrument} · {item.allottedTeacherName || "Faculty Mentor"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span suppressHydrationWarning className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-numeric">
                            {pill.label}
                          </span>

                          <a
                            href={
                              item.allottedLessonId
                                ? `/lesson/${item.allottedLessonId}`
                                : `/admin/lessons`
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                          >
                            <Video className="w-3 h-3" />
                            <span>Join</span>
                          </a>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawer(item);
                            }}
                            className="p-1 rounded-lg text-body/50 hover:text-heading"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming / Later Dates */}
            {(showUpcomingFull ||
              (upcomingConfirmedTrials.todayList.length === 0 &&
                upcomingConfirmedTrials.tomorrowList.length === 0)) &&
              upcomingConfirmedTrials.laterList.length > 0 && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {upcomingConfirmedTrials.laterList.map((item) => {
                      const pill = getCountdownPill(item.requestedStartsAt, isMounted);

                      return (
                        <div
                          key={item.id}
                          onClick={() => openDrawer(item)}
                          className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-50 hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-16 text-center shrink-0">
                              <span suppressHydrationWarning className="text-[11px] font-bold text-heading font-numeric">
                                {formatReadableDateOnly(item.requestedStartsAt)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-heading truncate">
                                {item.studentName}
                              </div>
                              <div className="text-[11px] text-body/70 truncate">
                                {item.instrument} · {item.allottedTeacherName || "Faculty Mentor"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span suppressHydrationWarning className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-numeric">
                              {pill.label}
                            </span>

                            <a
                              href={
                                item.allottedLessonId
                                  ? `/lesson/${item.allottedLessonId}`
                                  : `/admin/lessons`
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                            >
                              <Video className="w-3 h-3" />
                              <span>Join</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Multi-Facet Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-body/70 block">
            Search leads
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-body/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, email or phone"
              className="w-full rounded-xl bg-neutral-50/60 border border-neutral-200/80 pl-8 pr-3 py-2 text-xs text-heading placeholder:text-body/50 focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-body/70 block">
            Trial Status
          </label>
          <select
            value={pipelineStageFilter}
            onChange={(e) => setPipelineStageFilter(e.target.value)}
            className="w-full rounded-xl bg-neutral-50/60 border border-neutral-200/80 px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
          >
            <option value="ALL">All Students ({stageCounts.total})</option>
            <option value="ALL_ACTIVE">Active Trials Only ({stageCounts.activeCount})</option>
            <option value="NEW_LEADS">New Inquiries ({stageCounts.newCount})</option>
            <option value="CONTACTED">Contacted ({stageCounts.contactedCount})</option>
            <option value="TRIAL_BOOKED">Trial Scheduled ({stageCounts.confirmedCount})</option>
            <option value="TRIAL_COMPLETE">Trial Completed ({stageCounts.completedCount})</option>
            <option value="FOLLOW_UP">Needs Follow-up ({stageCounts.followUpCount})</option>
            <option value="CONVERTED">Enrolled / Converted ({stageCounts.convertedCount})</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-body/70 block">
            Course interest
          </label>
          <select
            value={courseInterestFilter}
            onChange={(e) => setCourseInterestFilter(e.target.value)}
            className="w-full rounded-xl bg-neutral-50/60 border border-neutral-200/80 px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
          >
            <option value="ALL">All instruments</option>
            {uniqueInstruments.map((inst) => (
              <option key={inst} value={inst}>
                {inst}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-body/70 block">
            Assigned teacher
          </label>
          <select
            value={assignedTeacherFilter}
            onChange={(e) => setAssignedTeacherFilter(e.target.value)}
            className="w-full rounded-xl bg-neutral-50/60 border border-neutral-200/80 px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
          >
            <option value="ALL">Any teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-body/70 block">
            Trial date
          </label>
          <select
            value={trialDateFilter}
            onChange={(e) => setTrialDateFilter(e.target.value)}
            className="w-full rounded-xl bg-neutral-50/60 border border-neutral-200/80 px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
          >
            <option value="NEXT_30_DAYS">Next 30 days</option>
            <option value="NEXT_7_DAYS">Next 7 days</option>
            <option value="THIS_MONTH">This month</option>
            <option value="ALL_TIME">All time</option>
          </select>
        </div>
      </div>

      {/* Main Split Layout: Table (Left) + Lead Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Active Trial Leads Table */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-neutral-200/80 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-heading">
                Active trial leads
              </h2>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-[#3C096C]/50 mx-auto" />
              <h3 className="font-serif text-base font-bold text-heading">
                No trial leads match your filters
              </h3>
              <p className="text-xs text-body max-w-sm mx-auto">
                Try resetting your filters or search terms to see all available candidates.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50/75 text-[11px] font-semibold text-body/80">
                    <th className="py-3 px-4">Lead / source</th>
                    <th className="py-3 px-4">Course / schedule</th>
                    <th className="py-3 px-4">Teacher</th>
                    <th className="py-3 px-4">Trial Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredRequests.map((req) => {
                    const isSelected = selectedLead?.id === req.id;
                    return (
                      <tr
                        key={req.id}
                        onClick={() => {
                          setSelectedLeadId(req.id);
                          openDrawer(req);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-purple-50/60 ring-1 ring-inset ring-[#3C096C]/25"
                            : "hover:bg-neutral-50/70"
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColor(
                                req.studentName
                              )}`}
                            >
                              {getInitials(req.studentName)}
                            </div>
                            <div>
                              <div className="font-bold text-heading text-xs">
                                {req.studentName}
                              </div>
                              <div className="text-[11px] text-body/60 mt-0.5">
                                {req.studentEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-heading text-xs">
                            {req.instrument}
                          </div>
                          <div className="text-[11px] text-body/80 mt-0.5">
                            {req.formattedTime.split("at")[0]}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {req.allottedTeacherName ? (
                            <div className="text-xs font-medium text-heading">
                              {req.allottedTeacherName}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAllotModal(req);
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:underline"
                            >
                              + Allot teacher
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {renderStatusBadge(req)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {req.isConverted ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                Enrolled
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDirectConvert(req);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#3C096C] hover:bg-[#2D0752] text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                title="1-Click Convert to Enrolled Student"
                              >
                                <span>Convert</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDrawer(req);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-heading text-[11px] font-semibold inline-flex items-center gap-1 transition-all"
                            >
                              <span>Drawer</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Lead Overview Card */}
        <div className="lg:col-span-4">
          {selectedLead ? (
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 space-y-5 sticky top-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-xl font-bold text-heading">
                    {selectedLead.studentName}
                  </h3>
                  <div className="text-xs text-body/70 mt-0.5">
                    {selectedLead.instrument} · {selectedLead.category}
                  </div>
                </div>
                {renderStatusBadge(selectedLead)}
              </div>

              {/* Converted status banner OR 1-Click Convert Button */}
              {selectedLead.isConverted ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">Converted to Enrolled</div>
                      <div className="text-[10px] text-emerald-700">Lead is active in Enrollments</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/enrollments?trialId=${selectedLead.id}`)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    Enrollments →
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDirectConvert(selectedLead)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#3C096C] hover:bg-[#2D0752] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <GraduationCap className="w-4 h-4 text-white" />
                  )}
                  <span>Convert to Enrolled Student</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-white" />
                </button>
              )}

              {/* Drawer Launcher Button */}
              <button
                type="button"
                onClick={() => openDrawer(selectedLead)}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-heading text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-[0.98]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-body" />
                <span>View Full Trial Drawer</span>
                <ChevronRight className="w-4 h-4 ml-auto text-body/60" />
              </button>

              {/* 3 Quick Action Contact Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={selectedLead.studentPhone ? `tel:${selectedLead.studentPhone}` : "#"}
                  className="py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-heading text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5 text-body/70" />
                  <span>Call</span>
                </a>

                <a
                  href={`mailto:${selectedLead.studentEmail}`}
                  className="py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-heading text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Mail className="w-3.5 h-3.5 text-body/70" />
                  <span>Email</span>
                </a>

                {selectedLead.isConverted ? (
                  <a
                    href={selectedLead.studentPhone ? `https://wa.me/${selectedLead.studentPhone.replace(/[^0-9]/g, "")}` : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-heading text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setContactedLeadId(selectedLead.id);
                      setIsContactedModalOpen(true);
                    }}
                    className="py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-heading text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs divide-y divide-neutral-100">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-body/70">Preferred Schedule</span>
                  <span className="font-semibold text-heading font-numeric">
                    {selectedLead.formattedTime.split("at")[0]}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-body/70">Faculty Mentor</span>
                  <span className="font-semibold text-heading">
                    {selectedLead.allottedTeacherName || "Not assigned"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-body/70">Email</span>
                  <span className="font-medium text-heading truncate max-w-[180px]">
                    {selectedLead.studentEmail}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-body/70">Phone</span>
                  <span className="font-medium text-heading font-numeric">
                    {selectedLead.studentPhone || "—"}
                  </span>
                </div>
              </div>

              {/* Stepper Preview */}
              <div className="pt-2 border-t border-neutral-100">
                <div className="text-[11px] font-semibold text-body/70 mb-2">
                  Student Trial Progress
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {PIPELINE_STEPS.map((s, idx) => {
                    const activeIdx = getLeadStepIndex(selectedLead);
                    const isDone = activeIdx >= idx;
                    return (
                      <div
                        key={s.id}
                        className={`h-1.5 rounded-full ${
                          isDone ? "bg-blue-600" : "bg-neutral-200"
                        }`}
                        title={s.label}
                      />
                    );
                  })}
                </div>
                <div className="text-[10px] text-body/60 mt-1 flex justify-between">
                  <span>New</span>
                  <span className="font-semibold text-blue-700">
                    Step {getLeadStepIndex(selectedLead) + 1} of 6:{" "}
                    {PIPELINE_STEPS[getLeadStepIndex(selectedLead)]?.label}
                  </span>
                  <span>Converted</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white rounded-2xl border border-neutral-200/80 text-center text-xs text-body">
              Select a lead from the list to view full profile & actions.
            </div>
          )}
        </div>
      </div>

      {/* ─── STEP 3: TRIAL DETAIL DRAWER (APPLE SLIDE-OVER SHEET) ───────── */}
      {isDrawerOpen && drawerLead && (
        <div className="fixed top-16 left-0 right-0 bottom-0 z-50 pointer-events-none flex justify-end">
          {/* Dimmed backdrop covering content below navbar and next to sidebar */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed top-16 left-0 md:left-64 right-0 bottom-0 bg-neutral-950/20 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-auto"
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative w-full sm:w-[640px] lg:w-[700px] max-w-full h-full bg-white shadow-[-16px_0_40px_rgba(0,0,0,0.14)] border-l border-neutral-200/90 flex flex-col pointer-events-auto z-10 overflow-hidden transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in slide-in-from-right">
            {/* Drawer Top Bar */}
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100/60 shadow-2xs">
                  📋
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-heading">
                      Trial Booking
                    </h2>
                    {renderStatusBadge(drawerLead)}
                  </div>
                  <p className="text-[10px] text-body/60 font-mono">
                    REF: #{drawerLead.id.slice(-6).toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-body/50 bg-neutral-100 rounded border border-neutral-200">
                  ESC
                </kbd>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-body/50 hover:text-heading hover:bg-neutral-100 transition-colors active:scale-95"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Split Body: Left (Profile & Stepper) | Right (Tabs & Details) */}
            <div className="flex-1 overflow-y-auto main-scroll grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100">
              {/* Left Column: Student Header + 6-step Vertical Stepper */}
              <div className="sm:col-span-5 p-5 space-y-5 bg-[#FAFAFC]">
                {/* Student Profile Card */}
                <div className="p-3.5 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${getAvatarColor(
                        drawerLead.studentName
                      )}`}
                    >
                      {getInitials(drawerLead.studentName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-heading text-sm truncate">
                          {drawerLead.studentName}
                        </h3>
                      </div>
                      <div className="text-[11px] text-body/70 mt-0.5 leading-snug">
                        {drawerLead.instrument} • Age {drawerLead.age || 16} • {drawerLead.country || "India"}
                      </div>
                    </div>
                  </div>

                  {/* Contact Chips */}
                  <div className="space-y-1.5 pt-1">
                    <a
                      href={`mailto:${drawerLead.studentEmail}`}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 text-blue-700 text-xs font-medium transition-colors w-full border border-blue-100/60"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                      <span className="truncate">{drawerLead.studentEmail}</span>
                    </a>

                    <a
                      href={drawerLead.studentPhone ? `tel:${drawerLead.studentPhone}` : "#"}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 text-blue-700 text-xs font-medium transition-colors w-full border border-blue-100/60"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                      <span className="font-numeric truncate">{drawerLead.studentPhone || "+91 98765 43210"}</span>
                    </a>
                  </div>
                </div>

                {/* Vertical Stepper Pipeline */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-body/60 mb-2.5 px-1">
                    Trial Journey
                  </div>

                  <div className="relative pl-1 space-y-1">
                    {/* Vertical connecting track line */}
                    <div className="absolute left-[17px] top-3.5 bottom-3.5 w-0.5 bg-neutral-200" />

                    {PIPELINE_STEPS.map((step, idx) => {
                      const currentActiveIdx = getLeadStepIndex(drawerLead);
                      const isCurrent = currentActiveIdx === idx;
                      const isPassed = currentActiveIdx > idx;

                      return (
                        <div
                          key={step.id}
                          onClick={() => handleStepClick(step.id)}
                          className={`relative flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer transition-all ${
                            isCurrent
                              ? "bg-blue-50/90 text-blue-700 font-bold border border-blue-100/80"
                              : "text-body/70 hover:bg-neutral-100/70"
                          }`}
                        >
                          {/* Step Node Dot */}
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                              isCurrent
                                ? "bg-blue-600 text-white ring-4 ring-blue-100"
                                : isPassed
                                ? "bg-blue-600 text-white"
                                : "border-2 border-neutral-300 bg-white"
                            }`}
                          >
                            {isCurrent ? (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            ) : isPassed ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold leading-tight">
                              {step.label}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Tabs (Details | Activity | Follow-ups) */}
              <div className="sm:col-span-7 p-5 space-y-4">
                {/* Segmented Tabs */}
                <div className="flex items-center gap-5 border-b border-neutral-100 pb-2">
                  <button
                    type="button"
                    onClick={() => setDrawerTab("details")}
                    className={`text-xs font-bold pb-1.5 relative transition-colors ${
                      drawerTab === "details"
                        ? "text-blue-600"
                        : "text-body/60 hover:text-heading"
                    }`}
                  >
                    Details
                    {drawerTab === "details" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerTab("activity")}
                    className={`text-xs font-bold pb-1.5 relative transition-colors ${
                      drawerTab === "activity"
                        ? "text-blue-600"
                        : "text-body/60 hover:text-heading"
                    }`}
                  >
                    Activity
                    {drawerTab === "activity" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerTab("followups")}
                    className={`text-xs font-bold pb-1.5 relative transition-colors flex items-center gap-1.5 ${
                      drawerTab === "followups"
                        ? "text-blue-600"
                        : "text-body/60 hover:text-heading"
                    }`}
                  >
                    <span>Follow-ups</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-neutral-100 text-[10px] font-mono">
                      {getFollowUpList(drawerLead).length}
                    </span>
                    {drawerTab === "followups" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                </div>

                {/* TAB 1: DETAILS */}
                {drawerTab === "details" && (
                  <div className="space-y-4 pt-1 text-xs">
                    {/* Contact Info Section */}
                    <div className="bg-neutral-50/60 rounded-xl p-3.5 border border-neutral-100/90 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-body/60">
                        Contact Information
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-body/60">Email</span>
                          <span className="font-medium text-heading truncate max-w-[190px]">
                            {drawerLead.studentEmail}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-body/60">Phone</span>
                          <span className="font-medium text-heading font-numeric">
                            {drawerLead.studentPhone || "+91 98765 43210"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-body/60">Country</span>
                          <span className="font-medium text-heading">
                            {drawerLead.country || "India"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-body/60">Timezone</span>
                          <span className="font-medium text-heading">
                            {drawerLead.timezone || "Asia/Kolkata"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Trial Details Section */}
                    <div className="bg-neutral-50/60 rounded-xl p-3.5 border border-neutral-100/90 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-body/60">
                        Trial Details
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-body/60">Course</span>
                          <span className="font-medium text-heading">
                            {drawerLead.instrument}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-body/60">Preferred Date</span>
                          <span className="font-medium text-heading font-numeric">
                            {formatReadableDateOnly(drawerLead.requestedStartsAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-body/60">Preferred Time</span>
                          <span className="font-medium text-heading font-numeric">
                            {drawerLead.preferredTimeSlot || "7:00 PM"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Teacher Select */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-body/60 block">
                        Teacher
                      </label>
                      <div className="relative">
                        <select
                          value={drawerTeacherId}
                          onChange={(e) => setDrawerTeacherId(e.target.value)}
                          className="w-full appearance-none rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-xs text-heading focus:outline-none focus:border-blue-600 transition-colors pr-8"
                        >
                          <option value="">Select Teacher</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-body/50 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-body/60 block">
                        Notes
                      </label>
                      <textarea
                        rows={2}
                        value={drawerNotes}
                        onChange={(e) => setDrawerNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="w-full rounded-xl border border-neutral-200/90 bg-white p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600 transition-colors resize-none"
                      />
                    </div>

                    {/* Status Dropdown */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-body/60 block">
                          Status
                        </label>
                        {drawerLead.isConverted && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Locked · Converted
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <select
                          disabled={drawerLead.isConverted}
                          value={drawerLead.isConverted ? "CONVERTED" : drawerStatusSelection}
                          onChange={(e) => {
                            if (e.target.value === "CONVERTED") {
                              handleDirectConvert(drawerLead);
                            } else {
                              setDrawerStatusSelection(e.target.value);
                            }
                          }}
                          className={`w-full appearance-none rounded-xl border border-neutral-200/90 px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-600 transition-colors pr-8 ${
                            drawerLead.isConverted
                              ? "bg-neutral-100 text-neutral-500 cursor-not-allowed"
                              : "bg-white text-heading"
                          }`}
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="FOLLOW_UP">FOLLOW-UP</option>
                          <option value="CONVERTED">CONVERTED (Click to Convert)</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-body/50 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {drawerLead.isConverted ? (
                        <p className="text-[11px] text-emerald-700 font-medium">
                          ✓ Student is actively enrolled. Lead status is locked and cannot be edited.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* TAB 2: STEP 5 TRIAL ACTIVITY / HISTORY */}
                {drawerTab === "activity" && (
                  <div className="space-y-3 pt-1 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-body/60">
                      Activity Timeline
                    </div>

                    <div className="relative pl-3 space-y-3">
                      <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-neutral-200" />

                      {getTimelineActivities(drawerLead).map((act) => (
                        <div key={act.id} className="relative flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 z-10 ring-4 ring-white shadow-2xs mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>

                          <div className="flex-1 bg-neutral-50/70 p-2.5 rounded-xl border border-neutral-100 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-body/70 font-numeric">
                                {formatReadableDateTime(act.date)}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                {act.status}
                              </span>
                            </div>
                            <div className="font-bold text-xs text-heading">
                              {act.title}
                            </div>
                            {act.description && (
                              <p className="text-[11px] text-body/80 leading-normal">
                                {act.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: STEP 8 FOLLOW-UP HISTORY */}
                {drawerTab === "followups" && (
                  <div className="space-y-3 pt-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-body/60">
                        Follow-up History
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFollowUpTargetLeadId(drawerLead.id);
                          setIsAddFollowUpModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Follow-up</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {getFollowUpList(drawerLead).length === 0 ? (
                        <div className="p-5 text-center text-body/60 bg-neutral-50 rounded-xl">
                          No follow-up communication recorded yet. Click &ldquo;+ Add Follow-up&rdquo; to log one.
                        </div>
                      ) : (
                        getFollowUpList(drawerLead).map((fu) => (
                          <div
                            key={fu.id}
                            className="p-3 rounded-xl border border-neutral-200/80 bg-neutral-50/50 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="font-bold text-heading text-xs font-numeric">
                                  {formatReadableDateTime(fu.date)}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  fu.outcome === "Ready to enroll"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : fu.outcome === "Interested"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {fu.outcome}
                              </span>
                            </div>

                            <div className="text-[11px] text-body font-medium">
                              <span className="font-bold text-heading">Channel:</span> {fu.method}
                            </div>

                            <p className="text-xs text-body/90 leading-relaxed bg-white p-2 rounded-lg border border-neutral-100">
                              {fu.notes}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Sticky Drawer Footer */}
            <div className="p-3.5 px-5 border-t border-neutral-100 bg-white/95 backdrop-blur-sm shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-3.5 py-2 rounded-xl text-body/70 hover:text-heading hover:bg-neutral-100 text-xs font-semibold transition-colors"
              >
                Close
              </button>

              {drawerTab === "details" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDrawerSaveChanges}
                  className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Changes</span>
                </button>
              ) : drawerTab === "followups" ? (
                <button
                  type="button"
                  onClick={() => {
                    setFollowUpTargetLeadId(drawerLead.id);
                    setIsAddFollowUpModalOpen(true);
                  }}
                  className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Follow-up</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDrawerTab("details")}
                  className="py-2 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-heading font-semibold text-xs transition-colors"
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 4: CHANGE STATUS - CONTACTED MODAL ────────────────── */}
      {isContactedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-heading">
                  Change status to CONTACTED?
                </h3>
                <p className="text-xs text-body/70 mt-0.5">
                  Let&apos;s record how you contacted the student.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsContactedModalOpen(false)}
                className="p-1 rounded-lg text-body/60 hover:text-heading"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContactedSubmit} className="space-y-4 text-xs">
              {/* Radio: Contact Method */}
              <div className="space-y-2">
                <label className="font-semibold text-heading block">
                  Contact method
                </label>
                <div className="flex items-center gap-4">
                  {(["WhatsApp", "Phone", "Email"] as const).map((method) => (
                    <label
                      key={method}
                      className="flex items-center gap-2 cursor-pointer font-medium text-heading"
                    >
                      <input
                        type="radio"
                        name="contactMethod"
                        value={method}
                        checked={contactMethod === method}
                        onChange={() => setContactMethod(method)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={contactedNotes}
                  onChange={(e) => setContactedNotes(e.target.value)}
                  placeholder="Student responded. Interested in Guitar trial."
                  className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Next follow-up Date & Time */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Next follow-up
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={contactedFollowUpDate}
                    onChange={(e) => setContactedFollowUpDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                  <input
                    type="time"
                    required
                    value={contactedFollowUpTime}
                    onChange={(e) => setContactedFollowUpTime(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsContactedModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 text-body font-semibold hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── STEP 7: TRIAL COMPLETION MODAL ─────────────────────────── */}
      {isCompletionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-heading">
                  Mark Trial as Completed
                </h3>
                <p className="text-xs text-body/70 mt-0.5">
                  Record trial session attendance, mentor feedback & next steps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompletionModalOpen(false)}
                className="p-1 rounded-lg text-body/60 hover:text-heading"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompletionSubmit} className="space-y-4 text-xs">
              {/* Question: Did student attend? */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Did student attend?
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-heading">
                    <input
                      type="radio"
                      name="attended"
                      checked={completionAttended === true}
                      onChange={() => setCompletionAttended(true)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-heading">
                    <input
                      type="radio"
                      name="attended"
                      checked={completionAttended === false}
                      onChange={() => setCompletionAttended(false)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Teacher Select */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Teacher
                </label>
                <select
                  required
                  value={completionTeacherId}
                  onChange={(e) => setCompletionTeacherId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600 bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trial Outcome Radio */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Trial outcome
                </label>
                <div className="space-y-2">
                  {(["Interested", "Very interested", "Needs follow-up", "Not interested"] as const).map((out) => (
                    <label
                      key={out}
                      className="flex items-center gap-2 cursor-pointer font-medium text-heading"
                    >
                      <input
                        type="radio"
                        name="outcome"
                        value={out}
                        checked={completionOutcome === out}
                        onChange={() => setCompletionOutcome(out)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{out}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Teacher feedback */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Teacher feedback
                </label>
                <textarea
                  rows={2}
                  value={completionTeacherFeedback}
                  onChange={(e) => setCompletionTeacherFeedback(e.target.value)}
                  placeholder="Student enjoyed the class. Interested in continuing Guitar."
                  className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Admin notes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Admin notes
                </label>
                <textarea
                  rows={2}
                  value={completionAdminNotes}
                  onChange={(e) => setCompletionAdminNotes(e.target.value)}
                  placeholder="Parent will confirm package tomorrow."
                  className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Next follow-up Date & Time */}
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Next follow-up
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={completionFollowUpDate}
                    onChange={(e) => setCompletionFollowUpDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                  <input
                    type="time"
                    required
                    value={completionFollowUpTime}
                    onChange={(e) => setCompletionFollowUpTime(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCompletionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 text-body font-semibold hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Mark Trial Completed</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── STEP 8: ADD FOLLOW-UP MODAL ─────────────────────────────── */}
      {isAddFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-heading">
                  Record New Follow-up
                </h3>
                <p className="text-xs text-body/70 mt-0.5">
                  Log call, message, or email summary and schedule next check-in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFollowUpModalOpen(false)}
                className="p-1 rounded-lg text-body/60 hover:text-heading"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFollowUpSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Communication Channel
                </label>
                <div className="flex items-center gap-4">
                  {(["WhatsApp", "Phone", "Email"] as const).map((m) => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer font-medium text-heading">
                      <input
                        type="radio"
                        name="fuMethod"
                        value={m}
                        checked={followUpMethod === m}
                        onChange={() => setFollowUpMethod(m)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Outcome Tag
                </label>
                <select
                  value={followUpOutcome}
                  onChange={(e) => setFollowUpOutcome(e.target.value as any)}
                  className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600 bg-white font-semibold"
                >
                  <option value="Ready to enroll">Ready to enroll</option>
                  <option value="Interested">Interested</option>
                  <option value="Pending">Pending</option>
                  <option value="Needs follow-up">Needs follow-up</option>
                  <option value="Not interested">Not interested</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Conversation Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Parent asked about monthly package. Scheduled trial follow-up..."
                  className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Next Follow-up Due
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={followUpNextDate}
                    onChange={(e) => setFollowUpNextDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                  <input
                    type="time"
                    required
                    value={followUpNextTime}
                    onChange={(e) => setFollowUpNextTime(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddFollowUpModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 text-body font-semibold hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Follow-up</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ALLOT CERTIFIED FACULTY & TIMING ─────────────────── */}
      {isAllotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 font-mono">
                  Faculty Allotment
                </span>
                <h3 className="font-serif text-lg font-bold text-heading mt-0.5">
                  Allot Teacher & Confirm Timing
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAllotModalOpen(false)}
                className="p-1 rounded-lg text-body/60 hover:text-heading"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllotSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-heading block">
                  Select Certified Faculty Instructor *
                </label>
                <select
                  required
                  value={allotTeacherId}
                  onChange={(e) => setAllotTeacherId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600 bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.instruments.join(", ") || "All Instruments"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Lesson Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                </div>
              </div>

              {/* Presets */}
              <div className="space-y-1">
                <span className="text-[11px] text-body/70">Quick Time Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TIME_SLOTS.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      onClick={() => setScheduledTime(s.time)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-numeric ${
                        scheduledTime === s.time
                          ? "bg-blue-600 text-white font-bold"
                          : "bg-neutral-100 hover:bg-neutral-200 text-body"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <span className="text-[11px] text-body/70">Session Duration:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`py-1.5 rounded-xl text-xs font-semibold ${
                        durationMinutes === mins
                          ? "bg-blue-600 text-white font-bold"
                          : "bg-neutral-100 text-body hover:bg-neutral-200"
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAllotModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 text-body font-semibold hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !allotTeacherId}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  <span>Confirm Faculty & Timing</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ─── MODAL: BOOK TRIAL (MANUAL LEAD CREATION) ────────────────── */}
      {isBookTrialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 font-mono">
                  Admissions Entry
                </span>
                <h3 className="font-serif text-lg font-bold text-heading mt-0.5">
                  Book Free Trial Lesson
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBookTrialOpen(false)}
                className="p-1 rounded-lg text-body/60 hover:text-heading"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Student Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newLeadEmail}
                    onChange={(e) => setNewLeadEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Guardian Name (if minor)
                  </label>
                  <input
                    type="text"
                    value={newLeadGuardianName}
                    onChange={(e) => setNewLeadGuardianName(e.target.value)}
                    placeholder="Parent / Guardian"
                    className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Discipline / Instrument *
                  </label>
                  <select
                    value={newLeadInstrument}
                    onChange={(e) => setNewLeadInstrument(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600 bg-white"
                  >
                    {uniqueInstruments.map((inst) => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Lead Source
                  </label>
                  <select
                    value={newLeadSource}
                    onChange={(e) => setNewLeadSource(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-heading focus:outline-none focus:border-blue-600 bg-white"
                  >
                    {LEAD_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Trial Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeadSlotDate}
                    onChange={(e) => setNewLeadSlotDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-heading block">
                    Trial Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={newLeadSlotTime}
                    onChange={(e) => setNewLeadSlotTime(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading font-numeric"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-heading block">
                  Notes / Musical Background
                </label>
                <textarea
                  rows={2}
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  placeholder="e.g. Has played guitar for 1 year, wants classical foundation..."
                  className="w-full rounded-xl border border-neutral-200 p-2 text-xs text-heading"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsBookTrialOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 text-body font-semibold hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Create Trial Lead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
