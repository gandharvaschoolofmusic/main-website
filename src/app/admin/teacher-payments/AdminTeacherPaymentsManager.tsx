"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  Copy,
  Check,
  X,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Loader2,
  ArrowUpDown,
  Filter,
  RefreshCw,
  QrCode,
  ExternalLink,
  Download,
  Smartphone,
  Sparkles,
  Save,
  ShieldAlert,
  Info,
  Sliders,
  Calendar,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
  isWithinInterval,
} from "date-fns";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { markLessonPayoutAction } from "@/actions/admin";
import { updateTeacherPaymentDetailsAction } from "@/actions/teacher";
import {
  buildUpiPaymentUri,
  getInternalQrApiUrl,
  generateClientQrDataUrl,
} from "@/lib/upi";

export interface AdminSessionPayoutItem {
  id: string;
  trackingCode: string;
  startsAt: string;
  dateFormatted: string;
  durationMinutes: number;
  lessonStatus: string;
  lessonSource: string | null;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherUpiId?: string | null;
  payoutRateRupees: number;
  payoutStatus: "PAID" | "UNPAID";
  payoutPaidAtFormatted?: string | null;
  payoutTransactionId?: string | null;
  payoutNotes?: string | null;
  payoutAmountRupees: number;
}

export function AdminTeacherPaymentsManager({
  initialSessions,
}: {
  initialSessions: AdminSessionPayoutItem[];
}) {
  const [sessions, setSessions] = useState<AdminSessionPayoutItem[]>(initialSessions);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [teacherFilter, setTeacherFilter] = useState<string>("ALL");
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected session for Pay Teacher modal
  const [selectedSession, setSelectedSession] = useState<AdminSessionPayoutItem | null>(null);
  const [customAmountRupees, setCustomAmountRupees] = useState<number>(800);
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [payoutNotes, setPayoutNotes] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dynamic QR Code state & editable UPI handle
  const [modalUpiId, setModalUpiId] = useState<string>("");
  const [isSavingUpi, setIsSavingUpi] = useState<boolean>(false);
  const [upiSaveMessage, setUpiSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [includeAmountInQr, setIncludeAmountInQr] = useState<boolean>(true);
  const [includeNoteInQr, setIncludeNoteInQr] = useState<boolean>(true);
  const [includeNameInQr, setIncludeNameInQr] = useState<boolean>(true);

  // Clean UPI ID string
  const cleanModalUpi = modalUpiId.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

  // Auto-generate standard UPI payment URI dynamically based on current modal UPI ID
  const upiUri = useMemo(() => {
    if (!cleanModalUpi || !cleanModalUpi.includes("@")) return "";
    return buildUpiPaymentUri({
      upiId: cleanModalUpi,
      payeeName: selectedSession?.teacherName,
      amount: customAmountRupees,
      trackingCode: selectedSession?.trackingCode,
      includeAmount: includeAmountInQr,
      includeNote: includeNoteInQr,
      includePayeeName: includeNameInQr,
    });
  }, [
    cleanModalUpi,
    selectedSession,
    customAmountRupees,
    includeAmountInQr,
    includeNoteInQr,
    includeNameInQr,
  ]);

  const qrApiUrl = useMemo(() => {
    if (!upiUri) return "";
    return getInternalQrApiUrl(upiUri, 360);
  }, [upiUri]);

  // Generate crisp client-side QR data URL when UPI URI changes
  useEffect(() => {
    if (!upiUri) {
      setQrDataUrl("");
      return;
    }
    let active = true;
    setQrLoading(true);
    generateClientQrDataUrl(upiUri, 360)
      .then((dataUrl) => {
        if (active) {
          setQrDataUrl(dataUrl);
          setQrLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error generating client QR code:", err);
        if (active) setQrLoading(false);
      });

    return () => {
      active = false;
    };
  }, [upiUri]);

  const handleDownloadQr = () => {
    const urlToDownload = qrDataUrl || qrApiUrl;
    if (!urlToDownload || !selectedSession) return;
    const link = document.createElement("a");
    link.href = urlToDownload;
    link.download = `UPI-Payout-${selectedSession.trackingCode}-${selectedSession.teacherName.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Completed sessions base list (sorted ascending by session date/time)
  const completedSessions = useMemo(() => {
    return sessions
      .filter((s) => s.lessonStatus === "COMPLETED")
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [sessions]);

  // Unique list of teachers for dropdown filter
  const uniqueTeachers = useMemo(() => {
    const map = new Map<string, string>();
    completedSessions.forEach((s) => {
      if (!map.has(s.teacherId)) {
        map.set(s.teacherId, s.teacherName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [completedSessions]);

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open modal
  const handleOpenPayModal = (session: AdminSessionPayoutItem) => {
    setSelectedSession(session);
    setModalUpiId(session.teacherUpiId || "");
    setUpiSaveMessage(null);
    setCustomAmountRupees(session.payoutAmountRupees || session.payoutRateRupees || 800);
    setTransactionRef(session.payoutTransactionId || "");
    setPayoutNotes(session.payoutNotes || "");
    setModalError(null);
    setModalSuccess(null);
  };

  // Close modal
  const handleCloseModal = () => {
    setSelectedSession(null);
    setModalUpiId("");
    setUpiSaveMessage(null);
    setModalError(null);
    setModalSuccess(null);
  };

  // Save updated UPI ID to teacher profile in DB
  const handleSaveTeacherUpi = async () => {
    if (!selectedSession) return;
    const trimmed = cleanModalUpi;
    if (!trimmed || !trimmed.includes("@") || trimmed.length < 5) {
      setUpiSaveMessage({
        type: "error",
        text: "Please enter a valid UPI ID (e.g. mobile@ybl, name@okhdfcbank).",
      });
      return;
    }

    setIsSavingUpi(true);
    setUpiSaveMessage(null);
    try {
      const res = await updateTeacherPaymentDetailsAction({
        upiId: trimmed,
        teacherUserId: selectedSession.teacherId,
      });

      if (res.success) {
        setUpiSaveMessage({
          type: "success",
          text: "UPI ID saved to faculty profile!",
        });

        // Update selected session in state
        setSelectedSession((prev) =>
          prev ? { ...prev, teacherUpiId: trimmed } : null,
        );

        // Update sessions table list
        setSessions((prev) =>
          prev.map((s) =>
            s.teacherId === selectedSession.teacherId
              ? { ...s, teacherUpiId: trimmed }
              : s,
          ),
        );
      } else {
        setUpiSaveMessage({
          type: "error",
          text: res.error || "Failed to update teacher UPI ID.",
        });
      }
    } catch (err: unknown) {
      setUpiSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error saving UPI ID",
      });
    } finally {
      setIsSavingUpi(false);
    }
  };

  // Quick handle switcher
  const handleQuickHandle = (handle: string) => {
    const current = cleanModalUpi;
    if (!current) {
      setModalUpiId(`instructor${handle}`);
      return;
    }
    const prefix = current.includes("@") ? current.split("@")[0] : current;
    setModalUpiId(`${prefix}${handle}`);
    setUpiSaveMessage(null);
  };

  // Handle Mark as Paid
  const handleConfirmPayout = (newStatus: "PAID" | "UNPAID") => {
    if (!selectedSession) return;
    setModalError(null);
    setModalSuccess(null);

    startTransition(async () => {
      try {
        const res = await markLessonPayoutAction({
          lessonId: selectedSession.id,
          status: newStatus,
          transactionId: transactionRef,
          notes: payoutNotes,
          amountMinor: Math.round(customAmountRupees * 100),
        });

        if (!res.success) {
          setModalError(res.error || "Failed to update payout status.");
          return;
        }

        // Optimistically update local session in state
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === selectedSession.id) {
              return {
                ...s,
                payoutStatus: newStatus,
                payoutPaidAtFormatted:
                  newStatus === "PAID"
                    ? new Date().toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : null,
                payoutTransactionId: newStatus === "PAID" ? transactionRef.trim() || null : null,
                payoutNotes: newStatus === "PAID" ? payoutNotes.trim() || null : null,
                payoutAmountRupees: customAmountRupees,
              };
            }
            return s;
          }),
        );

        setModalSuccess(
          newStatus === "PAID"
            ? "Session payout marked as PAID successfully!"
            : "Session payout reverted to UNPAID.",
        );

        setTimeout(() => {
          handleCloseModal();
        }, 1200);
      } catch (err: unknown) {
        setModalError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  };

  // Reference timestamp
  const now = useMemo(() => new Date(), []);

  // Preset week intervals (Monday to Sunday)
  const thisWeekInterval = useMemo(
    () => ({
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
      label: `Current Week (${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d")}–${format(endOfWeek(now, { weekStartsOn: 1 }), "MMM d")})`,
    }),
    [now],
  );

  const lastWeekInterval = useMemo(
    () => ({
      start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
      end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
      label: `Last Week (${format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), "MMM d")}–${format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), "MMM d")})`,
    }),
    [now],
  );

  const twoWeeksAgoInterval = useMemo(
    () => ({
      start: startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 }),
      end: endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 }),
      label: `2 Wks Ago (${format(startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 }), "MMM d")}–${format(endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 }), "MMM d")})`,
    }),
    [now],
  );

  // Dynamic calendar weeks discovered from completed sessions
  const historicalWeeks = useMemo(() => {
    const map = new Map<
      string,
      { start: Date; end: Date; count: number; unpaidCount: number; pendingAmount: number }
    >();

    completedSessions.forEach((s) => {
      const sDate = new Date(s.startsAt);
      const wStart = startOfWeek(sDate, { weekStartsOn: 1 });
      const wEnd = endOfWeek(sDate, { weekStartsOn: 1 });
      const key = format(wStart, "yyyy-MM-dd");

      const existing = map.get(key) || {
        start: wStart,
        end: wEnd,
        count: 0,
        unpaidCount: 0,
        pendingAmount: 0,
      };

      existing.count += 1;
      if (s.payoutStatus === "UNPAID") {
        existing.unpaidCount += 1;
        existing.pendingAmount += s.payoutRateRupees;
      }
      map.set(key, existing);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1].start.getTime() - a[1].start.getTime())
      .map(([key, data]) => ({
        id: `week_${key}`,
        key,
        start: data.start,
        end: data.end,
        label: `${format(data.start, "MMM d")} – ${format(data.end, "MMM d, yyyy")}`,
        count: data.count,
        unpaidCount: data.unpaidCount,
        pendingAmount: data.pendingAmount,
      }));
  }, [completedSessions]);

  // Session counts for preset pills
  const thisWeekCount = useMemo(() => {
    return completedSessions.filter((s) =>
      isWithinInterval(new Date(s.startsAt), thisWeekInterval),
    ).length;
  }, [completedSessions, thisWeekInterval]);

  const lastWeekCount = useMemo(() => {
    return completedSessions.filter((s) =>
      isWithinInterval(new Date(s.startsAt), lastWeekInterval),
    ).length;
  }, [completedSessions, lastWeekInterval]);

  const twoWeeksAgoCount = useMemo(() => {
    return completedSessions.filter((s) =>
      isWithinInterval(new Date(s.startsAt), twoWeeksAgoInterval),
    ).length;
  }, [completedSessions, twoWeeksAgoInterval]);

  // Active week interval
  const activeWeekInterval = useMemo(() => {
    if (selectedWeekKey === "THIS_WEEK") return thisWeekInterval;
    if (selectedWeekKey === "LAST_WEEK") return lastWeekInterval;
    if (selectedWeekKey === "2_WEEKS_AGO") return twoWeeksAgoInterval;
    if (selectedWeekKey.startsWith("week_")) {
      const found = historicalWeeks.find((hw) => hw.id === selectedWeekKey);
      if (found) {
        return { start: found.start, end: found.end, label: found.label };
      }
    }
    return null;
  }, [
    selectedWeekKey,
    thisWeekInterval,
    lastWeekInterval,
    twoWeeksAgoInterval,
    historicalWeeks,
  ]);

  // Sessions filtered by week
  const weekFilteredSessions = useMemo(() => {
    if (!activeWeekInterval) return completedSessions;
    return completedSessions.filter((s) => {
      const sDate = new Date(s.startsAt);
      return isWithinInterval(sDate, activeWeekInterval);
    });
  }, [completedSessions, activeWeekInterval]);

  // Filtered rows (strictly completed sessions only, filtered by week, status, teacher, and search, sorted ascending)
  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return weekFilteredSessions
      .filter((s) => {
        // Status filter
        if (statusFilter !== "ALL" && s.payoutStatus !== statusFilter) {
          return false;
        }
        // Teacher filter
        if (teacherFilter !== "ALL" && s.teacherId !== teacherFilter) {
          return false;
        }
        // Search
        if (q) {
          const matchTracking = s.trackingCode.toLowerCase().includes(q);
          const matchTeacher = s.teacherName.toLowerCase().includes(q);
          const matchStudent = s.studentName.toLowerCase().includes(q);
          const matchCourse = s.courseTitle.toLowerCase().includes(q);
          const matchRef = s.payoutTransactionId?.toLowerCase().includes(q) || false;
          return matchTracking || matchTeacher || matchStudent || matchCourse || matchRef;
        }
        return true;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [weekFilteredSessions, searchQuery, statusFilter, teacherFilter]);

  // Aggregate metrics (dynamically reflect the active week)
  const totalPaidOut = useMemo(() => {
    return weekFilteredSessions
      .filter((s) => s.payoutStatus === "PAID")
      .reduce((sum, s) => sum + s.payoutAmountRupees, 0);
  }, [weekFilteredSessions]);

  const totalPendingPayout = useMemo(() => {
    return weekFilteredSessions
      .filter((s) => s.payoutStatus === "UNPAID")
      .reduce((sum, s) => sum + s.payoutRateRupees, 0);
  }, [weekFilteredSessions]);

  const paidCount = weekFilteredSessions.filter((s) => s.payoutStatus === "PAID").length;
  const unpaidCount = weekFilteredSessions.filter(
    (s) => s.payoutStatus === "UNPAID",
  ).length;

  const activeWeekTeachersCount = useMemo(() => {
    const map = new Set<string>();
    weekFilteredSessions.forEach((s) => map.add(s.teacherId));
    return map.size;
  }, [weekFilteredSessions]);

  // CSV Export for filtered sessions
  const handleExportCSV = () => {
    const headers = [
      "Session ID",
      "Date & Time",
      "Instructor Name",
      "Instructor Email",
      "Instructor UPI ID",
      "Student Name",
      "Student Email",
      "Course Title",
      "Lesson Status",
      "Fee Rate (INR)",
      "Payout Status",
      "Disbursed Date",
      "Bank Transaction UTR",
      "Payout Notes",
    ];

    const rows = filteredSessions.map((s) => [
      s.trackingCode,
      `"${s.dateFormatted}"`,
      `"${s.teacherName.replace(/"/g, '""')}"`,
      s.teacherEmail,
      s.teacherUpiId || "N/A",
      `"${s.studentName.replace(/"/g, '""')}"`,
      s.studentEmail,
      `"${s.courseTitle.replace(/"/g, '""')}"`,
      s.lessonStatus,
      s.payoutAmountRupees || s.payoutRateRupees,
      s.payoutStatus,
      s.payoutPaidAtFormatted || "N/A",
      s.payoutTransactionId || "N/A",
      `"${(s.payoutNotes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `faculty_payouts_${selectedWeekKey.toLowerCase()}_${format(now, "yyyyMMdd")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
            Institutional Administration
          </span>
          <SplitHeading
            firstClause="Teacher"
            accentClause="Payments"
            as="h1"
            size="lg"
          />
        </div>

        <Link
          href="/admin/payments"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border-default bg-white hover:bg-surface-raised text-heading text-xs font-semibold shadow-2xs transition-all active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <CreditCard className="w-3.5 h-3.5 text-accent" />
          <span>Overall Revenue</span>
          <ChevronRight className="w-3 h-3 text-body/40" />
        </Link>
      </div>

      {/* Week-Wise Filter Bar */}
      <div className="rounded-2xl border border-border-default bg-white/90 backdrop-blur-md p-3.5 shadow-xs space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Week Selection Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <div className="flex items-center gap-1.5 text-xs text-body mr-1 shrink-0 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Payout Week:</span>
            </div>

            {[
              { id: "ALL", label: `All Weeks (${completedSessions.length})` },
              {
                id: "THIS_WEEK",
                label: `Current Week (${thisWeekCount})`,
              },
              {
                id: "LAST_WEEK",
                label: `Last Week (${lastWeekCount})`,
              },
              {
                id: "2_WEEKS_AGO",
                label: `2 Wks Ago (${twoWeeksAgoCount})`,
              },
            ].map((tab) => {
              const active = selectedWeekKey === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedWeekKey(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0 ${
                    active
                      ? "bg-[#3C096C] text-white shadow-xs"
                      : "bg-neutral-100 hover:bg-neutral-200/80 text-body hover:text-heading"
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Historical / Specific Weeks Dropdown & Export */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {historicalWeeks.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-body hidden sm:inline">
                  Specific Week:
                </span>
                <select
                  value={selectedWeekKey}
                  onChange={(e) => setSelectedWeekKey(e.target.value)}
                  className="text-xs bg-neutral-50 hover:bg-neutral-100 border border-border-default rounded-xl px-3 py-1.5 font-medium text-heading focus:outline-none focus:ring-2 focus:ring-[#3C096C]/20 transition-all max-w-[260px] truncate"
                >
                  <option value="ALL">All Completed Weeks</option>
                  {historicalWeeks.map((hw) => (
                    <option key={hw.id} value={hw.id}>
                      {hw.label} ({hw.count} {hw.count === 1 ? "session" : "sessions"})
                    </option>
                  ))}
                </select>

                {selectedWeekKey !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSelectedWeekKey("ALL")}
                    className="p-1.5 rounded-lg text-body hover:text-heading hover:bg-neutral-100 transition-all active:scale-95"
                    title="Clear week filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredSessions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-default bg-white hover:bg-surface-raised text-heading text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-body" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Active Filter Scope Summary Badge */}
        {selectedWeekKey !== "ALL" && (
          <div className="flex items-center justify-between text-[11px] text-body pt-1.5 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>
                Reconciling payout for{" "}
                <strong className="text-heading font-semibold">
                  {activeWeekInterval?.label || selectedWeekKey}
                </strong>{" "}
                · <strong className="text-emerald-700 font-semibold">{weekFilteredSessions.length}</strong> completed sessions
                {unpaidCount > 0 && (
                  <>
                    {" "}· <span className="text-amber-700 font-semibold">₹{totalPendingPayout.toLocaleString("en-IN")} pending ({unpaidCount} unpaid)</span>
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedWeekKey("ALL")}
              className="text-[11px] font-semibold text-accent hover:underline active:scale-95 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Show all weeks
            </button>
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Paid */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Total Paid</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-emerald-700 font-numeric">
            ₹{totalPaidOut.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-body">
            {paidCount} completed session{paidCount === 1 ? "" : "s"} paid{" "}
            {selectedWeekKey !== "ALL" && "(in week)"}
          </p>
        </div>

        {/* Card 2: Pending Payout */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Pending Payout</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-amber-700 font-numeric">
            ₹{totalPendingPayout.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-body">
            {unpaidCount} completed session{unpaidCount === 1 ? "" : "s"} awaiting payout{" "}
            {selectedWeekKey !== "ALL" && "(in week)"}
          </p>
        </div>

        {/* Card 3: Total Completed Sessions */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Completed Sessions</span>
            <div className="w-8 h-8 rounded-xl bg-primary-subtle flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-primary font-numeric">
            {weekFilteredSessions.length}
          </p>
          <p className="text-[11px] text-body">
            {selectedWeekKey === "ALL"
              ? "Concluded sessions eligible for remuneration"
              : "Concluded sessions in selected week"}
          </p>
        </div>

        {/* Card 4: Active Faculty Count */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Instructors Tracked</span>
            <div className="w-8 h-8 rounded-xl bg-accent-subtle flex items-center justify-center">
              <Users className="w-4 h-4 text-accent-dark" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-heading font-numeric">
            {activeWeekTeachersCount}
          </p>
          <p className="text-[11px] text-body">
            {selectedWeekKey === "ALL"
              ? "Active instructors with completed sessions"
              : "Instructors with sessions in selected week"}
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl border border-border-default bg-white overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-border-default/60">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">
              Faculty Session Payouts Ledger
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Teacher Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-body">
              <label htmlFor="teacherFilter" className="font-semibold text-heading shrink-0">
                Instructor:
              </label>
              <select
                id="teacherFilter"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="rounded-xl border border-border-default bg-neutral-50 px-3 py-1.5 text-xs text-heading focus:outline-none focus:border-primary focus:bg-white shadow-2xs"
              >
                <option value="ALL">All Instructors ({uniqueTeachers.length})</option>
                {uniqueTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-border-default text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-white text-heading shadow-xs font-bold"
                    : "text-body hover:text-heading"
                }`}
              >
                All Completed ({weekFilteredSessions.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("UNPAID")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "UNPAID"
                    ? "bg-white text-amber-800 shadow-xs font-bold"
                    : "text-body hover:text-heading"
                }`}
              >
                Unpaid ({unpaidCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PAID")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "PAID"
                    ? "bg-white text-emerald-800 shadow-xs font-bold"
                    : "text-body hover:text-heading"
                }`}
              >
                Paid ({paidCount})
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-body/50 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Session ID (e.g. S0001-SE001), teacher name, student, or bank UTR..."
            className="w-full rounded-xl bg-neutral-50/60 border border-border-default pl-10 pr-4 py-2.5 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-body hover:text-heading font-medium cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-left text-xs text-body border-collapse min-w-[850px]">
            <thead className="bg-bg-alt/30 border-y border-border-default text-[11px] font-bold text-heading uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Session ID</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Instructor</th>
                <th className="py-3 px-4">Student & Class</th>
                <th className="py-3 px-4 text-right">Fee Rate</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default/60">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-body text-xs">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="font-semibold text-heading">
                        {searchQuery
                          ? `No sessions found matching "${searchQuery}".`
                          : selectedWeekKey !== "ALL"
                          ? `No completed sessions recorded for ${activeWeekInterval?.label || "selected week"}.`
                          : "No sessions recorded in this filter view."}
                      </p>
                      {selectedWeekKey !== "ALL" && (
                        <button
                          type="button"
                          onClick={() => setSelectedWeekKey("ALL")}
                          className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1 active:scale-95"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset week filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const isPaid = session.payoutStatus === "PAID";
                  const isCancelled = session.lessonStatus === "CANCELLED";

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-neutral-50/70 transition-colors group"
                    >
                      {/* Session ID */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-heading bg-neutral-100 group-hover:bg-white px-2 py-0.5 rounded border border-border-default shadow-2xs">
                            {session.trackingCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(session.trackingCode, session.id)}
                            className="p-1 rounded text-body/50 hover:text-heading hover:bg-neutral-100 transition-colors cursor-pointer"
                            title="Copy Session ID"
                          >
                            {copiedId === session.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-numeric text-heading">
                        <div>{session.dateFormatted}</div>
                        <span className="text-[10px] text-body/70 capitalize">
                          {session.durationMinutes}m • {session.lessonStatus.toLowerCase()}
                        </span>
                      </td>

                      {/* Instructor */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-heading">{session.teacherName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {session.teacherUpiId ? (
                            <span
                              className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200"
                              title={`UPI: ${session.teacherUpiId}`}
                            >
                              UPI Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              No UPI
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Student & Class */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-heading">{session.studentName}</p>
                        <p className="text-[11px] text-body/70 truncate max-w-[180px]">
                          {session.courseTitle}
                        </p>
                      </td>

                      {/* Fee Rate */}
                      <td className="py-3.5 px-4 text-right font-numeric font-bold text-heading">
                        ₹{session.payoutRateRupees.toLocaleString("en-IN")}
                      </td>

                      {/* Payout Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                            Cancelled
                          </span>
                        ) : isPaid ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              PAID
                            </span>
                            {session.payoutTransactionId && (
                              <span
                                className="text-[9px] font-mono text-emerald-700 max-w-[120px] truncate"
                                title={`Ref: ${session.payoutTransactionId}`}
                              >
                                {session.payoutTransactionId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            <Clock className="w-3 h-3 text-amber-600" />
                            UNPAID
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right">
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(session)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-default bg-white hover:bg-neutral-50 text-xs font-semibold text-heading transition-all shadow-xs cursor-pointer active:scale-95"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-accent" />
                            <span>View / Edit</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(session)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-95"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Teacher</span>
                          </button>
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

      {/* Pay Teacher Modal Pop-up */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white border border-border-default shadow-2xl overflow-hidden">
            {/* Sticky Modal Header */}
            <div className="flex items-center justify-between border-b border-border-default px-5 sm:px-7 py-4 bg-white shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
                    Institutional Remuneration
                  </span>
                  <span className="font-mono text-[11px] font-bold text-primary bg-primary-subtle px-2 py-0.5 rounded border border-primary/20">
                    {selectedSession.trackingCode}
                  </span>
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-heading mt-0.5">
                  Disburse Faculty Remuneration
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full border border-border-default/60 flex items-center justify-center text-body/60 hover:text-heading hover:bg-neutral-100 transition-colors cursor-pointer"
                title="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
              {/* Error & Success Messages */}
              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              {modalSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Two-Column Responsive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Left Column: Dedicated UPI & QR Payment Card */}
                <div className="md:col-span-5 rounded-2xl border-2 border-primary/20 bg-primary-subtle/15 p-4 flex flex-col items-center text-center space-y-3.5">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Dynamic UPI QR</span>
                    </span>
                    {cleanModalUpi && cleanModalUpi.includes("@") ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Live Sync</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Enter UPI ID
                      </span>
                    )}
                  </div>

                  {/* QR Code Container */}
                  <div className="w-44 h-44 rounded-2xl border-2 border-primary/30 p-2 bg-white shadow-xs flex items-center justify-center shrink-0">
                    {qrLoading ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-body text-xs">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-[10px]">Updating QR...</span>
                      </div>
                    ) : cleanModalUpi && cleanModalUpi.includes("@") ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={qrDataUrl || qrApiUrl}
                        alt={`UPI Payment QR for ${selectedSession.teacherName}`}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="p-3 text-center text-[11px] text-body-muted flex flex-col items-center gap-1.5">
                        <QrCode className="w-8 h-8 text-neutral-300 stroke-1" />
                        <span>Enter a valid UPI handle below to generate QR</span>
                      </div>
                    )}
                  </div>

                  {/* Pre-filled Amount & Status */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-body-muted uppercase font-bold tracking-wider">
                      {includeAmountInQr ? "Pre-filled Payout Amount" : "Payee Set (Open Amount)"}
                    </span>
                    <p className="font-serif text-2xl font-bold text-heading font-numeric">
                      ₹{customAmountRupees.toLocaleString("en-IN")}
                    </p>
                  </div>

                  {/* Editable UPI ID with Instant Save to Profile */}
                  <div className="w-full space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <label htmlFor="modal-teacher-upi" className="text-[10px] font-bold uppercase tracking-wider text-body flex items-center gap-1">
                        <span>Teacher UPI ID (VPA)</span>
                      </label>
                      {selectedSession.teacherUpiId && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(cleanModalUpi, "modal-upi")}
                          className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          {copiedId === "modal-upi" ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-2.5 h-2.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          id="modal-teacher-upi"
                          type="text"
                          value={modalUpiId}
                          onChange={(e) => {
                            setModalUpiId(e.target.value);
                            setUpiSaveMessage(null);
                          }}
                          placeholder="e.g. mobile@ybl or name@okhdfcbank"
                          className="w-full font-mono text-xs font-semibold text-heading bg-white pl-3 pr-2 py-1.5 rounded-xl border border-border-default shadow-2xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveTeacherUpi}
                        disabled={isSavingUpi || !cleanModalUpi}
                        className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save to teacher's profile in database"
                      >
                        {isSavingUpi ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save</span>
                      </button>
                    </div>

                    {/* Quick Handle Suggestions */}
                    <div className="space-y-1 pt-0.5">
                      <span className="text-[9.5px] text-body/70 font-semibold block">
                        Quick Bank Switch:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {[
                          { label: "GPay HDFC", handle: "@okhdfcbank" },
                          { label: "GPay Axis", handle: "@okaxis" },
                          { label: "GPay SBI", handle: "@oksbi" },
                          { label: "PhonePe", handle: "@ybl" },
                          { label: "PhonePe ICICI", handle: "@ibl" },
                          { label: "Paytm SBI", handle: "@ptsbi" },
                          { label: "Paytm Axis", handle: "@ptaxis" },
                          { label: "Paytm", handle: "@paytm" },
                        ].map((chip) => (
                          <button
                            key={chip.handle}
                            type="button"
                            onClick={() => handleQuickHandle(chip.handle)}
                            className="px-1.5 py-0.5 text-[9.5px] font-mono font-medium rounded-md border border-border-default/70 bg-white hover:bg-neutral-100 text-body hover:text-heading transition-colors cursor-pointer"
                            title={`Switch handle to ${chip.handle}`}
                          >
                            {chip.handle}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UPI Save Notification */}
                    {upiSaveMessage && (
                      <div
                        className={`p-2 rounded-lg text-[10.5px] flex items-center gap-1.5 ${
                          upiSaveMessage.type === "success"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {upiSaveMessage.type === "success" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                        )}
                        <span>{upiSaveMessage.text}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Payment Actions */}
                  {cleanModalUpi && cleanModalUpi.includes("@") && upiUri && (
                    <div className="w-full space-y-1.5 pt-1 border-t border-primary/20">
                      <div className="grid grid-cols-2 gap-1.5">
                        <a
                          href={upiUri}
                          className="px-2 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all flex items-center justify-center gap-1"
                          title="Trigger UPI application directly on mobile device"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pay via App</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleDownloadQr}
                          className="px-2 py-1.5 rounded-xl border border-border-default hover:bg-white text-heading text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer"
                          title="Download QR code PNG"
                        >
                          <Download className="w-3.5 h-3.5 text-body" />
                          <span>Download QR</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-body-muted px-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(upiUri, "modal-upi-intent")}
                          className="hover:text-primary transition-colors cursor-pointer underline"
                        >
                          {copiedId === "modal-upi-intent" ? "URI Copied!" : "Copy Payment URI"}
                        </button>
                        <a
                          href={qrApiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors inline-flex items-center gap-0.5"
                        >
                          <span>Open API Link</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Instructor Context & Audit Form */}
                <div className="md:col-span-7 space-y-4">
                  {/* Instructor & Session Overview Card */}
                  <div className="p-4 rounded-2xl bg-neutral-50/80 border border-border-default space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-body/70 tracking-wider">
                        Instructor Recipient
                      </span>
                      <span className="text-[10px] font-bold text-primary font-numeric bg-primary-subtle px-2 py-0.5 rounded border border-primary/20">
                        {selectedSession.durationMinutes}m Session Fee
                      </span>
                    </div>

                    <div>
                      <h4 className="font-serif text-base font-bold text-heading">
                        {selectedSession.teacherName}
                      </h4>
                      <p className="text-xs text-body">{selectedSession.teacherEmail}</p>
                    </div>

                    <div className="pt-2 border-t border-border-default/70 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-body-muted block">Student</span>
                        <span className="font-semibold text-heading truncate block">
                          {selectedSession.studentName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-body-muted block">Course</span>
                        <span className="font-semibold text-heading truncate block">
                          {selectedSession.courseTitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Audit Confirmation Inputs */}
                  <div className="space-y-3 pt-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-accent" />
                      <span>Confirm Transaction Audit Details</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Disbursed Amount */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-body">
                          Amount Paid (₹)
                        </label>
                        <input
                          type="number"
                          min={50}
                          max={50000}
                          step={50}
                          value={customAmountRupees}
                          onChange={(e) => setCustomAmountRupees(Number(e.target.value))}
                          className="w-full rounded-xl bg-white border border-border-default px-3 py-2 text-xs text-heading font-numeric focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                        />
                        <span className="text-[10px] text-body-muted">
                          QR auto-updates with this amount
                        </span>
                      </div>

                      {/* Bank / UTR Reference ID */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-body flex items-center justify-between">
                          <span>Bank UTR / Ref ID</span>
                          <span className="text-[10px] text-primary font-normal">Audit Proof</span>
                        </label>
                        <input
                          type="text"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          placeholder="e.g. 426819203948 or UPI/123456"
                          className="w-full rounded-xl bg-white border border-border-default px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Note / Remark */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-body">
                        Payout Note / Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        value={payoutNotes}
                        onChange={(e) => setPayoutNotes(e.target.value)}
                        placeholder="e.g. Disbursed via institutional PhonePe"
                        className="w-full rounded-xl bg-white border border-border-default px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                      />
                    </div>

                    {/* Auto-Description Details Box */}
                    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-[11px] space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-body block">
                        Embedded QR Transaction Note
                      </span>
                      <p className="font-mono text-[10.5px] text-heading bg-white px-2 py-1 rounded border border-neutral-200 truncate">
                        Session {selectedSession.trackingCode} - {selectedSession.teacherName} - Rs {customAmountRupees}
                      </p>
                      <p className="text-[10px] text-body-muted leading-relaxed">
                        Scanning the QR code on Google Pay, PhonePe, Paytm, or BHIM automatically fills the recipient name, session reference, and amount.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-border-default bg-neutral-50/70 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              {selectedSession.payoutStatus === "PAID" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleConfirmPayout("UNPAID")}
                  className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Reverting..." : "Revert to UNPAID"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 rounded-xl border border-border-default bg-white hover:bg-neutral-100 text-xs font-semibold text-heading transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <div className="flex items-center gap-2 justify-end">
                {selectedSession.payoutStatus === "PAID" && (
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2.5 rounded-xl border border-border-default bg-white hover:bg-neutral-100 text-xs font-semibold text-heading transition-all cursor-pointer"
                  >
                    Close
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleConfirmPayout("PAID")}
                  className="btn-tactile px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Payout...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {selectedSession.payoutStatus === "PAID"
                          ? "Update Payout Details"
                          : "Confirm & Mark as PAID"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
