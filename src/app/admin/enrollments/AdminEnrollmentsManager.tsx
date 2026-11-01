"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { EnrollmentStatus, PaymentStatus, LessonStatus } from "@prisma/client";
import {
  saveFullEnrollmentPlanAction,
  scheduleEnrollmentLessonAction,
  bulkScheduleEnrollmentLessonsAction,
  rescheduleEnrollmentLessonAction,
  deleteOrCancelEnrollmentLessonAction,
  reassignEnrollmentTeacherAction,
  adminApproveAndAllotCourseAction,
  adminRecordEnrollmentPaymentAction,
} from "@/actions/admin";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Globe,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Check,
  Plus,
  RefreshCw,
  BookOpen,
  Users,
  GraduationCap,
  IndianRupee,
  ArrowRight,
  Edit3,
  SlidersHorizontal,
  CalendarDays,
  FileText,
  CreditCard,
  UserCheck,
  Award,
  Sparkles,
  Layers,
  CalendarClock,
  Receipt,
  ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import {
  SearchableStudentSelector,
  SearchableFacultySelector,
  SearchableCourseSelector,
} from "./EnrollmentSelectors";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import {
  WeeklySchedulePicker,
  AutoScheduleAllotModal,
  getNextWeekdayDate,
  getNextMultiWeekdayDate,
  generateWeeklySlotsList,
  generateMultiDayWeeklySlots,
  WEEKDAY_OPTIONS,
} from "./AutoScheduleModal";

export interface ScheduledLessonData {
  id: string;
  trackingCode: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
  teacherId?: string | null;
  teacherName: string;
  payoutRupees: number;
}

export interface EnrollmentPaymentItem {
  id: string;
  amountMinorUnits: number;
  currency: string;
  gateway: string;
  gatewayPaymentId: string | null;
  gatewayOrderId: string | null;
  status: PaymentStatus;
  notes?: string | null;
  createdAt: string;
}

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  studentCustomId?: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone?: string | null;
  studentTimezone: string;
  studentGuardianName?: string | null;
  studentGuardianPhone?: string | null;
  studentCountry?: string | null;
  studentAge?: number | null;
  courseId: string;
  courseTitle: string;
  courseInstrument: string;
  courseLevel: string;
  courseSessionCount: number;
  coursePriceMinorUnits: number;
  courseDurationWeeks: number;
  teacherId: string | null;
  teacherName: string | null;
  teacherPayoutRupees: number;
  sessionsRemaining: number;
  sessionsTotal: number;
  status: EnrollmentStatus;
  startedAt: string;
  adminNotes?: string | null;
  lessons: ScheduledLessonData[];
  payment?: {
    id: string;
    amountMinorUnits: number;
    status: PaymentStatus;
    gatewayPaymentId: string | null;
  } | null;
  payments?: EnrollmentPaymentItem[];
}

export interface CourseCatalogOption {
  id: string;
  title: string;
  instrument: string;
  level: string;
  sessionCount: number;
  priceMinorUnits: number;
  durationWeeks: number;
}

export interface FacultyOption {
  id: string;
  name: string;
  email: string;
  instruments: string[];
  payoutRupees: number;
}

export interface StudentOption {
  id: string;
  customId?: string | null;
  name: string;
  email: string;
  timezone: string;
  guardianName?: string | null;
  age?: number | null;
  phone?: string | null;
  country?: string | null;
}

export interface TrialLeadOption {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  instrument: string;
  status: string;
  isConverted: boolean;
  preferredTimeSlot?: string;
  allottedTeacherId?: string | null;
}

export interface AdminCourseEnrollmentRequestItem {
  id: string;
  studentId: string;
  studentCustomId?: string | null;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseDiscipline: string;
  courseInstrument: string;
  courseLevel: string;
  courseSessionCount: number;
  coursePriceMinorUnits: number;
  paymentPlan: string;
  status: string;
  studentNotes?: string | null;
  preferredSchedule?: string | null;
  createdAt: string;
}

interface AdminEnrollmentsManagerProps {
  initialEnrollments: EnrollmentRecord[];
  courses: CourseCatalogOption[];
  teachers: FacultyOption[];
  students: StudentOption[];
  trialLeads: TrialLeadOption[];
  initialCourseRequests?: AdminCourseEnrollmentRequestItem[];
  initialStudentId?: string;
  initialEnrollmentId?: string;
  initialTrialId?: string;
  initialDirect?: boolean;
}

export function AdminEnrollmentsManager({
  initialEnrollments,
  courses,
  teachers,
  students,
  trialLeads,
  initialCourseRequests = [],
  initialStudentId,
  initialEnrollmentId,
  initialTrialId,
  initialDirect,
}: AdminEnrollmentsManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramEnrollmentId = searchParams.get("enrollmentId") || searchParams.get("schedule") || initialEnrollmentId || "";
  const paramStudentId = searchParams.get("studentId") || initialStudentId || "";
  const paramTrialId = searchParams.get("trialId") || initialTrialId || "";
  const isDirectParam = searchParams.get("direct") === "true" || Boolean(initialDirect);

  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>(initialEnrollments);

  // Sync state when fresh enrollments are loaded from server
  useEffect(() => {
    setEnrollments(initialEnrollments);
  }, [initialEnrollments]);

  const [courseRequests, setCourseRequests] = useState<AdminCourseEnrollmentRequestItem[]>(initialCourseRequests);
  const [viewMode, setViewMode] = useState<"PLANNER" | "ROSTER">("PLANNER");

  // Selected Student Context (URL parameter has top priority; otherwise empty so admin first selects student)
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    if (paramStudentId) {
      return paramStudentId;
    }
    if (paramEnrollmentId) {
      const match = initialEnrollments.find((e) => e.id === paramEnrollmentId);
      if (match) return match.studentId;
    }
    return "";
  });

  // Direct enrolment mode lock: when initiated from direct enrolment, locked strictly to this student
  const [isDirectEnrolmentScoped, setIsDirectEnrolmentScoped] = useState<boolean>(() => {
    return Boolean(paramStudentId || isDirectParam);
  });

  // Keep selected student in sync when navigating or URL changes
  useEffect(() => {
    const sId = paramStudentId || initialStudentId;
    if (sId) {
      setSelectedStudentId(sId);
      setIsDirectEnrolmentScoped(true);
      setIsManualAddOpen(true);
    }
  }, [paramStudentId, initialStudentId]);

  useEffect(() => {
    const eId = paramEnrollmentId || initialEnrollmentId;
    if (eId) {
      setSelectedEnrollmentId(eId);
    }
  }, [paramEnrollmentId, initialEnrollmentId]);

  // Scoped students list: in direct enrolment mode, only the target student is presented
  const visibleStudents = useMemo(() => {
    if (isDirectEnrolmentScoped && selectedStudentId) {
      const single = students.filter((s) => s.id === selectedStudentId);
      if (single.length > 0) return single;
    }
    return students;
  }, [students, isDirectEnrolmentScoped, selectedStudentId]);

  // Global pending course admission requests across converted students
  const allPendingCourseRequests = useMemo(() => {
    return courseRequests.filter((r) => r.status === "PENDING");
  }, [courseRequests]);

  // Filter student-scoped enrollments
  const studentEnrollments = useMemo(() => {
    return enrollments.filter((e) => e.studentId === selectedStudentId);
  }, [enrollments, selectedStudentId]);

  // Filter student-scoped course requests
  const studentCourseRequests = useMemo(() => {
    return courseRequests.filter((r) => r.studentId === selectedStudentId);
  }, [courseRequests, selectedStudentId]);

  const pendingRequests = useMemo(() => {
    return studentCourseRequests.filter((r) => r.status === "PENDING");
  }, [studentCourseRequests]);

  // Displayed pending requests: in direct mode, only show this student's requests
  const displayPendingRequests = useMemo(() => {
    if (isDirectEnrolmentScoped) {
      return pendingRequests;
    }
    return allPendingCourseRequests;
  }, [isDirectEnrolmentScoped, pendingRequests, allPendingCourseRequests]);

  // Selected Enrollment ID (scoped to the selected student)
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(() => {
    if (paramEnrollmentId) return paramEnrollmentId;
    return "";
  });

  const activeEnrollment = useMemo(() => {
    if (!selectedStudentId) return null;
    if (selectedEnrollmentId) {
      const found = studentEnrollments.find((e) => e.id === selectedEnrollmentId);
      if (found) return found;
    }
    return studentEnrollments[0] || null;
  }, [studentEnrollments, selectedEnrollmentId, selectedStudentId]);

  // Form State: 1 · Student & Course
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    activeEnrollment?.courseId || courses[0]?.id || ""
  );
  const [linkedTrialId, setLinkedTrialId] = useState<string>(paramTrialId || "");

  // Form State: 2 · Teacher & recurring schedule
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    activeEnrollment?.teacherId || teachers[0]?.id || ""
  );
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(45);
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    activeEnrollment?.studentTimezone || "Asia/Kolkata"
  );
  const [recurringCadence, setRecurringCadence] = useState<string>("TUE_THU");
  const [startTime, setStartTime] = useState<string>("18:00");
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date(Date.now() + 86400000 * 84).toISOString().slice(0, 10)
  );

  // Form State: 3 · Session Plan
  const [totalSessions, setTotalSessions] = useState<number>(
    activeEnrollment?.sessionsTotal || courses[0]?.sessionCount || 24
  );
  const [completedSessions, setCompletedSessions] = useState<number>(
    activeEnrollment ? activeEnrollment.sessionsTotal - activeEnrollment.sessionsRemaining : 0
  );
  const [frequencyLabel, setFrequencyLabel] = useState<string>("2 classes / week");
  const [expectedDurationWeeks, setExpectedDurationWeeks] = useState<number>(12);

  // Form State: 4 · Fees, payments & notes
  const [feeRupees, setFeeRupees] = useState<number>(
    activeEnrollment
      ? Math.round(activeEnrollment.coursePriceMinorUnits / 100)
      : courses[0]
      ? Math.round(courses[0].priceMinorUnits / 100)
      : 24000
  );
  const [paidRupees, setPaidRupees] = useState<number>(
    activeEnrollment?.payment
      ? Math.round(activeEnrollment.payment.amountMinorUnits / 100)
      : 0
  );
  const [paymentStatus, setPaymentStatus] = useState<string>("Partially paid");
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus>(
    activeEnrollment?.status || EnrollmentStatus.ACTIVE
  );
  const [nextDueDate, setNextDueDate] = useState<string>(
    new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
  );
  const [adminNotes, setAdminNotes] = useState<string>(
    activeEnrollment?.adminNotes ||
      "1-on-1 private lessons. Share starter riyaz kit after enrollment activation."
  );

  // Approval & Manual Allotment Interactive Form State
  const [allotFeeRupees, setAllotFeeRupees] = useState<number>(() => {
    if (pendingRequests.length > 0) {
      return Math.round(pendingRequests[0].coursePriceMinorUnits / 100);
    }
    return courses[0] ? Math.round(courses[0].priceMinorUnits / 100) : 24000;
  });
  const [allotPaidRupees, setAllotPaidRupees] = useState<number>(0);
  const [allotTeacherId, setAllotTeacherId] = useState<string>(teachers[0]?.id || "");
  const [allotSessions, setAllotSessions] = useState<number>(() => {
    if (pendingRequests.length > 0) {
      return pendingRequests[0].courseSessionCount;
    }
    return courses[0]?.sessionCount || 24;
  });
  const [allotNotes, setAllotNotes] = useState<string>("");
  const [isManualAddOpen, setIsManualAddOpen] = useState<boolean>(() => {
    return Boolean(paramStudentId || isDirectParam);
  });
  const [manualCourseId, setManualCourseId] = useState<string>(courses[0]?.id || "");

  // Sync allotment fields when pending request or manual course changes
  useEffect(() => {
    if (pendingRequests.length > 0) {
      const topReq = pendingRequests[0];
      setAllotFeeRupees(Math.round(topReq.coursePriceMinorUnits / 100));
      setAllotSessions(topReq.courseSessionCount);
      setAllotPaidRupees(0);
    } else if (manualCourseId) {
      const crs = courses.find((c) => c.id === manualCourseId);
      if (crs) {
        setAllotFeeRupees(Math.round(crs.priceMinorUnits / 100));
        setAllotSessions(crs.sessionCount);
      }
    }
  }, [selectedStudentId, pendingRequests.length, manualCourseId]);

  const handleStudentChange = (newStudentId: string) => {
    setSelectedStudentId(newStudentId);
    const matchingEnrs = enrollments.filter((e) => e.studentId === newStudentId);
    setSelectedEnrollmentId(matchingEnrs[0]?.id || "");
    if (!newStudentId) {
      setIsDirectEnrolmentScoped(false);
    }
  };

  // Inline lesson scheduling & management
  const [scheduleMode, setScheduleMode] = useState<"SINGLE" | "BULK">("SINGLE");
  const [singleLessonDate, setSingleLessonDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [singleLessonDuration, setSingleLessonDuration] = useState<number>(60);
  const [bulkStartDate, setBulkStartDate] = useState<string>(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16)
  );
  const [bulkIntervalDays, setBulkIntervalDays] = useState<number>(7);
  const [bulkCount, setBulkCount] = useState<number>(4);

  // Inline Reschedule modal/input
  const [reschedulingLessonId, setReschedulingLessonId] = useState<string | null>(null);
  const reschedulingLesson = useMemo(() => {
    if (!reschedulingLessonId || !activeEnrollment) return null;
    return (
      activeEnrollment.lessons.find((l) => l.id === reschedulingLessonId) ||
      null
    );
  }, [reschedulingLessonId, activeEnrollment]);
  const [rescheduleDateInput, setRescheduleDateInput] = useState<string>("");
  const [reassigningLessonId, setReassigningLessonId] = useState<string | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Transitions & Feedback
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Subsequent installment recording state
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState<number>(0);
  const [installmentMethod, setInstallmentMethod] = useState<string>("UPI");
  const [installmentRefCode, setInstallmentRefCode] = useState<string>("");
  const [installmentNotes, setInstallmentNotes] = useState<string>("");
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);

  // Installment automatic weekly scheduling state
  const [installmentDay, setInstallmentDay] = useState<number>(3); // Default Wednesday
  const [installmentDays, setInstallmentDays] = useState<number[]>([3]);
  const [installmentSessionsPerWeek, setInstallmentSessionsPerWeek] = useState<number>(1);
  const [installmentTime, setInstallmentTime] = useState<string>("17:00"); // Default 5:00 PM
  const [installmentStartDate, setInstallmentStartDate] = useState<string>(() => {
    const nextD = getNextMultiWeekdayDate([3], "17:00");
    const y = nextD.getFullYear();
    const m = String(nextD.getMonth() + 1).padStart(2, "0");
    const d = String(nextD.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [installmentDuration, setInstallmentDuration] = useState<number>(60);
  const [isAutoScheduleInstallment, setIsAutoScheduleInstallment] = useState<boolean>(true);
  const [installmentPerSessionRate, setInstallmentPerSessionRate] = useState<number>(800);

  const defaultInstallmentPerSessionRate = useMemo(() => {
    if (!activeEnrollment) return 800;
    return activeEnrollment.sessionsTotal > 0
      ? Math.round(
          (activeEnrollment.coursePriceMinorUnits / 100) / activeEnrollment.sessionsTotal
        )
      : 800;
  }, [activeEnrollment]);

  // Sync installment per-session rate when activeEnrollment changes
  useEffect(() => {
    if (activeEnrollment) {
      setInstallmentPerSessionRate(defaultInstallmentPerSessionRate);
    }
  }, [activeEnrollment?.id, defaultInstallmentPerSessionRate]);

  const effectiveInstallmentPerSessionRate =
    installmentPerSessionRate > 0 ? installmentPerSessionRate : defaultInstallmentPerSessionRate;

  const installmentSessionCount = useMemo(() => {
    if (effectiveInstallmentPerSessionRate <= 0) return 1;
    const calc = Math.floor(installmentAmount / effectiveInstallmentPerSessionRate);
    return calc > 0 ? calc : 1;
  }, [installmentAmount, effectiveInstallmentPerSessionRate]);

  // Allotment automatic weekly schedule modal state
  interface PendingAllotScheduleContext {
    type: "MANUAL_ALLOT" | "APPROVE_REQUEST";
    request?: AdminCourseEnrollmentRequestItem;
    courseTitle: string;
    studentName: string;
    studentId: string;
    courseId: string;
    teacherId?: string | null;
    feeRupees: number;
    paidRupees: number;
    perSessionRate: number;
    adminNotes?: string;
  }
  const [pendingAllotSchedule, setPendingAllotSchedule] = useState<PendingAllotScheduleContext | null>(null);

  const copyReceipt = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedReceiptId(code);
    setTimeout(() => setCopiedReceiptId(null), 2000);
  };

  // Sync state when activeEnrollment changes
  useEffect(() => {
    if (activeEnrollment) {
      setSelectedCourseId(activeEnrollment.courseId);
      if (activeEnrollment.teacherId) {
        setSelectedTeacherId(activeEnrollment.teacherId);
      }
      setTotalSessions(activeEnrollment.sessionsTotal);
      setCompletedSessions(
        Math.max(0, activeEnrollment.sessionsTotal - activeEnrollment.sessionsRemaining)
      );
      setFeeRupees(Math.round(activeEnrollment.coursePriceMinorUnits / 100));
      const totalPaidMinor = (activeEnrollment.payments || []).reduce(
        (sum, p) => sum + p.amountMinorUnits,
        0
      );
      if (totalPaidMinor > 0) {
        setPaidRupees(Math.round(totalPaidMinor / 100));
      } else if (activeEnrollment.payment) {
        setPaidRupees(Math.round(activeEnrollment.payment.amountMinorUnits / 100));
      } else {
        setPaidRupees(0);
      }
      setEnrollmentStatus(activeEnrollment.status);
      if (activeEnrollment.adminNotes) {
        setAdminNotes(activeEnrollment.adminNotes);
      }
    }
  }, [activeEnrollment]);

  // Derived list of all recorded payment tranches
  const allRecordedPayments = useMemo(() => {
    if (!activeEnrollment) return [];
    if (activeEnrollment.payments && activeEnrollment.payments.length > 0) {
      return activeEnrollment.payments;
    }
    if (activeEnrollment.payment) {
      return [
        {
          id: activeEnrollment.payment.id,
          amountMinorUnits: activeEnrollment.payment.amountMinorUnits,
          currency: "INR",
          gateway: "manual",
          gatewayPaymentId: activeEnrollment.payment.gatewayPaymentId || `RCPT-INIT-${activeEnrollment.id.slice(-4)}`,
          gatewayOrderId: null,
          status: activeEnrollment.payment.status,
          notes: "Initial admission payment tranche",
          createdAt: activeEnrollment.startedAt,
        },
      ];
    }
    return [];
  }, [activeEnrollment]);

  // Record 2nd, 3rd, or subsequent payment installment
  const handleRecordInstallment = () => {
    if (!activeEnrollment) return;
    if (installmentAmount <= 0) {
      showToast("Please enter an installment payment amount greater than ₹0.", "error");
      return;
    }

    // Calculate per-session charge and session count to schedule
    const perSessionRate = effectiveInstallmentPerSessionRate;
    const sessionCount = perSessionRate > 0 ? Math.floor(installmentAmount / perSessionRate) : 0;

    let slotsToSchedule: Array<{ startsAt: string; durationMinutes: number }> | undefined = undefined;
    if (isAutoScheduleInstallment && sessionCount > 0) {
      const days = installmentDays.length > 0 ? installmentDays : [installmentDay];
      slotsToSchedule = generateMultiDayWeeklySlots(
        installmentStartDate,
        days,
        installmentTime,
        sessionCount,
        installmentDuration
      ).map((s) => ({
        startsAt: s.startsAt,
        durationMinutes: s.durationMinutes,
      }));
    }

    startTransition(async () => {
      const res = await adminRecordEnrollmentPaymentAction({
        enrollmentId: activeEnrollment.id,
        amountRupees: installmentAmount,
        paymentMethod: installmentMethod,
        referenceCode: installmentRefCode.trim() || undefined,
        notes: installmentNotes.trim() || undefined,
        slots: slotsToSchedule,
      });

      if (res.success && res.data) {
        const newPaymentItem: EnrollmentPaymentItem = {
          id: res.data.paymentId,
          amountMinorUnits: Math.round(installmentAmount * 100),
          currency: "INR",
          gateway: installmentMethod,
          gatewayPaymentId: res.data.receiptCode,
          gatewayOrderId: null,
          status: PaymentStatus.PAID,
          notes: installmentNotes.trim() || `Installment payment tranche for ${activeEnrollment.courseTitle}`,
          createdAt: new Date().toISOString(),
        };

        const scheduledLessons: ScheduledLessonData[] = (res.data.newLessons || []).map((l: any) => ({
          id: l.id,
          trackingCode: l.trackingCode || l.id,
          startsAt: l.startsAt,
          durationMinutes: l.durationMinutes || 60,
          status: l.status || "SCHEDULED",
          teacherId: l.teacherId || null,
          teacherName: l.teacherName || "Faculty Mentor",
          payoutRupees: 500,
        }));

        setEnrollments((prev) =>
          prev.map((item) =>
            item.id === activeEnrollment.id
              ? {
                  ...item,
                  payments: [...(item.payments || []), newPaymentItem],
                  payment: newPaymentItem,
                  lessons: [...(item.lessons || []), ...scheduledLessons],
                }
              : item
          )
        );

        const newPaidTotal = res.data.totalPaidRupees;
        setPaidRupees(newPaidTotal);
        if (newPaidTotal >= feeRupees) {
          setPaymentStatus("Fully paid");
        } else {
          setPaymentStatus("Partially paid");
        }

        const scheduledSuffix =
          res.data.scheduledCount && res.data.scheduledCount > 0
            ? ` & ${res.data.scheduledCount} weekly sessions scheduled!`
            : "!";

        showToast(
          `Payment of ₹${installmentAmount.toLocaleString("en-IN")} recorded${scheduledSuffix} Receipt: ${res.data.receiptCode}`,
          "success"
        );
        setIsRecordingPayment(false);
        setInstallmentRefCode("");
        setInstallmentNotes("");
        router.refresh();
      } else {
        showToast(res.error || "Failed to record payment installment.", "error");
      }
    });
  };

  const currentStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return (
      students.find((s) => s.id === selectedStudentId) ||
      (activeEnrollment
        ? {
            id: activeEnrollment.studentId,
            customId: activeEnrollment.studentCustomId || null,
            name: activeEnrollment.studentName,
            email: activeEnrollment.studentEmail,
            timezone: activeEnrollment.studentTimezone,
            guardianName: activeEnrollment.studentGuardianName,
            age: activeEnrollment.studentAge,
            phone: activeEnrollment.studentPhone,
            country: activeEnrollment.studentCountry,
          }
        : null)
    );
  }, [students, selectedStudentId, activeEnrollment]);

  const currentCourse = useMemo(() => {
    return (
      courses.find((c) => c.id === selectedCourseId) ||
      (activeEnrollment
        ? {
            id: activeEnrollment.courseId,
            title: activeEnrollment.courseTitle,
            instrument: activeEnrollment.courseInstrument,
            level: activeEnrollment.courseLevel,
            sessionCount: activeEnrollment.sessionsTotal,
            priceMinorUnits: activeEnrollment.coursePriceMinorUnits,
            durationWeeks: activeEnrollment.courseDurationWeeks,
          }
        : courses[0])
    );
  }, [courses, selectedCourseId, activeEnrollment]);

  const currentTeacher = useMemo(() => {
    return (
      teachers.find((t) => t.id === selectedTeacherId) ||
      teachers[0] ||
      null
    );
  }, [teachers, selectedTeacherId]);

  // Live calculation of amount due
  const amountDueRupees = Math.max(0, feeRupees - paidRupees);

  // Live preview session dates generator (uses actual scheduled lessons if available)
  const generatedPreviewDates = useMemo(() => {
    if (activeEnrollment?.lessons && activeEnrollment.lessons.length > 0) {
      const sorted = [...activeEnrollment.lessons]
        .filter((l) => l.status === "SCHEDULED" || l.status === "RESCHEDULED" || l.status === "COMPLETED")
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

      if (sorted.length > 0) {
        return sorted.slice(0, 4).map((l) => {
          const d = new Date(l.startsAt);
          return d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            timeZone: "Asia/Kolkata",
          });
        });
      }
    }

    const list: string[] = [];
    const base = new Date(startDate);
    if (isNaN(base.getTime())) return list;

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatPreview = (d: Date) =>
      `${DAY_NAMES[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()]}`;

    let cur = new Date(base);
    let count = 0;
    while (count < 4 && count < totalSessions) {
      const day = cur.getDay(); // 0 = Sun, 2 = Tue, 4 = Thu
      if (recurringCadence === "TUE_THU") {
        if (day === 2 || day === 4) {
          list.push(formatPreview(cur));
          count++;
        }
      } else if (recurringCadence === "MON_WED_FRI") {
        if (day === 1 || day === 3 || day === 5) {
          list.push(formatPreview(cur));
          count++;
        }
      } else {
        // Weekly on same day
        list.push(formatPreview(cur));
        count++;
        cur.setDate(cur.getDate() + 7);
        continue;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [activeEnrollment?.lessons, startDate, recurringCadence, totalSessions]);

  // Dynamic schedule, dates, and session metrics derived from actual lessons and configuration
  const enrollmentSummaryMetrics = useMemo(() => {
    const rawLessons = activeEnrollment?.lessons || [];
    const validLessons = rawLessons
      .filter((l) => l.status === "SCHEDULED" || l.status === "RESCHEDULED" || l.status === "COMPLETED")
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    let scheduleLabel = "Weekly · Pending schedule";
    let datesLabel = "Not scheduled yet";
    let durationMins = activeEnrollment?.lessons?.[0]?.durationMinutes || installmentDuration || 60;

    if (validLessons.length > 0) {
      const first = validLessons[0];
      const last = validLessons[validLessons.length - 1];
      const firstDate = new Date(first.startsAt);
      const lastDate = new Date(last.startsAt);
      durationMins = first.durationMinutes || 60;

      // Extract unique day names in IST
      const distinctDays = Array.from(
        new Set(
          validLessons.map((l) =>
            new Date(l.startsAt).toLocaleDateString("en-US", {
              weekday: "short",
              timeZone: "Asia/Kolkata",
            })
          )
        )
      );

      const timeStr = firstDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });

      scheduleLabel = `${distinctDays.join(" / ")} · ${timeStr} IST`;

      const formatDate = (d: Date) =>
        d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        });

      datesLabel = `${formatDate(firstDate)} – ${formatDate(lastDate)}`;
    } else {
      // If no lessons yet recorded in DB, display configured weekly installment schedule preview
      const effectiveDays = installmentDays.length > 0 ? installmentDays : [installmentDay];
      const dayLabels = WEEKDAY_OPTIONS.filter((w) => effectiveDays.includes(w.dayIndex)).map((w) => w.label);
      const [h, m] = installmentTime.split(":").map(Number);
      const ampm = (h ?? 17) >= 12 ? "PM" : "AM";
      const h12 = (h ?? 17) % 12 || 12;
      const timeStr = `${String(h12).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
      scheduleLabel = `${dayLabels.join(", ") || "Wed"} · ${timeStr} IST`;

      if (installmentStartDate) {
        const previewSlots = generateMultiDayWeeklySlots(
          installmentStartDate,
          effectiveDays,
          installmentTime,
          installmentSessionCount,
          installmentDuration
        );
        if (previewSlots.length > 0) {
          datesLabel = `${previewSlots[0].dateFormatted} – ${previewSlots[previewSlots.length - 1].dateFormatted}`;
        }
      }
    }

    const scheduledCount = validLessons.length;
    const sessionsLabel =
      scheduledCount > 0
        ? `${scheduledCount} of ${totalSessions} sessions (${durationMins}m)`
        : `${totalSessions} × ${durationMins} minutes`;

    return {
      scheduleLabel,
      datesLabel,
      sessionsLabel,
      durationMins,
      scheduledCount,
    };
  }, [
    activeEnrollment?.lessons,
    installmentDay,
    installmentDays,
    installmentSessionsPerWeek,
    installmentTime,
    installmentStartDate,
    installmentSessionCount,
    installmentDuration,
    totalSessions,
  ]);

  const formattedIstDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  // ─── 0. HELPER: EXECUTE APPROVE OR ALLOT (WITH OPTIONAL SCHEDULED SLOTS) ───
  const executeApproveOrAllot = (
    ctx: PendingAllotScheduleContext,
    slots?: Array<{ startsAt: string; durationMinutes: number }>
  ) => {
    startTransition(async () => {
      const res = await adminApproveAndAllotCourseAction({
        requestId: ctx.request?.id || null,
        studentId: ctx.studentId,
        courseId: ctx.courseId,
        teacherId: ctx.teacherId || null,
        sessionsRemaining: allotSessions > 0 ? allotSessions : (ctx.request?.courseSessionCount || 24),
        feeRupees: ctx.feeRupees,
        paidRupees: ctx.paidRupees,
        paymentPlan: ctx.request?.paymentPlan as any,
        adminNotes: ctx.adminNotes,
        slots,
      });

      if (res.success && res.data) {
        const scheduledLessonsCount = res.data.scheduledCount || 0;
        const msgSuffix =
          scheduledLessonsCount > 0 ? ` & ${scheduledLessonsCount} weekly sessions scheduled!` : "!";
        showToast(
          `Success! ${ctx.courseTitle} approved and allotted to ${ctx.studentName}${msgSuffix}`,
          "success"
        );

        if (ctx.request) {
          setCourseRequests((prev) =>
            prev.map((r) => (r.id === ctx.request!.id ? { ...r, status: "APPROVED" } : r))
          );
        }

        const teacherObj = teachers.find((t) => t.id === ctx.teacherId);
        const initialReceipt = `RCPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const initialPaymentItem: EnrollmentPaymentItem = {
          id: `pmt_${res.data.enrollmentId}`,
          amountMinorUnits: Math.round(ctx.paidRupees * 100),
          currency: "INR",
          gateway: "UPI",
          gatewayPaymentId: initialReceipt,
          gatewayOrderId: null,
          status: PaymentStatus.PAID,
          notes: "Initial admission payment tranche",
          createdAt: new Date().toISOString(),
        };

        const scheduledLessons: ScheduledLessonData[] = (res.data.newLessons || []).map((l: any) => ({
          id: l.id,
          trackingCode: l.trackingCode || l.id,
          startsAt: l.startsAt,
          durationMinutes: l.durationMinutes || 60,
          status: l.status || "SCHEDULED",
          teacherId: l.teacherId || null,
          teacherName: l.teacherName || "Faculty Mentor",
          payoutRupees: 500,
        }));

        const newEnr: EnrollmentRecord = {
          id: res.data.enrollmentId,
          studentId: ctx.studentId,
          studentName: ctx.studentName,
          studentEmail: currentStudent?.email || "",
          studentPhone: currentStudent?.phone,
          studentTimezone: currentStudent?.timezone || "Asia/Kolkata",
          studentGuardianName: currentStudent?.guardianName,
          studentAge: currentStudent?.age,
          studentCountry: currentStudent?.country,
          courseId: ctx.courseId,
          courseTitle: ctx.courseTitle,
          courseInstrument:
            ctx.request?.courseInstrument ||
            courses.find((c) => c.id === ctx.courseId)?.instrument ||
            "General",
          courseLevel:
            ctx.request?.courseLevel ||
            courses.find((c) => c.id === ctx.courseId)?.level ||
            "BEGINNER",
          courseSessionCount:
            ctx.request?.courseSessionCount ||
            courses.find((c) => c.id === ctx.courseId)?.sessionCount ||
            24,
          coursePriceMinorUnits: Math.round(ctx.feeRupees * 100),
          courseDurationWeeks: 12,
          teacherId: teacherObj?.id || null,
          teacherName: teacherObj?.name || null,
          teacherPayoutRupees: teacherObj?.payoutRupees || 500,
          sessionsRemaining: allotSessions > 0 ? allotSessions : (ctx.request?.courseSessionCount || 24),
          sessionsTotal:
            ctx.request?.courseSessionCount ||
            courses.find((c) => c.id === ctx.courseId)?.sessionCount ||
            24,
          status: EnrollmentStatus.ACTIVE,
          startedAt: new Date().toISOString(),
          adminNotes: ctx.adminNotes,
          lessons: scheduledLessons,
          payment: ctx.paidRupees > 0 ? initialPaymentItem : null,
          payments: ctx.paidRupees > 0 ? [initialPaymentItem] : [],
        };

        setEnrollments((prev) => [newEnr, ...prev]);
        setSelectedEnrollmentId(res.data.enrollmentId);
        setIsManualAddOpen(false);
        setPendingAllotSchedule(null);
        router.refresh();
      } else {
        showToast(res.error || "Failed to allot course.", "error");
      }
    });
  };

  // ─── 0. APPROVE STUDENT COURSE REQUEST & ALLOT ─────────────────────
  const handleApproveRequest = (req: AdminCourseEnrollmentRequestItem) => {
    if (!currentStudent) return;
    const fee = allotFeeRupees > 0 ? allotFeeRupees : Math.round(req.coursePriceMinorUnits / 100);
    const paid = allotPaidRupees;
    const perRate =
      req.courseSessionCount > 0
        ? Math.round((req.coursePriceMinorUnits / 100) / req.courseSessionCount)
        : 500;

    const ctx: PendingAllotScheduleContext = {
      type: "APPROVE_REQUEST",
      request: req,
      courseTitle: req.courseTitle,
      studentName: req.studentName,
      studentId: req.studentId,
      courseId: req.courseId,
      teacherId: allotTeacherId || null,
      feeRupees: fee,
      paidRupees: paid,
      perSessionRate: perRate,
      adminNotes: allotNotes.trim() || undefined,
    };

    // If student has paid an amount, ask for schedule timing and day of week
    if (paid > 0) {
      setPendingAllotSchedule(ctx);
    } else {
      executeApproveOrAllot(ctx, undefined);
    }
  };

  // ─── 0.B MANUAL ALLOTMENT OF CATALOG COURSE TO STUDENT ───────────────
  const handleManualAllotCourse = () => {
    if (!currentStudent || !manualCourseId) return;
    const crs = courses.find((c) => c.id === manualCourseId);
    if (!crs) return;

    const fee = allotFeeRupees > 0 ? allotFeeRupees : Math.round(crs.priceMinorUnits / 100);
    const paid = allotPaidRupees;
    const perRate =
      allotSessions > 0
        ? Math.round(fee / allotSessions)
        : crs.sessionCount > 0
        ? Math.round((crs.priceMinorUnits / 100) / crs.sessionCount)
        : 500;

    const ctx: PendingAllotScheduleContext = {
      type: "MANUAL_ALLOT",
      courseTitle: crs.title,
      studentName: currentStudent.name,
      studentId: currentStudent.id,
      courseId: crs.id,
      teacherId: allotTeacherId || null,
      feeRupees: fee,
      paidRupees: paid,
      perSessionRate: perRate,
      adminNotes: allotNotes.trim() || undefined,
    };

    // If student has paid an amount, ask for schedule timing and day of week
    if (paid > 0) {
      setPendingAllotSchedule(ctx);
    } else {
      executeApproveOrAllot(ctx, undefined);
    }
  };

  // ─── HELPER: FOCUS AND ALLOT INCOMING COURSE REQUEST ─────────────────
  const handleSelectRequestToAllot = (req: AdminCourseEnrollmentRequestItem) => {
    setSelectedStudentId(req.studentId);
    setViewMode("PLANNER");
    setAllotFeeRupees(Math.round(req.coursePriceMinorUnits / 100));
    setAllotPaidRupees(0);
    setTimeout(() => {
      const el = document.getElementById(`pending-course-request-${req.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
  };

  // ─── 1. SAVE COMPREHENSIVE ENROLLMENT PLAN ────────────────────────────
  const handleSaveEnrollment = (isDraft: boolean = false) => {
    if (!currentStudent || !currentCourse) {
      showToast("Please ensure student and course are selected.", "error");
      return;
    }

    startTransition(async () => {
      const res = await saveFullEnrollmentPlanAction({
        enrollmentId: activeEnrollment?.id || null,
        trialRequestId: linkedTrialId || null,
        studentId: currentStudent.id,
        courseId: currentCourse.id,
        teacherId: selectedTeacherId || null,
        sessionsRemaining: Math.max(1, totalSessions - completedSessions),
        status: activeEnrollment?.status || EnrollmentStatus.ACTIVE,
        adminNotes: isDraft ? `[DRAFT] ${adminNotes.trim()}` : adminNotes.trim() || undefined,
        paymentFeeRupees: feeRupees,
      });

      if (res.success && res.data) {
        const targetId = res.data.enrollmentId || activeEnrollment?.id;
        if (targetId) {
          setEnrollments((prev) =>
            prev.map((item) =>
              item.id === targetId
                ? {
                    ...item,
                    coursePriceMinorUnits: Math.round(feeRupees * 100),
                    sessionsTotal: totalSessions,
                    sessionsRemaining: Math.max(1, totalSessions - completedSessions),
                    teacherId: selectedTeacherId || item.teacherId,
                    teacherName: currentTeacher?.name || item.teacherName,
                    status: enrollmentStatus,
                    adminNotes: isDraft ? `[DRAFT] ${adminNotes.trim()}` : adminNotes.trim() || undefined,
                  }
                : item
            )
          );
        }

        showToast(
          isDraft
            ? "Enrollment draft saved."
            : `Enrollment saved! 1-on-1 timetable generated for ${currentStudent.name}.`,
          "success"
        );
        router.refresh();
      } else {
        showToast(res.error || "Could not save enrollment.", "error");
      }
    });
  };

  // ─── 2. SCHEDULE INDIVIDUAL 1-ON-1 LESSON ────────────────────────────
  const handleScheduleSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEnrollment) {
      showToast("Please save enrollment before scheduling individual lessons.", "error");
      return;
    }

    startTransition(async () => {
      const res = await scheduleEnrollmentLessonAction({
        enrollmentId: activeEnrollment.id,
        teacherId: selectedTeacherId || activeEnrollment.teacherId || undefined,
        startsAt: new Date(singleLessonDate).toISOString(),
        durationMinutes: singleLessonDuration,
      });

      if (res.success && res.data) {
        showToast(
          `Lesson scheduled! Tracking ID: ${res.data.trackingCode}`,
          "success"
        );
        // Optimistically update table
        const teacherObj = teachers.find((t) => t.id === selectedTeacherId);
        const newLesson: ScheduledLessonData = {
          id: res.data.lessonId,
          trackingCode: res.data.trackingCode,
          startsAt: new Date(singleLessonDate).toISOString(),
          durationMinutes: singleLessonDuration,
          status: "SCHEDULED",
          teacherId: selectedTeacherId,
          teacherName: teacherObj?.name || "Assigned Faculty",
          payoutRupees: teacherObj?.payoutRupees || 500,
        };

        setEnrollments((prev) =>
          prev.map((item) =>
            item.id === activeEnrollment.id
              ? {
                  ...item,
                  lessons: [newLesson, ...item.lessons],
                }
              : item
          )
        );
      } else {
        showToast(res.error || "Failed to schedule lesson.", "error");
      }
    });
  };

  // ─── 3. BULK RECURRING SCHEDULE ──────────────────────────────────────
  const handleBulkSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEnrollment) {
      showToast("Please save enrollment first.", "error");
      return;
    }

    startTransition(async () => {
      const startMs = new Date(bulkStartDate).getTime();
      const slots = [];
      for (let i = 0; i < bulkCount; i++) {
        slots.push({
          startsAt: new Date(startMs + i * bulkIntervalDays * 86400000).toISOString(),
          durationMinutes: sessionDurationMinutes,
        });
      }

      const res = await bulkScheduleEnrollmentLessonsAction({
        enrollmentId: activeEnrollment.id,
        teacherId: selectedTeacherId || activeEnrollment.teacherId || undefined,
        slots,
      });

      if (res.success) {
        showToast(
          `Bulk schedule generated! ${res.data?.createdCount || slots.length} sessions created with tracking codes.`,
          "success"
        );
        router.refresh();
      } else {
        showToast(res.error || "Failed to generate bulk schedule.", "error");
      }
    });
  };

  // ─── 4. RESCHEDULE EXISTING LESSON ───────────────────────────────────
  const handleReschedule = (lessonId: string) => {
    if (!rescheduleDateInput) return;

    startTransition(async () => {
      const res = await rescheduleEnrollmentLessonAction({
        lessonId,
        startsAt: new Date(rescheduleDateInput).toISOString(),
      });

      if (res.success) {
        showToast("Lesson rescheduled successfully.", "success");
        setEnrollments((prev) =>
          prev.map((enr) => ({
            ...enr,
            lessons: enr.lessons.map((l) =>
              l.id === lessonId
                ? {
                    ...l,
                    startsAt: new Date(rescheduleDateInput).toISOString(),
                    status: "RESCHEDULED",
                  }
                : l
            ),
          }))
        );
        setReschedulingLessonId(null);
      } else {
        showToast(res.error || "Failed to reschedule lesson.", "error");
      }
    });
  };

  // ─── 5. CANCEL LESSON ────────────────────────────────────────────────
  const handleCancelLesson = (lessonId: string) => {
    startTransition(async () => {
      const res = await deleteOrCancelEnrollmentLessonAction(lessonId);
      if (res.success) {
        showToast("Lesson cancelled.", "success");
        setEnrollments((prev) =>
          prev.map((enr) => ({
            ...enr,
            lessons: enr.lessons.map((l) =>
              l.id === lessonId ? { ...l, status: "CANCELLED" } : l
            ),
          }))
        );
      } else {
        showToast(res.error || "Could not cancel lesson.", "error");
      }
    });
  };

  // ─── 6. REASSIGN FACULTY TEACHER FOR A LESSON ─────────────────────────
  const handleReassignLesson = (lessonId: string, newTeacherId: string) => {
    if (!newTeacherId) return;
    const tObj = teachers.find((t) => t.id === newTeacherId);
    setEnrollments((prev) =>
      prev.map((item) =>
        item.id === activeEnrollment?.id
          ? {
              ...item,
              lessons: item.lessons.map((l) =>
                l.id === lessonId
                  ? {
                      ...l,
                      teacherId: newTeacherId,
                      teacherName: tObj?.name || "Assigned Faculty",
                      payoutRupees: tObj?.payoutRupees || 500,
                    }
                  : l
              ),
            }
          : item
      )
    );
    showToast(`Faculty reassigned to ${tObj?.name || "Faculty"}.`, "success");
    setReassigningLessonId(null);
  };

  return (
    <div className="space-y-6 pb-14 font-sans">
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
          <span className="font-bold text-heading">Create enrollment</span>
        </div>

        <div className="flex items-center gap-2.5 text-body/80 self-end sm:self-auto">
          {/* View mode toggle */}
          <div className="flex items-center bg-white border border-neutral-200/90 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("PLANNER")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "PLANNER"
                  ? "bg-[#3C096C] text-white shadow-xs"
                  : "text-body hover:text-heading"
              }`}
            >
              Planner & Scheduler
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ROSTER")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "ROSTER"
                  ? "bg-[#3C096C] text-white shadow-xs"
                  : "text-body hover:text-heading"
              }`}
            >
              All Enrollments ({enrollments.length})
            </button>
          </div>

          {/* IST Timezone Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-neutral-200/90 text-[11px] font-medium shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-primary/70" />
            <span suppressHydrationWarning>IST · {formattedIstDate}</span>
          </div>
        </div>
      </div>

      {/* ─── 2. MAIN HEADER & ACTIONS ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Create enrollment
          </h1>
        </div>
      </div>

      {/* ─── 3. MODERN STEPPER PROGRESS BAR ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Step 1: Trial */}
        <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 font-numeric">
            1
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-heading">Trial</div>
            <div className="text-[11px] text-body/60 truncate font-numeric">
              {linkedTrialId ? `TRL-${linkedTrialId.slice(-6)} · Complete` : "TRL-2026-1048 · Complete"}
            </div>
          </div>
        </div>

        {/* Step 2: Student */}
        <div className={`p-3.5 rounded-2xl bg-white border shadow-2xs flex items-center gap-3 ${
          !selectedStudentId
            ? "border-[#3C096C]/40 ring-1 ring-[#3C096C]/20"
            : "border-neutral-200/80"
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-numeric ${
            !selectedStudentId
              ? "bg-[#3C096C] text-white"
              : "bg-emerald-100 text-emerald-800"
          }`}>
            2
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-heading">Student</div>
            <div className="text-[11px] text-body/60 truncate font-numeric">
              {currentStudent ? `${currentStudent.name} · Selected` : "Select student"}
            </div>
          </div>
        </div>

        {/* Step 3: Enrollment */}
        <div className={`p-3.5 rounded-2xl bg-white border shadow-2xs flex items-center gap-3 ${
          selectedStudentId
            ? "border-[#3C096C]/30 ring-1 ring-[#3C096C]/20"
            : "border-neutral-200/80"
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-numeric ${
            !selectedStudentId
              ? "bg-neutral-100 text-body/40"
              : "bg-[#3C096C] text-white"
          }`}>
            3
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-heading">Enrollment</div>
            <div className="text-[11px] text-body/60 truncate font-numeric">
              {!selectedStudentId
                ? "Awaiting student"
                : activeEnrollment
                ? `ENR-${activeEnrollment.id.slice(-4)} · Active`
                : "New record · In progress"}
            </div>
          </div>
        </div>

        {/* Step 4: Sessions */}
        <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-numeric ${
            !selectedStudentId || !activeEnrollment
              ? "bg-neutral-100 text-body/40"
              : "bg-emerald-100 text-emerald-800"
          }`}>
            4
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-heading">Sessions</div>
            <div className="text-[11px] text-body/60 truncate font-numeric">
              {!selectedStudentId
                ? "Awaiting student"
                : `${activeEnrollment?.lessons.length || 0} scheduled · Active`}
            </div>
          </div>
        </div>
      </div>

      {viewMode === "ROSTER" ? (
        /* ─── ALL ENROLLMENTS ROSTER VIEW ───────────────────────────────── */
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-heading">All Course Enrollments</h2>
              <p className="text-xs text-body/60">
                Active catalog subscriptions, faculty allotments, and remaining session balances.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50/70 border-b border-neutral-200 text-[11px] font-semibold text-body uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Enrolled Course</th>
                  <th className="py-3 px-4">Assigned Faculty</th>
                  <th className="py-3 px-4">Progress / Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-numeric">
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-4 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-[#3C096C] flex items-center justify-center mx-auto shadow-2xs">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-heading">
                            No Converted Trial Student Enrollments
                          </h4>
                          <p className="text-xs text-body/70 mt-1 leading-relaxed">
                            Only students converted by admin through the Trial Bookings CRM portal appear in this section.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push("/admin/trials")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2D0752] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <span>Open Trial Bookings CRM</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  enrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-heading">{enr.studentName}</div>
                      <div className="text-[11px] text-body/60">{enr.studentEmail}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-heading">{enr.courseTitle}</div>
                      <div className="text-[11px] text-body/60">
                        {enr.courseInstrument} · {enr.courseLevel}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-heading">
                        {enr.teacherName || "Unassigned"}
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        ₹{enr.teacherPayoutRupees} / class
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-heading">
                        {enr.sessionsTotal - enr.sessionsRemaining} / {enr.sessionsTotal} sessions
                      </div>
                      <div className="text-[11px] text-body/60">
                        {enr.lessons.length} scheduled instances
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {enr.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEnrollmentId(enr.id);
                          setViewMode("PLANNER");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white font-bold text-xs transition-all shadow-2xs"
                      >
                        Open Planner & Timetable
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !selectedStudentId ? (
        /* ─── 4. APPLE-DESIGN STUDENT SELECTION WORKSPACE ───────────────── */
        <div className="space-y-6">
          {/* 1. Hero Prompt Card */}
          <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-2xs p-6 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3C096C] to-[#7B2CBF] text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-purple-100">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-heading">
                    Select a student to load enrollment details
                  </h2>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-[#3C096C] border border-purple-200/70 self-start sm:self-auto font-numeric shrink-0">
                <Users className="w-3.5 h-3.5" />
                <span>{isDirectEnrolmentScoped ? "1 Student (Direct Mode)" : `${students.length} Converted Students`}</span>
              </span>
            </div>

            {/* Prominent Searchable Selector */}
            {visibleStudents.length > 0 && (
              <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 space-y-2">
                <label className="text-xs font-bold text-heading flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[#3C096C]" />
                  <span>Quick Student Search &amp; Filter</span>
                </label>
                <SearchableStudentSelector
                  students={visibleStudents}
                  selectedStudentId={selectedStudentId}
                  onSelectStudent={handleStudentChange}
                  enrollments={enrollments}
                  courseRequests={courseRequests}
                  isDirectMode={isDirectEnrolmentScoped}
                  onUnlockDirectMode={() => setIsDirectEnrolmentScoped(false)}
                />
              </div>
            )}
          </div>

          {/* 2. Pending Course Admission Requests (if any) */}
          {allPendingCourseRequests.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50/90 via-amber-50/40 to-white rounded-3xl border border-purple-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-heading">
                      Admission Requests Awaiting Review ({allPendingCourseRequests.length})
                    </h3>
                    <p className="text-xs text-body/70">
                      These converted students have requested course enrollments. Click to select student and allot faculty.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allPendingCourseRequests.map((req) => {
                  const feeFormatted = `₹${Math.round(req.coursePriceMinorUnits / 100).toLocaleString("en-IN")}`;
                  return (
                    <div
                      key={req.id}
                      onClick={() => handleSelectRequestToAllot(req)}
                      className="group p-4 rounded-2xl bg-white border border-purple-200/80 hover:border-[#3C096C] shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-[#3C096C] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {(req.studentName || "S")[0].toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-heading group-hover:text-[#3C096C] transition-colors truncate">
                              {req.studentName}
                            </h4>
                            <p className="text-[11px] text-body/60 truncate">{req.courseTitle}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-numeric bg-purple-100 text-[#3C096C] shrink-0">
                          {feeFormatted}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                          <span>Needs Allotment</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3C096C] group-hover:translate-x-0.5 transition-transform">
                          <span>Select &amp; Allot</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


        </div>
      ) : (
        /* ─── 4. MAIN 2-COLUMN WORKSPACE (MATCHING ATTACHED SCREENSHOT) ─── */
        <div className="space-y-5">
          {/* Apple-style Selected Student Control Bar */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3C096C] to-[#7B2CBF] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-2xs ring-2 ring-purple-100">
                {(currentStudent?.name || "S")[0].toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-heading truncate">
                    {currentStudent?.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-[#3C096C] font-mono text-[11px] font-bold border border-purple-200/80">
                    {currentStudent?.customId || (currentStudent?.id ? `S${currentStudent.id.slice(-4).toUpperCase()}` : "S0001")}
                  </span>
                  {studentEnrollments.length > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{studentEnrollments.length} Active {studentEnrollments.length === 1 ? "Course" : "Courses"}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-[#3C096C] text-[10px] font-bold border border-purple-200">
                      <Sparkles className="w-3 h-3 text-[#3C096C]" />
                      <span>Converted Lead</span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-body/60 truncate mt-1 flex items-center gap-2">
                  <span className="truncate">{currentStudent?.email}</span>
                  {currentStudent?.timezone && (
                    <span className="hidden sm:inline text-body/40">· {currentStudent.timezone}</span>
                  )}
                  {currentStudent?.phone && (
                    <span className="hidden md:inline text-body/40">· {currentStudent.phone}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setIsDirectEnrolmentScoped(false);
                  handleStudentChange("");
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#3C096C] text-xs font-bold border border-purple-200/80 transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#3C096C]" />
                <span>{isDirectEnrolmentScoped ? "Exit Direct Mode" : "Change Student"}</span>
              </button>
            </div>
          </div>

          {/* Direct Enrolment Banner */}
          {isDirectEnrolmentScoped && currentStudent && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-purple-100/50 to-white border border-purple-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#3C096C] text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs sm:text-sm text-heading truncate">
                      Direct Enrolment Mode · {currentStudent.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#3C096C] text-white font-mono text-[10px] font-bold">
                      {currentStudent.customId || `S${currentStudent.id.slice(-4).toUpperCase()}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      Single Student Focus
                    </span>
                  </div>
                  <p className="text-[11px] text-body/70 mt-0.5">
                    Only {currentStudent.name} is enrolled here. Fill in course details below to allot directly without trial.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDirectEnrolmentScoped(false)}
                className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-heading text-xs font-semibold border border-purple-200 shadow-2xs shrink-0 self-start sm:self-auto cursor-pointer"
                title="Unlock full student roster"
              >
                <Users className="w-3.5 h-3.5 text-[#3C096C]" />
                <span>Show All Students ({students.length})</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ─── LEFT COLUMN: 4 NUMBERED SECTIONS (8 COLS / ~66%) ───────── */}
          <div className="lg:col-span-8 space-y-5">
            {/* ─── SECTION 1: STUDENT & COURSE ENROLLMENT ───────────────── */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
              {/* Header with Title on Left & Compact Request Pill + Actions on Right */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-1 border-b border-neutral-100/80">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-lg font-bold text-heading">
                      1 · Student & course enrollment
                    </h2>
                    {displayPendingRequests.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#3C096C] border border-purple-200/80 font-numeric shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>{displayPendingRequests.length} {displayPendingRequests.length === 1 ? "Request" : "Requests"}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Side: Compact Request Pill & Manual Allotment Toggle */}
                <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
                  {displayPendingRequests.map((req) => {
                    const isSelected = selectedStudentId === req.studentId;
                    const feeFormatted = `₹${Math.round(req.coursePriceMinorUnits / 100).toLocaleString("en-IN")}`;
                    const perClass = Math.round(
                      req.coursePriceMinorUnits / (req.courseSessionCount > 0 ? req.courseSessionCount : 24) / 100
                    );

                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => handleSelectRequestToAllot(req)}
                        title={`Requested: ${req.courseTitle} (₹${perClass}/session)`}
                        className={`group inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all shadow-2xs active:scale-[0.98] cursor-pointer ${
                          isSelected
                            ? "bg-purple-50/90 border-[#3C096C] ring-2 ring-[#3C096C]/15"
                            : "bg-white hover:bg-neutral-50 border-purple-200/80 hover:border-[#3C096C]/50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3C096C] animate-pulse shrink-0" />
                          <span className="font-bold text-heading text-xs truncate max-w-[100px] sm:max-w-[130px]">
                            {req.studentName}
                          </span>
                          <span className="text-[10px] font-bold font-numeric text-[#3C096C] bg-purple-100/70 px-1.5 py-0.2 rounded shrink-0">
                            {feeFormatted}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight transition-all shrink-0 ${
                            isSelected
                              ? "bg-[#3C096C] text-white shadow-2xs"
                              : "bg-purple-100 text-[#3C096C] group-hover:bg-[#3C096C] group-hover:text-white"
                          }`}
                        >
                          {isSelected ? "Reviewing" : "Review"}
                        </span>
                      </button>
                    );
                  })}

                  {/* Quick Add / Manual Allotment Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsManualAddOpen(!isManualAddOpen)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                      isManualAddOpen
                        ? "bg-purple-100 text-[#3C096C] border border-purple-300"
                        : "bg-white hover:bg-neutral-50 text-[#3C096C] border border-purple-200"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-[#3C096C]" />
                    <span>{isManualAddOpen ? "Hide Allotment Form" : "Allot Manually"}</span>
                  </button>
                </div>
              </div>

              {/* Student Selector Card */}
              <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/90 space-y-2.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-heading flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-[#3C096C]" />
                      <span>Student (Enrolled &amp; Registered Roster)</span>
                    </label>
                  </div>
                  <span className="text-[11px] font-semibold text-purple-900 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200/70 self-start sm:self-auto font-numeric">
                    {isDirectEnrolmentScoped ? "1 Student (Direct Mode)" : `${students.length} Students`}
                  </span>
                </div>

                {visibleStudents.length > 0 ? (
                  <SearchableStudentSelector
                    students={visibleStudents}
                    selectedStudentId={selectedStudentId}
                    onSelectStudent={handleStudentChange}
                    enrollments={enrollments}
                    courseRequests={courseRequests}
                    isDirectMode={isDirectEnrolmentScoped}
                    onUnlockDirectMode={() => setIsDirectEnrolmentScoped(false)}
                  />
                ) : (
                  <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200/80 text-xs text-purple-900 space-y-1.5">
                    <div className="font-semibold flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-[#3C096C]" />
                      <span>No Converted Trial Students Yet</span>
                    </div>
                    <p className="text-[11px] text-purple-700 leading-snug">
                      Only students converted by admin through the Trial Bookings CRM portal appear in this list.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/admin/trials")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#3C096C] hover:bg-[#2D0752] text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      <span>Go to Trial CRM to Convert Leads</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* ─── ACTIVE ENROLLED COURSES LIST (IF ANY) ─── */}
              {studentEnrollments.length > 0 && (
                <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#3C096C]" />
                      <span className="font-semibold text-xs text-heading">
                        Active Courses Allotted to {currentStudent?.name}:
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {studentEnrollments.map((enr) => {
                      const isThisActive = enr.id === activeEnrollment?.id;
                      const paidAmount = enr.payment ? Math.round(enr.payment.amountMinorUnits / 100) : 0;
                      const totalFee = Math.round(enr.coursePriceMinorUnits / 100);
                      const dueAmount = Math.max(0, totalFee - paidAmount);

                      return (
                        <div
                          key={enr.id}
                          onClick={() => setSelectedEnrollmentId(enr.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                            isThisActive
                              ? "bg-white border-[#3C096C] shadow-xs ring-1 ring-[#3C096C]/20"
                              : "bg-white/70 hover:bg-white border-neutral-200 hover:border-purple-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-xs text-heading line-clamp-1">
                                {enr.courseTitle}
                              </div>
                              <div className="text-[11px] text-body/60 mt-0.5">
                                {enr.courseInstrument} · {enr.courseLevel} · {enr.courseSessionCount} sessions
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                isThisActive
                                  ? "bg-[#3C096C] text-white"
                                  : "bg-purple-100 text-[#3C096C]"
                              }`}
                            >
                              {isThisActive ? "Active in Planner" : "Select"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-numeric pt-1.5 border-t border-neutral-100">
                            <span className="text-body/70">
                              Mentor: <strong className="text-heading font-medium">{enr.teacherName || "Unassigned"}</strong>
                            </span>
                            <div className="flex items-center gap-1.5 font-bold">
                              {dueAmount === 0 ? (
                                <span className="text-emerald-700">✓ Fully Paid</span>
                              ) : (
                                <span className="text-amber-800">Paid: ₹{paidAmount.toLocaleString("en-IN")} · Due: ₹{dueAmount.toLocaleString("en-IN")}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── PENDING COURSE REQUEST REVIEW & APPROVAL ─── */}
              {pendingRequests.length > 0 && (
                <div className="space-y-4">
                  {pendingRequests.map((req) => {
                    const reqFeeRupees = allotFeeRupees > 0 ? allotFeeRupees : Math.round(req.coursePriceMinorUnits / 100);
                    const remainingCalc = Math.max(0, reqFeeRupees - allotPaidRupees);

                    return (
                      <div
                        key={req.id}
                        id={`pending-course-request-${req.id}`}
                        className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/70 via-purple-50/30 to-white border-2 border-purple-300 shadow-xs space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#3C096C] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-serif text-sm font-bold text-heading">
                                Course Admission Request from {req.studentName}
                              </div>
                              <div className="text-[11px] text-body/70 mt-0.5">
                                Submitted via student catalog · Awaiting admin fee confirmation & faculty allotment
                              </div>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold self-start sm:self-auto flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Action Required: Approve Course</span>
                          </span>
                        </div>

                        {/* Course Overview Pills */}
                        <div className="p-3.5 rounded-xl bg-white border border-purple-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-bold text-sm text-heading">{req.courseTitle}</div>
                            <div className="text-[11px] text-body/70 mt-0.5">
                              {req.courseDiscipline} · Focus: {req.courseInstrument} · {req.courseLevel} · {req.courseSessionCount} Sessions
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap font-numeric">
                            <span className="px-2.5 py-1 rounded-lg bg-neutral-100 text-heading font-semibold text-xs">
                              Full Course Tuition
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-[#3C096C] font-bold text-xs border border-purple-200">
                              Catalog Fee: ₹{Math.round(req.coursePriceMinorUnits / 100).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {req.preferredSchedule && (
                          <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-body flex items-start gap-2">
                            <CalendarClock className="w-4 h-4 text-[#3C096C] shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-heading font-semibold">Student Schedule Preference: </strong>
                              <span>{req.preferredSchedule}</span>
                            </div>
                          </div>
                        )}

                        {req.studentNotes && (
                          <div className="p-3 rounded-xl bg-white border border-neutral-200 text-xs text-body">
                            <strong className="text-heading font-semibold">Note from student: </strong>
                            {req.studentNotes}
                          </div>
                        )}

                        {/* Live Financial Update & Mentor Allotment Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-numeric">
                          {/* 1. Course Fee Input */}
                          <div>
                            <label className="text-[11px] font-semibold text-heading block mb-1">
                              Total Course Fee (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-body">₹</span>
                              <input
                                type="number"
                                value={allotFeeRupees}
                                onChange={(e) => setAllotFeeRupees(Number(e.target.value))}
                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                              />
                            </div>
                          </div>

                          {/* 2. Amount Paid Input */}
                          <div>
                            <label className="text-[11px] font-semibold text-heading block mb-1">
                              Amount Paid Now (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">₹</span>
                              <input
                                type="number"
                                value={allotPaidRupees}
                                onChange={(e) => setAllotPaidRupees(Number(e.target.value))}
                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-emerald-700 focus:outline-none focus:border-[#3C096C]"
                              />
                            </div>
                          </div>

                          {/* 3. Live Calculated Remaining Amount */}
                          <div>
                            <label className="text-[11px] font-semibold text-heading block mb-1">
                              Remaining Balance (₹)
                            </label>
                            <div
                              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between ${
                                remainingCalc === 0
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                  : "bg-amber-50 border-amber-200 text-amber-900"
                              }`}
                            >
                              <span>₹{remainingCalc.toLocaleString("en-IN")}</span>
                              <span className="text-[10px] font-medium">
                                {remainingCalc === 0 ? "Fully Paid" : "Due"}
                              </span>
                            </div>
                          </div>

                          {/* 4. Assign Faculty Mentor */}
                          <div>
                            <SearchableFacultySelector
                              teachers={teachers}
                              selectedTeacherId={allotTeacherId}
                              onSelectTeacher={setAllotTeacherId}
                              targetInstrument={req.courseInstrument}
                              label="Assign Faculty Mentor"
                              compact={true}
                            />
                          </div>
                        </div>

                        {/* Admin Approval Notes & Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={allotNotes}
                              onChange={(e) => setAllotNotes(e.target.value)}
                              placeholder="Admin approval notes or payment receipt details (optional)..."
                              className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 bg-white text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApproveRequest(req)}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2D0752] text-white text-xs font-bold shadow-xs active:scale-95 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                          >
                            {isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            )}
                            <span>Approve & Add Course</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ─── MANUAL ALLOTMENT FORM (WHEN TOGGLED OR NO ENROLLMENT & NO REQUEST) ─── */}
              {(isManualAddOpen || (studentEnrollments.length === 0 && pendingRequests.length === 0)) && (
                <div className="p-5 rounded-2xl bg-neutral-50/80 border border-neutral-300/80 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-sm font-bold text-heading">
                        Allot Course to {currentStudent?.name} Manually
                      </h3>
                      <p className="text-[11px] text-body/70 mt-0.5">
                        Select a course from the curriculum catalog, record initial payment, and assign faculty
                      </p>
                    </div>
                    {studentEnrollments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsManualAddOpen(false)}
                        className="text-xs text-body hover:text-heading cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <SearchableCourseSelector
                      courses={courses}
                      selectedCourseId={manualCourseId}
                      onSelectCourse={setManualCourseId}
                      label="Select Course from Catalog *"
                    />

                    <SearchableFacultySelector
                      teachers={teachers}
                      selectedTeacherId={allotTeacherId}
                      onSelectTeacher={setAllotTeacherId}
                      targetInstrument={courses.find((c) => c.id === manualCourseId)?.instrument}
                      label="Assign Faculty Mentor"
                    />
                  </div>

                  {/* Financial Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 font-numeric">
                    <div>
                      <label className="text-[11px] font-semibold text-heading block mb-1">
                        Total Course Fee (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-body">₹</span>
                        <input
                          type="number"
                          value={allotFeeRupees}
                          onChange={(e) => setAllotFeeRupees(Number(e.target.value))}
                          className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-heading block mb-1">
                        Amount Paid (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">₹</span>
                        <input
                          type="number"
                          value={allotPaidRupees}
                          onChange={(e) => setAllotPaidRupees(Number(e.target.value))}
                          className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-emerald-700 focus:outline-none focus:border-[#3C096C]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-heading block mb-1">
                        Remaining Due (₹)
                      </label>
                      <div
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between ${
                          Math.max(0, allotFeeRupees - allotPaidRupees) === 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-amber-50 border-amber-200 text-amber-900"
                        }`}
                      >
                        <span>₹{Math.max(0, allotFeeRupees - allotPaidRupees).toLocaleString("en-IN")}</span>
                        <span className="text-[10px] font-medium">
                          {Math.max(0, allotFeeRupees - allotPaidRupees) === 0 ? "Fully Paid" : "Due"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={allotNotes}
                        onChange={(e) => setAllotNotes(e.target.value)}
                        placeholder="Admin allotment notes (e.g., student opted via phone)..."
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 bg-white text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleManualAllotCourse}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2D0752] text-white text-xs font-bold shadow-xs active:scale-95 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Check className="w-4 h-4 text-white" />
                      )}
                      <span>Approve & Allot Course</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Context strip banner */}
              <div className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-100/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Timezone</div>
                  <div className="font-bold text-heading mt-0.5">
                    {currentStudent?.timezone || "Asia/Kolkata"} · IST
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Age / guardian</div>
                  <div className="font-bold text-heading mt-0.5">
                    {currentStudent?.age ? `${currentStudent.age} yrs` : "14 yrs"} ·{" "}
                    {currentStudent?.guardianName || "Parent"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Active courses</div>
                  <div className="font-bold text-heading mt-0.5">
                    {studentEnrollments.length} enrolled
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-body/60 font-medium">Trial lead status</div>
                  <div className="font-bold text-heading mt-0.5">
                    Qualified & Converted
                  </div>
                </div>
              </div>
            </div>

            {!activeEnrollment ? (
              <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 text-[#3C096C] flex items-center justify-center mx-auto shadow-2xs">
                  <BookOpen className="w-7 h-7 text-[#3C096C]" />
                </div>
                <div className="space-y-1.5 max-w-lg mx-auto">
                  <h3 className="font-serif text-lg font-bold text-heading">
                    Awaiting Course Allotment for {currentStudent?.name || "Student"}
                  </h3>
                  <p className="text-xs text-body/70 leading-relaxed">
                    This student does not currently have an active course allotted. Review the pending course admission request above or use <strong>Allot Course Manually</strong> to allocate a course, update fee & payments, and generate the 1-on-1 timetable.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* ─── SECTION 2: SESSION PLAN & 1-ON-1 TIMETABLE ──────────── */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-lg font-bold text-heading">
                    2 · Session plan
                  </h2>
                </div>

                {/* Faculty allotment quick indicator */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] font-semibold text-body/70">Faculty:</span>
                  <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-[#3C096C] text-xs font-bold font-numeric flex items-center gap-1.5 shadow-2xs">
                    <UserCheck className="w-3.5 h-3.5 text-[#3C096C]" />
                    <span>{currentTeacher?.name || "No faculty allotted"}</span>
                    {currentTeacher && (
                      <span className="text-[10px] text-purple-700/80 font-normal">
                        (₹{currentTeacher.payoutRupees}/class)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* ─── TEACHER SELECTION BUTTON & ALLOTMENT BAR ────────────── */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50/60 via-purple-50/30 to-white border border-purple-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#3C096C] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#3C096C] uppercase tracking-wider bg-purple-100/80 px-2 py-0.5 rounded-md">
                        Faculty Allotment
                      </span>
                      {currentTeacher && (
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accredited Faculty</span>
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-heading text-sm mt-1 flex items-center gap-2">
                      <span>{currentTeacher?.name || "Choose Faculty Instructor"}</span>
                      {currentTeacher && (
                        <span className="text-xs text-body/70 font-normal">
                          · {currentTeacher.instruments.join(", ") || "Music Faculty"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Teacher Selection Control & Button */}
                <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
                  <div className="w-56 sm:w-64">
                    <SearchableFacultySelector
                      teachers={teachers}
                      selectedTeacherId={selectedTeacherId}
                      onSelectTeacher={(newTid) => {
                        setSelectedTeacherId(newTid);
                        const tObj = teachers.find((t) => t.id === newTid);
                        if (tObj) {
                          showToast(`Selected ${tObj.name} for this session plan.`, "success");
                        }
                      }}
                      targetInstrument={currentCourse?.instrument}
                      label=""
                      compact={true}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeEnrollment && selectedTeacherId) {
                        startTransition(async () => {
                          const res = await reassignEnrollmentTeacherAction({
                            enrollmentId: activeEnrollment.id,
                            teacherId: selectedTeacherId,
                            updateUpcomingLessons: true,
                          });
                          if (res.success) {
                            showToast(
                              `Allotted ${currentTeacher?.name} to enrollment and updated sessions!`,
                              "success"
                            );
                            setEnrollments((prev) =>
                              prev.map((item) =>
                                item.id === activeEnrollment.id
                                  ? {
                                      ...item,
                                      teacherId: selectedTeacherId,
                                      teacherName: currentTeacher?.name || null,
                                      teacherPayoutRupees: currentTeacher?.payoutRupees || 500,
                                      lessons: item.lessons.map((l) => ({
                                        ...l,
                                        teacherId: selectedTeacherId,
                                        teacherName: currentTeacher?.name || "Assigned Faculty",
                                        payoutRupees: currentTeacher?.payoutRupees || 500,
                                      })),
                                    }
                                  : item
                              )
                            );
                          } else {
                            showToast(res.error || "Failed to allot teacher", "error");
                          }
                        });
                      } else {
                        showToast(`Teacher set to ${currentTeacher?.name || "Faculty"}.`, "success");
                      }
                    }}
                    disabled={isPending}
                    className="px-4 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Allot Teacher</span>
                  </button>
                </div>
              </div>

              {/* 4 Inputs Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-heading block mb-1">
                    Total sessions
                  </label>
                  <input
                    type="number"
                    value={totalSessions}
                    onChange={(e) => setTotalSessions(Number(e.target.value))}
                    min="1"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-heading block mb-1">
                    Completed sessions
                  </label>
                  <input
                    type="number"
                    value={completedSessions}
                    onChange={(e) => setCompletedSessions(Number(e.target.value))}
                    min="0"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                  />
                  <span className="text-[10px] text-body/50">Read-only after creation</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-heading block mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequencyLabel}
                    onChange={(e) => setFrequencyLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs text-heading font-medium focus:outline-none focus:border-[#3C096C]"
                  >
                    <option value="1 class / week">1 class / week</option>
                    <option value="2 classes / week">2 classes / week</option>
                    <option value="3 classes / week">3 classes / week</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-heading block mb-1">
                    Expected duration
                  </label>
                  <select
                    value={expectedDurationWeeks}
                    onChange={(e) => setExpectedDurationWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs text-heading font-medium focus:outline-none focus:border-[#3C096C]"
                  >
                    <option value={8}>8 weeks</option>
                    <option value={12}>12 weeks</option>
                    <option value={16}>16 weeks</option>
                    <option value={24}>24 weeks</option>
                  </select>
                </div>
              </div>

              {/* Generated Date Pills Preview */}
              <div className="flex items-center gap-2 flex-wrap text-xs font-numeric">
                {generatedPreviewDates.map((dateStr, idx) => (
                  <div
                    key={idx}
                    suppressHydrationWarning
                    className="px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-heading font-semibold shadow-2xs"
                  >
                    {dateStr}
                  </div>
                ))}
                {totalSessions > 4 && (
                  <div className="px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-100 text-body font-semibold">
                    +{totalSessions - 4} sessions
                  </div>
                )}
              </div>

              {/* ─── SCHEDULE NEXT 1-ON-1 SESSION(S) INTERACTIVE PANEL ───── */}
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-sm font-bold text-heading">
                      Schedule Next 1-on-1 Session(s)
                    </h3>
                  </div>

                  <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScheduleMode("SINGLE")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        scheduleMode === "SINGLE"
                          ? "bg-[#3C096C] text-white"
                          : "text-body hover:text-heading"
                      }`}
                    >
                      Single Lesson
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode("BULK")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        scheduleMode === "BULK"
                          ? "bg-[#3C096C] text-white"
                          : "text-body hover:text-heading"
                      }`}
                    >
                      Bulk Recurring Timetable
                    </button>
                  </div>
                </div>

                {scheduleMode === "SINGLE" ? (
                  <form onSubmit={handleScheduleSingle} className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-[11px] font-semibold text-body block mb-1">
                        Date & Time
                      </label>
                      <DateTimePicker
                        value={singleLessonDate}
                        onChange={setSingleLessonDate}
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[11px] font-semibold text-body block mb-1">
                        Duration
                      </label>
                      <select
                        value={singleLessonDuration}
                        onChange={(e) => setSingleLessonDuration(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium focus:outline-none focus:border-[#3C096C]"
                      >
                        <option value={45}>45 mins</option>
                        <option value={60}>60 mins</option>
                        <option value={90}>90 mins</option>
                      </select>
                    </div>
                    <div className="w-40">
                      <label className="text-[11px] font-semibold text-body block mb-1">
                        Assigned Faculty
                      </label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium focus:outline-none focus:border-[#3C096C]"
                      >
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (₹{t.payoutRupees})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="self-end">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-3.5 py-1.5 rounded-lg bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "+ Add 1-on-1 Lesson"
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleBulkSchedule} className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[170px]">
                      <label className="text-[11px] font-semibold text-body block mb-1">
                        First Session
                      </label>
                      <DateTimePicker
                        value={bulkStartDate}
                        onChange={setBulkStartDate}
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[11px] font-semibold text-body block mb-1">
                        Interval
                      </label>
                      <select
                        value={bulkIntervalDays}
                        onChange={(e) => setBulkIntervalDays(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium focus:outline-none focus:border-[#3C096C]"
                      >
                        <option value={7}>Weekly (7d)</option>
                        <option value={3}>3-4 Days</option>
                      </select>
                    </div>
                    <div className="w-16">
                      <label className="text-[11px] font-semibold text-body block mb-1">
                        Count
                      </label>
                      <input
                        type="number"
                        value={bulkCount}
                        onChange={(e) => setBulkCount(Number(e.target.value))}
                        min="1"
                        max="24"
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                      />
                    </div>
                    <div className="w-40">
                      <label className="text-[11px] font-semibold text-body block mb-1">
                        Assigned Faculty
                      </label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium focus:outline-none focus:border-[#3C096C]"
                      >
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (₹{t.payoutRupees})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="self-end">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-3.5 py-1.5 rounded-lg bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Generate Timetable"
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* ─── 1-ON-1 SCHEDULED SESSIONS TABLE (SPECIFIED BY USER) ─── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-sm font-bold text-heading">
                    Scheduled 1-on-1 Sessions for {currentCourse?.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-numeric text-body/60">
                      {activeEnrollment?.lessons.length || 0} scheduled classes
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold text-body uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3.5">#</th>
                          <th className="py-2.5 px-3.5">Session ID (Tracking)</th>
                          <th className="py-2.5 px-3.5">Date & Time</th>
                          <th className="py-2.5 px-3.5">Duration</th>
                          <th className="py-2.5 px-3.5">Assigned Faculty</th>
                          <th className="py-2.5 px-3.5 text-center">Status</th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-numeric">
                        {!activeEnrollment || activeEnrollment.lessons.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-xs text-body/60">
                              No 1-on-1 sessions scheduled for this course yet. Use the panel above to schedule.
                            </td>
                          </tr>
                        ) : (
                          [...(activeEnrollment.lessons || [])]
                            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                            .map((lesson, idx) => {
                            const isRescheduling = reschedulingLessonId === lesson.id;
                            const lDate = new Date(lesson.startsAt);

                            return (
                              <tr key={lesson.id} className="hover:bg-neutral-50/60 transition-colors">
                                <td className="py-3 px-3.5 font-bold text-heading">
                                  {idx + 1}
                                </td>

                                <td className="py-3 px-3.5">
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <span className="bg-purple-50 text-[#3C096C] px-2 py-0.5 rounded text-[11px] font-bold">
                                      {lesson.trackingCode}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyTracking(lesson.trackingCode)}
                                      className="p-1 text-body/40 hover:text-heading cursor-pointer"
                                      title="Copy Tracking ID"
                                    >
                                      {copiedCode === lesson.trackingCode ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </td>

                                <td className="py-3 px-3.5">
                                  <div>
                                    <div className="font-bold text-heading font-numeric">
                                      {lDate.toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </div>
                                    <div className="text-[11px] text-body/70 font-numeric">
                                      {lDate.toLocaleTimeString("en-GB", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3 px-3.5 text-body">
                                  {lesson.durationMinutes} mins
                                </td>

                                 <td className="py-3 px-3.5">
                                  {reassigningLessonId === lesson.id ? (
                                    <div className="flex items-center gap-1.5 min-w-[220px]">
                                      <div className="flex-1">
                                        <SearchableFacultySelector
                                          teachers={teachers}
                                          selectedTeacherId={reassignTeacherId || lesson.teacherId || selectedTeacherId}
                                          onSelectTeacher={setReassignTeacherId}
                                          targetInstrument={currentCourse?.instrument}
                                          label=""
                                          compact={true}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleReassignLesson(
                                            lesson.id,
                                            reassignTeacherId || selectedTeacherId
                                          )
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-[#3C096C] text-white font-bold text-[10px] cursor-pointer shadow-2xs hover:bg-[#2D0752]"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setReassigningLessonId(null)}
                                        className="text-[10px] text-body hover:text-heading cursor-pointer p-1"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="font-semibold text-heading flex items-center gap-1.5">
                                        <span>{lesson.teacherName}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReassigningLessonId(lesson.id);
                                            setReassignTeacherId(lesson.teacherId || selectedTeacherId);
                                          }}
                                          className="text-[10px] text-[#3C096C] hover:underline font-bold cursor-pointer"
                                          title="Reassign faculty for this lesson"
                                        >
                                          Change
                                        </button>
                                      </div>
                                      <div className="text-[10px] text-emerald-700">
                                        Payout: ₹{lesson.payoutRupees}
                                      </div>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-3.5 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                      lesson.status === "SCHEDULED"
                                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                                        : lesson.status === "RESCHEDULED"
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : lesson.status === "COMPLETED"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {lesson.status}
                                  </span>
                                </td>

                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                  {(lesson.status === "SCHEDULED" || lesson.status === "RESCHEDULED") && (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReschedulingLessonId(lesson.id);
                                          const localIso = new Date(
                                            new Date(lesson.startsAt).getTime() -
                                              new Date(lesson.startsAt).getTimezoneOffset() * 60000
                                          )
                                            .toISOString()
                                            .slice(0, 16);
                                          setRescheduleDateInput(localIso);
                                        }}
                                        className="text-[11px] text-[#3C096C] font-bold hover:underline"
                                      >
                                        Reschedule
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelLesson(lesson.id)}
                                        className="text-[11px] text-rose-700 font-bold hover:underline"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── SECTION 3: FEES, PAYMENTS & NOTES ───────────────────── */}
            <div id="section-3-fees" className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-lg font-bold text-heading">
                      3 · Fees, payments &amp; notes
                    </h2>
                    <span className="text-[10px] font-bold font-numeric px-2 py-0.5 rounded-full bg-purple-50 text-[#3C096C] border border-purple-200/70">
                      INR Tuition Ledger
                    </span>
                  </div>
                </div>

                {/* Apple-style Record Next Installment CTA */}
                <button
                  type="button"
                  onClick={() => {
                    setInstallmentAmount(amountDueRupees > 0 ? amountDueRupees : 5000);
                    setInstallmentPerSessionRate(defaultInstallmentPerSessionRate);
                    setIsRecordingPayment(!isRecordingPayment);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer ${
                    isRecordingPayment
                      ? "bg-purple-100 text-[#3C096C] border border-purple-300"
                      : "bg-[#3C096C] hover:bg-[#2F0755] text-white"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isRecordingPayment
                      ? "Hide Payment Drawer"
                      : "+ Record Payment Installment (2nd, 3rd...)"}
                  </span>
                </button>
              </div>

              {/* ─── APPLE-DESIGN SUBSEQUENT PAYMENT DRAWER ─── */}
              {isRecordingPayment && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-purple-50/70 via-purple-50/30 to-white border border-purple-200/90 shadow-2xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#3C096C] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        <Receipt className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-serif text-sm font-bold text-heading">
                          Record Payment Installment (Tranche #{allRecordedPayments.length + 1})
                        </h4>
                        <p className="text-[11px] text-body/60 mt-0.2">
                          Issue real receipt &amp; update enrollment ledger for {currentStudent?.name || "Student"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsRecordingPayment(false)}
                      className="p-1.5 rounded-lg text-body/60 hover:text-heading hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Balance contextual chips */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[11px] text-body/70 font-medium">Quick Amount Presets:</span>
                    {amountDueRupees > 0 && (
                      <button
                        type="button"
                        onClick={() => setInstallmentAmount(amountDueRupees)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[11px] font-bold font-numeric transition-all cursor-pointer"
                      >
                        Pay Full Due (₹{amountDueRupees.toLocaleString("en-IN")})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setInstallmentAmount(2500)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-50 border border-neutral-200 text-heading text-[11px] font-bold font-numeric transition-all cursor-pointer"
                    >
                      ₹2,500
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallmentAmount(5000)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-50 border border-neutral-200 text-heading text-[11px] font-bold font-numeric transition-all cursor-pointer"
                    >
                      ₹5,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallmentAmount(10000)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-50 border border-neutral-200 text-heading text-[11px] font-bold font-numeric transition-all cursor-pointer"
                    >
                      ₹10,000
                    </button>
                  </div>

                  {/* Form fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-numeric">
                    {/* 1. Amount */}
                    <div>
                      <label className="text-[11px] font-semibold text-heading block mb-1">
                        Installment Amount (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">₹</span>
                        <input
                          type="number"
                          value={installmentAmount || ""}
                          onChange={(e) => setInstallmentAmount(Number(e.target.value))}
                          placeholder="e.g. 5000"
                          min="1"
                          className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-emerald-700 focus:outline-none focus:border-[#3C096C]"
                        />
                      </div>
                    </div>

                    {/* 2. Payment Method */}
                    <div>
                      <label className="text-[11px] font-semibold text-heading block mb-1">
                        Payment Method
                      </label>
                      <select
                        value={installmentMethod}
                        onChange={(e) => setInstallmentMethod(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-heading focus:outline-none focus:border-[#3C096C]"
                      >
                        <option value="UPI">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                        <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                        <option value="CARD">Credit / Debit Card</option>
                        <option value="CASH">Cash (Front Desk / Campus)</option>
                        <option value="CHEQUE">Cheque / Demand Draft</option>
                      </select>
                    </div>

                    {/* 3. Reference / Receipt Code */}
                    <div>
                      <label className="text-[11px] font-semibold text-heading block mb-1">
                        Reference / UTR / Receipt ID
                      </label>
                      <input
                        type="text"
                        value={installmentRefCode}
                        onChange={(e) => setInstallmentRefCode(e.target.value)}
                        placeholder="Auto-generated if blank"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                      />
                    </div>

                    {/* 4. Notes / Memo */}
                    <div>
                      <label className="text-[11px] font-semibold text-heading block mb-1">
                        Tranche Memo / Description
                      </label>
                      <input
                        type="text"
                        value={installmentNotes}
                        onChange={(e) => setInstallmentNotes(e.target.value)}
                        placeholder={`e.g. Tranche #${allRecordedPayments.length + 1} installment`}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                      />
                    </div>
                  </div>

                  {/* Automated Weekly Session Scheduling (1 session / week) */}
                  {installmentAmount > 0 && activeEnrollment && (
                    <div className="pt-3 border-t border-purple-200/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-[#3C096C]" />
                          <h5 className="font-semibold text-xs text-heading">
                            Automated Weekly Session Scheduling ({installmentSessionsPerWeek} Session{installmentSessionsPerWeek > 1 ? "s" : ""} / Week)
                          </h5>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#3C096C] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAutoScheduleInstallment}
                            onChange={(e) => setIsAutoScheduleInstallment(e.target.checked)}
                            className="w-4 h-4 text-[#3C096C] rounded border-neutral-300 focus:ring-[#3C096C] cursor-pointer"
                          />
                          <span>Schedule with this installment</span>
                        </label>
                      </div>

                      {isAutoScheduleInstallment && (
                        <div className="p-3.5 rounded-xl bg-white/80 border border-purple-100">
                          <WeeklySchedulePicker
                            selectedDay={installmentDay}
                            onChangeDay={setInstallmentDay}
                            selectedDays={installmentDays}
                            onChangeDays={setInstallmentDays}
                            sessionsPerWeek={installmentSessionsPerWeek}
                            onChangeSessionsPerWeek={setInstallmentSessionsPerWeek}
                            selectedTime={installmentTime}
                            onChangeTime={setInstallmentTime}
                            startDate={installmentStartDate}
                            onChangeStartDate={setInstallmentStartDate}
                            durationMinutes={installmentDuration}
                            onChangeDuration={setInstallmentDuration}
                            amountPaid={installmentAmount}
                            perSessionRate={effectiveInstallmentPerSessionRate}
                            onChangePerSessionRate={setInstallmentPerSessionRate}
                            sessionCount={installmentSessionCount}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-purple-100">
                    <button
                      type="button"
                      onClick={() => setIsRecordingPayment(false)}
                      className="px-3.5 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-body text-xs font-semibold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleRecordInstallment}
                      disabled={isPending || installmentAmount <= 0}
                      className="px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>
                        Confirm &amp; Record Tranche (₹{installmentAmount.toLocaleString("en-IN")})
                        {isAutoScheduleInstallment &&
                        installmentAmount > 0 &&
                        installmentSessionCount > 0
                          ? ` + Schedule ${installmentSessionCount} Sessions`
                          : ""}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3 Ledger Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-numeric">
                <div>
                  <label className="text-xs font-semibold text-heading block mb-1">
                    Enrollment fee
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-body">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={feeRupees}
                      onChange={(e) => setFeeRupees(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C]"
                    />
                  </div>
                  <span className="text-[10px] text-body/50 mt-1 block">
                    Curriculum total tuition fee
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-heading">
                      Successful payments
                    </label>
                    <span className="text-[10px] font-bold text-[#3C096C] bg-purple-50 px-1.5 py-0.2 rounded">
                      {allRecordedPayments.length} {allRecordedPayments.length === 1 ? "tranche" : "tranches"}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                      ₹
                    </span>
                    <input
                      type="number"
                      readOnly
                      value={paidRupees}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50/70 text-xs font-bold text-emerald-700 focus:outline-none cursor-default"
                    />
                  </div>
                  <span className="text-[10px] text-body/50 mt-1 block truncate">
                    {allRecordedPayments[allRecordedPayments.length - 1]?.gatewayPaymentId
                      ? `Latest Receipt: ${allRecordedPayments[allRecordedPayments.length - 1]?.gatewayPaymentId}`
                      : "Initial admission payment"}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-heading">
                      Calculated amount due
                    </label>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        amountDueRupees === 0
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {amountDueRupees === 0 ? "Fully Paid" : "Due"}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#3C096C]">
                      ₹
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={amountDueRupees.toLocaleString("en-IN")}
                      className={`w-full pl-7 pr-3 py-2 rounded-xl border text-xs font-bold ${
                        amountDueRupees === 0
                          ? "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                          : "border-purple-200 bg-purple-50/50 text-[#3C096C]"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-body/50 mt-1 block">
                    Enrollment fee – total payments recorded
                  </span>
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <label className="text-xs font-semibold text-heading block mb-1">
                  Admin notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl border border-neutral-300 text-xs text-heading placeholder:text-body/40 focus:outline-none focus:border-[#3C096C]"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── RIGHT COLUMN: SUMMARY, CHECKLIST, CTAS (4 COLS / ~33%) ─── */}
      <div className="lg:col-span-4 space-y-5">
        {!activeEnrollment ? (
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="font-serif text-base font-bold text-heading">
                Enrollment status
              </h3>
              <p className="text-xs text-body/60 mt-0.5">Awaiting active course</p>
            </div>

            <div className="space-y-3 text-xs divide-y divide-neutral-100">
              <div className="flex items-center justify-between pt-1">
                <span className="text-body/70">Student</span>
                <span className="font-bold text-heading">{currentStudent?.name || "Student"}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-body/70">Course</span>
                <span className="font-medium text-body/50">None Allotted Yet</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-body/70">Status</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#3C096C] font-bold text-[11px]">
                  {pendingRequests.length > 0 ? "Pending Request" : "Awaiting Allotment"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900 leading-relaxed">
              Approve a student course request or use the manual allotment form in Section 1 to allot a course to {currentStudent?.name || "this student"}.
            </div>
          </div>
        ) : (
          <>
            {/* 1. Enrollment summary card */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-heading">
                  Enrollment summary
                </h3>
                <p className="text-xs text-body/60 mt-0.5">Review before saving</p>
              </div>

              <div className="space-y-3 text-xs divide-y divide-neutral-100">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-body/70">Student</span>
                  <span className="font-bold text-heading">{currentStudent?.name || "Student"}</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-body/70">Course</span>
                  <span className="font-bold text-heading truncate max-w-[180px]">
                    {currentCourse?.title}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-body/70">Teacher</span>
                  <span className="font-bold text-heading">{currentTeacher?.name || "Mira Sen"}</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-body/70">Schedule</span>
                  <span className="font-semibold text-heading font-numeric">
                    {enrollmentSummaryMetrics.scheduleLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-body/70">Dates</span>
                  <span className="font-semibold text-heading font-numeric">
                    {enrollmentSummaryMetrics.datesLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-body/70">Sessions</span>
                  <span className="font-semibold text-heading font-numeric">
                    {enrollmentSummaryMetrics.sessionsLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-numeric">
                  <span className="text-body/70">Fee</span>
                  <span className="font-semibold text-heading">₹{feeRupees.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex items-center justify-between pt-2 font-numeric">
                  <span className="text-body/70">Paid</span>
                  <span className="font-semibold text-emerald-700">
                    – ₹{paidRupees.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 text-sm font-numeric">
                  <span className="font-bold text-heading">Amount due</span>
                  <span className="font-serif text-xl font-bold text-[#3C096C]">
                    ₹{amountDueRupees.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* 1.B Payment History & Receipts Ledger */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div>
                  <h3 className="font-serif text-base font-bold text-heading flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-[#3C096C]" />
                    <span>Payment History &amp; Receipts</span>
                  </h3>
                  <p className="text-[11px] text-body/60 mt-0.5 font-numeric">
                    {allRecordedPayments.length} installment {allRecordedPayments.length === 1 ? "tranche" : "tranches"} recorded
                  </p>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-numeric ${
                    amountDueRupees === 0
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {amountDueRupees === 0 ? "Fully Paid" : "Balance Due"}
                </span>
              </div>

              {allRecordedPayments.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {allRecordedPayments.map((pmt, idx) => {
                    const pDate = new Date(pmt.createdAt);
                    const isAdmission = idx === 0 || pmt.notes?.toLowerCase().includes("initial") || pmt.notes?.toLowerCase().includes("admission");
                    const trancheLabel = isAdmission && idx === 0 ? "1st · Admission" : `${idx + 1}${idx === 1 ? "nd" : idx === 2 ? "rd" : "th"} · Installment`;
                    const amt = Math.round(pmt.amountMinorUnits / 100);
                    const rcpt = pmt.gatewayPaymentId || `RCPT-${pmt.id.slice(-6)}`;

                    return (
                      <div
                        key={pmt.id || idx}
                        className="p-3 rounded-xl bg-neutral-50/70 hover:bg-purple-50/30 border border-neutral-200/80 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100/80 text-[#3C096C]">
                              {trancheLabel}
                            </span>
                            <span className="text-[10px] text-body/60 font-numeric" suppressHydrationWarning>
                              {pDate.toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>

                          <div className="font-bold text-emerald-700 text-xs font-numeric">
                            ₹{amt.toLocaleString("en-IN")}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-200/50">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-body/70 text-[10px]">{rcpt}</span>
                            <button
                              type="button"
                              onClick={() => copyReceipt(rcpt)}
                              className="p-0.5 text-body/40 hover:text-heading cursor-pointer transition-colors"
                              title="Copy receipt number"
                            >
                              {copiedReceiptId === rcpt ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-neutral-200/70 text-body uppercase">
                              {pmt.gateway || "UPI"}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Paid</span>
                            </span>
                          </div>
                        </div>

                        {pmt.notes && (
                          <div className="text-[10px] text-body/60 italic truncate pt-0.5">
                            {pmt.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 text-center space-y-1">
                  <div className="text-xs font-semibold text-heading">No Payments Recorded Yet</div>
                  <p className="text-[11px] text-body/60">
                    Recording initial payment in Section 1 or Section 3 will generate Tranche #1.
                  </p>
                </div>
              )}

              {/* Record next installment quick button if balance remaining */}
              {amountDueRupees > 0 && (
                <div className="pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => {
                      setInstallmentAmount(amountDueRupees);
                      setInstallmentPerSessionRate(defaultInstallmentPerSessionRate);
                      setIsRecordingPayment(true);
                      const s3 = document.getElementById("section-3-fees");
                      if (s3) s3.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100/80 border border-purple-200 text-[#3C096C] text-xs font-bold transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Tranche #{allRecordedPayments.length + 1} (₹{amountDueRupees.toLocaleString("en-IN")} due)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">

              <button
                type="button"
                onClick={() => handleSaveEnrollment(false)}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Check className="w-4 h-4 text-white" />
                )}
                <span>Save Enrollment</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveEnrollment(true)}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl border border-neutral-200/90 hover:bg-neutral-50 text-heading font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-95 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-body/80" />
                <span>Save as draft</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
)}

      {/* ─── APPLE-DESIGN RESCHEDULE 1-ON-1 LESSON MODAL ─── */}
      {reschedulingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-neutral-200/90 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 font-sans">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-base text-heading">
                  Reschedule 1-on-1 Lesson
                </h3>
                <p className="text-xs text-body/60 mt-0.5">
                  Lesson #{reschedulingLesson.trackingCode} • {reschedulingLesson.teacherName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReschedulingLessonId(null)}
                className="p-1 rounded-lg text-body/60 hover:text-heading hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Current Schedule Summary */}
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 text-xs">
                <span className="font-semibold text-body/70 block mb-0.5">
                  Currently Scheduled
                </span>
                <span className="font-bold text-[#3C096C] font-numeric text-sm">
                  {new Date(reschedulingLesson.startsAt).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(reschedulingLesson.startsAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-[11px] text-body/60 block mt-0.5">
                  Duration: {reschedulingLesson.durationMinutes} mins
                </span>
              </div>

              {/* New Date & Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading block">
                  Select New Date & Time
                </label>
                <DateTimePicker
                  value={rescheduleDateInput}
                  onChange={setRescheduleDateInput}
                  className="w-full"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReschedulingLessonId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-body hover:text-heading hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReschedule(reschedulingLesson.id)}
                disabled={isPending || !rescheduleDateInput}
                className="px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Reschedule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── APPLE-DESIGN AUTO-SCHEDULE MODAL FOR ALLOTMENT ─── */}
      <AutoScheduleAllotModal
        isOpen={!!pendingAllotSchedule}
        onClose={() => setPendingAllotSchedule(null)}
        studentName={pendingAllotSchedule?.studentName || ""}
        courseTitle={pendingAllotSchedule?.courseTitle || ""}
        amountPaid={pendingAllotSchedule?.paidRupees || 0}
        perSessionRate={pendingAllotSchedule?.perSessionRate || 500}
        assignedTeacherName={
          teachers.find((t) => t.id === pendingAllotSchedule?.teacherId)?.name
        }
        isPending={isPending}
        onConfirmSchedule={(slots) => {
          if (pendingAllotSchedule) {
            executeApproveOrAllot(pendingAllotSchedule, slots);
          }
        }}
        onConfirmWithoutSchedule={() => {
          if (pendingAllotSchedule) {
            executeApproveOrAllot(pendingAllotSchedule, undefined);
          }
        }}
      />
    </div>
  );
}
