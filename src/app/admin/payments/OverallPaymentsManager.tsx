"use client";

// Reading this as: Institutional Revenue & Student Payments dashboard for Gandharva leadership, with an Apple-inspired executive language, leaning toward Tailwind v4 utilities + crisp SVG interactive micro-charts + tactile tab/filter controls + imperial purple (#3C096C) accents.

import { useState, useMemo } from "react";
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
  FileSpreadsheet,
  Download,
  Filter,
  ArrowUpDown,
  Banknote,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
  Calendar,
  Layers,
  Music,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { SplitHeading } from "@/components/ui/SplitHeading";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  startOfDay,
  endOfDay,
  subDays,
  differenceInDays,
  format,
  isWithinInterval,
} from "date-fns";

export interface FormattedPaymentItem {
  id: string;
  customId?: string | null;
  createdAt: string; // ISO string
  createdAtFormatted: string;
  dateKey: string; // YYYY-MM-DD
  amountMinorUnits: number;
  amountRupees: number;
  currency: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  status: "CREATED" | "PAID" | "FAILED" | "REFUNDED";
  notes: string | null;
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  course: {
    id: string;
    title: string;
    instrument: string | null;
    level: string | null;
  };
}

export interface CourseOption {
  id: string;
  title: string;
  instrument: string | null;
  level: string | null;
  priceMinorUnits: number;
}

export type TimeFilterRange =
  | "THIS_WEEK"
  | "LAST_WEEK"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "THIS_YEAR"
  | "LAST_YEAR"
  | "ALL_TIME"
  | "CUSTOM";

interface OverallPaymentsManagerProps {
  initialPayments: FormattedPaymentItem[];
  courses: CourseOption[];
}

export function OverallPaymentsManager({
  initialPayments,
  courses,
}: OverallPaymentsManagerProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilterRange>("THIS_MONTH");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return format(d, "yyyy-MM-dd");
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return format(new Date(), "yyyy-MM-dd");
  });
  const [selectedCourseId, setSelectedCourseId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"ALL" | "PAID" | "CREATED" | "FAILED" | "REFUNDED">("ALL");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeModalPayment, setActiveModalPayment] = useState<FormattedPaymentItem | null>(null);
  const [hoveredTrendBucket, setHoveredTrendBucket] = useState<{
    label: string;
    sublabel: string;
    revenue: number;
    count: number;
  } | null>(null);

  // Quick range helper functions
  const handleQuickPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    setTimeFilter("CUSTOM");
  };

  const handleMonthToDate = () => {
    const end = new Date();
    const start = startOfMonth(end);
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    setTimeFilter("CUSTOM");
  };

  const customDaysCount = useMemo(() => {
    if (!customStartDate || !customEndDate) return 0;
    try {
      const s = new Date(`${customStartDate}T00:00:00`);
      const e = new Date(`${customEndDate}T23:59:59`);
      const diff = differenceInDays(e >= s ? e : s, e >= s ? s : e) + 1;
      return Math.max(1, diff);
    } catch {
      return 0;
    }
  }, [customStartDate, customEndDate]);

  // Reference timestamp
  const now = useMemo(() => new Date(), []);

  // Compute intervals for selected time filter and previous comparison period
  const { currentInterval, previousInterval, filterLabel, comparisonLabel } = useMemo(() => {
    switch (timeFilter) {
      case "THIS_WEEK": {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });
        const prevStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const prevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        return {
          currentInterval: { start, end },
          previousInterval: { start: prevStart, end: prevEnd },
          filterLabel: "Current Week",
          comparisonLabel: "vs. previous week",
        };
      }
      case "LAST_WEEK": {
        const start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const prevStart = startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
        const prevEnd = endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
        return {
          currentInterval: { start, end },
          previousInterval: { start: prevStart, end: prevEnd },
          filterLabel: "Last Week",
          comparisonLabel: "vs. week before last",
        };
      }
      case "THIS_MONTH": {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const prevStart = startOfMonth(subMonths(now, 1));
        const prevEnd = endOfMonth(subMonths(now, 1));
        return {
          currentInterval: { start, end },
          previousInterval: { start: prevStart, end: prevEnd },
          filterLabel: "Current Month",
          comparisonLabel: "vs. last month",
        };
      }
      case "LAST_MONTH": {
        const start = startOfMonth(subMonths(now, 1));
        const end = endOfMonth(subMonths(now, 1));
        const prevStart = startOfMonth(subMonths(now, 2));
        const prevEnd = endOfMonth(subMonths(now, 2));
        return {
          currentInterval: { start, end },
          previousInterval: { start: prevStart, end: prevEnd },
          filterLabel: "Last Month",
          comparisonLabel: "vs. 2 months prior",
        };
      }
      case "THIS_YEAR": {
        const start = startOfYear(now);
        const end = endOfYear(now);
        const prevStart = startOfYear(subYears(now, 1));
        const prevEnd = endOfYear(subYears(now, 1));
        return {
          currentInterval: { start, end },
          previousInterval: { start: prevStart, end: prevEnd },
          filterLabel: "Current Year",
          comparisonLabel: "vs. last year",
        };
      }
      case "LAST_YEAR": {
        const start = startOfYear(subYears(now, 1));
        const end = endOfYear(subYears(now, 1));
        const prevStart = startOfYear(subYears(now, 2));
        const prevEnd = endOfYear(subYears(now, 2));
        return {
          currentInterval: { start, end },
          previousInterval: { start: prevStart, end: prevEnd },
          filterLabel: "Last Year",
          comparisonLabel: "vs. 2 years prior",
        };
      }
      case "CUSTOM": {
        if (!customStartDate || !customEndDate) {
          return {
            currentInterval: null,
            previousInterval: null,
            filterLabel: "Custom Range (Select Dates)",
            comparisonLabel: "no comparison period",
          };
        }

        const rawStart = new Date(`${customStartDate}T00:00:00`);
        const rawEnd = new Date(`${customEndDate}T23:59:59.999`);

        // Gracefully handle date order
        const start = rawStart <= rawEnd ? startOfDay(rawStart) : startOfDay(rawEnd);
        const end = rawStart <= rawEnd ? endOfDay(rawEnd) : endOfDay(rawStart);

        const daySpan = Math.max(1, differenceInDays(end, start) + 1);
        const prevEnd = endOfDay(subDays(start, 1));
        const prevStart = startOfDay(subDays(prevEnd, daySpan - 1));

        return {
          currentInterval: { start, end },
          previousInterval: { start: prevStart, end: prevEnd },
          filterLabel: `${format(start, "MMM d, yyyy")} to ${format(end, "MMM d, yyyy")}`,
          comparisonLabel: `vs. previous ${daySpan} days`,
        };
      }
      case "ALL_TIME":
      default: {
        return {
          currentInterval: null,
          previousInterval: null,
          filterLabel: "All Time",
          comparisonLabel: "lifetime baseline",
        };
      }
    }
  }, [timeFilter, now, customStartDate, customEndDate]);

  // Payments filtered by Time and Course
  const timeAndCourseFiltered = useMemo(() => {
    return initialPayments.filter((p) => {
      const pDate = new Date(p.createdAt);

      // Time Filter check
      if (currentInterval) {
        if (!isWithinInterval(pDate, currentInterval)) {
          return false;
        }
      }

      // Course Filter check
      if (selectedCourseId !== "ALL" && p.course.id !== selectedCourseId) {
        return false;
      }

      return true;
    });
  }, [initialPayments, currentInterval, selectedCourseId]);

  // Previous interval payments for percentage growth comparison
  const previousPeriodFiltered = useMemo(() => {
    if (!previousInterval) return [];
    return initialPayments.filter((p) => {
      const pDate = new Date(p.createdAt);
      if (!isWithinInterval(pDate, previousInterval)) return false;
      if (selectedCourseId !== "ALL" && p.course.id !== selectedCourseId) return false;
      return true;
    });
  }, [initialPayments, previousInterval, selectedCourseId]);

  // Aggregated KPI Metrics
  const metrics = useMemo(() => {
    const paidList = timeAndCourseFiltered.filter((p) => p.status === "PAID");
    const createdList = timeAndCourseFiltered.filter((p) => p.status === "CREATED");
    const failedList = timeAndCourseFiltered.filter((p) => p.status === "FAILED");
    const refundedList = timeAndCourseFiltered.filter((p) => p.status === "REFUNDED");

    const totalRevenue = paidList.reduce((sum, p) => sum + p.amountRupees, 0);
    const pendingAmount = createdList.reduce((sum, p) => sum + p.amountRupees, 0);
    const paidCount = paidList.length;
    const totalTransactions = timeAndCourseFiltered.length;
    const successRate = totalTransactions > 0 ? (paidCount / totalTransactions) * 100 : 0;
    const averageOrderValue = paidCount > 0 ? Math.round(totalRevenue / paidCount) : 0;

    // Previous comparison
    const prevPaid = previousPeriodFiltered.filter((p) => p.status === "PAID");
    const prevRevenue = prevPaid.reduce((sum, p) => sum + p.amountRupees, 0);
    const revenueGrowth =
      prevRevenue > 0
        ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
        : totalRevenue > 0
        ? 100
        : 0;

    return {
      totalRevenue,
      pendingAmount,
      paidCount,
      pendingCount: createdList.length,
      failedCount: failedList.length,
      refundedCount: refundedList.length,
      totalTransactions,
      successRate,
      averageOrderValue,
      revenueGrowth,
      prevRevenue,
    };
  }, [timeAndCourseFiltered, previousPeriodFiltered]);

  // Course-wise aggregation
  const courseDistribution = useMemo(() => {
    const map = new Map<
      string,
      {
        courseId: string;
        title: string;
        instrument: string | null;
        revenue: number;
        paidCount: number;
        totalCount: number;
      }
    >();

    timeAndCourseFiltered.forEach((p) => {
      const cId = p.course.id;
      const existing = map.get(cId) || {
        courseId: cId,
        title: p.course.title,
        instrument: p.course.instrument,
        revenue: 0,
        paidCount: 0,
        totalCount: 0,
      };

      existing.totalCount += 1;
      if (p.status === "PAID") {
        existing.revenue += p.amountRupees;
        existing.paidCount += 1;
      }
      map.set(cId, existing);
    });

    const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalPaidRev = metrics.totalRevenue || 1;

    return list.map((item) => ({
      ...item,
      percentage: Math.round((item.revenue / totalPaidRev) * 100),
    }));
  }, [timeAndCourseFiltered, metrics.totalRevenue]);

  // Trend Chart Buckets
  const trendBuckets = useMemo(() => {
    // Week view: 7 days
    if (timeFilter === "THIS_WEEK" || timeFilter === "LAST_WEEK") {
      const baseStart =
        timeFilter === "THIS_WEEK"
          ? startOfWeek(now, { weekStartsOn: 1 })
          : startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(baseStart);
        d.setDate(baseStart.getDate() + i);
        const dayKey = format(d, "yyyy-MM-dd");
        const dayLabel = format(d, "EEE");
        const fullDate = format(d, "MMM d, yyyy");

        const matching = timeAndCourseFiltered.filter((p) => {
          if (p.status !== "PAID") return false;
          const pDate = new Date(p.createdAt);
          return format(pDate, "yyyy-MM-dd") === dayKey;
        });

        const rev = matching.reduce((sum, p) => sum + p.amountRupees, 0);
        days.push({
          key: dayKey,
          label: dayLabel,
          sublabel: fullDate,
          revenue: rev,
          count: matching.length,
        });
      }
      return days;
    }

    // Month view: 5 intervals (e.g. Days 1-7, 8-14, 15-21, 22-28, 29-31)
    if (timeFilter === "THIS_MONTH" || timeFilter === "LAST_MONTH") {
      const baseMonth = timeFilter === "THIS_MONTH" ? now : subMonths(now, 1);
      const mStart = startOfMonth(baseMonth);
      const mEnd = endOfMonth(baseMonth);
      const totalDays = mEnd.getDate();

      const intervals = [
        { label: "Days 1-7", startDay: 1, endDay: 7 },
        { label: "Days 8-14", startDay: 8, endDay: 14 },
        { label: "Days 15-21", startDay: 15, endDay: 21 },
        { label: "Days 22-28", startDay: 22, endDay: 28 },
        { label: `Days 29-${totalDays}`, startDay: 29, endDay: totalDays },
      ];

      return intervals.map((inv) => {
        const matching = timeAndCourseFiltered.filter((p) => {
          if (p.status !== "PAID") return false;
          const pDate = new Date(p.createdAt);
          if (pDate.getMonth() !== baseMonth.getMonth() || pDate.getFullYear() !== baseMonth.getFullYear()) {
            return false;
          }
          const dayNum = pDate.getDate();
          return dayNum >= inv.startDay && dayNum <= inv.endDay;
        });

        const rev = matching.reduce((sum, p) => sum + p.amountRupees, 0);
        return {
          key: inv.label,
          label: inv.label,
          sublabel: `${format(baseMonth, "MMMM yyyy")}`,
          revenue: rev,
          count: matching.length,
        };
      });
    }

    // Year view: 12 months (Jan to Dec)
    if (timeFilter === "THIS_YEAR" || timeFilter === "LAST_YEAR") {
      const targetYear = timeFilter === "THIS_YEAR" ? now.getFullYear() : now.getFullYear() - 1;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      return monthNames.map((mName, mIdx) => {
        const matching = timeAndCourseFiltered.filter((p) => {
          if (p.status !== "PAID") return false;
          const pDate = new Date(p.createdAt);
          return pDate.getFullYear() === targetYear && pDate.getMonth() === mIdx;
        });

        const rev = matching.reduce((sum, p) => sum + p.amountRupees, 0);
        return {
          key: `${targetYear}-${mIdx}`,
          label: mName,
          sublabel: `${mName} ${targetYear}`,
          revenue: rev,
          count: matching.length,
        };
      });
    }

    // Custom date range view
    if (timeFilter === "CUSTOM") {
      if (!customStartDate || !customEndDate) {
        return [{ key: "custom-empty", label: "No Dates", sublabel: "Select dates above", revenue: 0, count: 0 }];
      }

      const rawStart = new Date(`${customStartDate}T00:00:00`);
      const rawEnd = new Date(`${customEndDate}T23:59:59.999`);
      const start = rawStart <= rawEnd ? startOfDay(rawStart) : startOfDay(rawEnd);
      const end = rawStart <= rawEnd ? endOfDay(rawEnd) : endOfDay(rawStart);
      const daySpan = Math.max(1, differenceInDays(end, start) + 1);

      // 1. If 31 days or fewer: Show daily bars
      if (daySpan <= 31) {
        const days = [];
        for (let i = 0; i < daySpan; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const dayKey = format(d, "yyyy-MM-dd");
          const dayLabel = daySpan <= 14 ? format(d, "EEE d") : format(d, "d MMM");
          const fullDate = format(d, "EEE, MMM d, yyyy");

          const matching = timeAndCourseFiltered.filter((p) => {
            if (p.status !== "PAID") return false;
            const pDate = new Date(p.createdAt);
            return format(pDate, "yyyy-MM-dd") === dayKey;
          });

          const rev = matching.reduce((sum, p) => sum + p.amountRupees, 0);
          days.push({
            key: dayKey,
            label: dayLabel,
            sublabel: fullDate,
            revenue: rev,
            count: matching.length,
          });
        }
        return days;
      }

      // 2. If between 32 and 120 days: Group by ~7-day segments
      if (daySpan <= 120) {
        const segmentCount = Math.min(8, Math.ceil(daySpan / 7));
        const daysPerSegment = Math.ceil(daySpan / segmentCount);
        const segments = [];

        for (let s = 0; s < segmentCount; s++) {
          const segStart = new Date(start);
          segStart.setDate(start.getDate() + s * daysPerSegment);
          const segEnd = new Date(start);
          segEnd.setDate(Math.min(end.getDate(), start.getDate() + (s + 1) * daysPerSegment - 1));
          if (segStart > end) break;
          const actualEnd = segEnd > end ? end : segEnd;

          const segLabel = `${format(segStart, "MMM d")} to ${format(actualEnd, "MMM d")}`;
          const matching = timeAndCourseFiltered.filter((p) => {
            if (p.status !== "PAID") return false;
            const pDate = new Date(p.createdAt);
            return isWithinInterval(pDate, { start: startOfDay(segStart), end: endOfDay(actualEnd) });
          });

          const rev = matching.reduce((sum, p) => sum + p.amountRupees, 0);
          segments.push({
            key: `seg-${s}`,
            label: format(segStart, "d MMM"),
            sublabel: segLabel,
            revenue: rev,
            count: matching.length,
          });
        }
        return segments;
      }

      // 3. If > 120 days: Group by calendar month
      const monthsMap = new Map<string, { label: string; sublabel: string; revenue: number; count: number }>();
      timeAndCourseFiltered.forEach((p) => {
        if (p.status === "PAID") {
          const pDate = new Date(p.createdAt);
          const monthKey = format(pDate, "yyyy-MM");
          const cur = monthsMap.get(monthKey) || {
            label: format(pDate, "MMM yy"),
            sublabel: format(pDate, "MMMM yyyy"),
            revenue: 0,
            count: 0,
          };
          cur.revenue += p.amountRupees;
          cur.count += 1;
          monthsMap.set(monthKey, cur);
        }
      });

      const sortedMonthKeys = Array.from(monthsMap.keys()).sort();
      if (sortedMonthKeys.length === 0) {
        return [{ key: "custom-empty", label: "No Revenue", sublabel: "No transactions in range", revenue: 0, count: 0 }];
      }

      return sortedMonthKeys.map((k) => ({
        key: k,
        label: monthsMap.get(k)!.label,
        sublabel: monthsMap.get(k)!.sublabel,
        revenue: monthsMap.get(k)!.revenue,
        count: monthsMap.get(k)!.count,
      }));
    }

    // All Time view: Group by Years
    const yearsMap = new Map<number, { revenue: number; count: number }>();
    timeAndCourseFiltered.forEach((p) => {
      if (p.status === "PAID") {
        const y = new Date(p.createdAt).getFullYear();
        const cur = yearsMap.get(y) || { revenue: 0, count: 0 };
        cur.revenue += p.amountRupees;
        cur.count += 1;
        yearsMap.set(y, cur);
      }
    });

    const sortedYears = Array.from(yearsMap.keys()).sort();
    if (sortedYears.length === 0) {
      return [{ key: "2026", label: "2026", sublabel: "Year 2026", revenue: 0, count: 0 }];
    }

    return sortedYears.map((y) => ({
      key: String(y),
      label: String(y),
      sublabel: `Full Year ${y}`,
      revenue: yearsMap.get(y)?.revenue || 0,
      count: yearsMap.get(y)?.count || 0,
    }));
  }, [timeFilter, now, timeAndCourseFiltered, customStartDate, customEndDate]);

  // Max value for trend scaling
  const maxTrendRevenue = useMemo(() => {
    const maxVal = Math.max(...trendBuckets.map((b) => b.revenue), 0);
    return maxVal > 0 ? maxVal : 50000;
  }, [trendBuckets]);

  // Table payments (includes Search, Status Tabs, and Sorting)
  const displayPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return timeAndCourseFiltered
      .filter((p) => {
        // Status Tab
        if (statusTab !== "ALL" && p.status !== statusTab) {
          return false;
        }

        // Search query
        if (q) {
          const matchStudent = p.student.name.toLowerCase().includes(q);
          const matchEmail = p.student.email.toLowerCase().includes(q);
          const matchOrder = p.gatewayOrderId.toLowerCase().includes(q);
          const matchPayment = p.gatewayPaymentId?.toLowerCase().includes(q) || false;
          const matchReceipt = p.customId?.toLowerCase().includes(q) || false;
          const matchCourse = p.course.title.toLowerCase().includes(q);
          return matchStudent || matchEmail || matchOrder || matchPayment || matchReceipt || matchCourse;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortField === "amount") {
          return sortOrder === "desc"
            ? b.amountRupees - a.amountRupees
            : a.amountRupees - b.amountRupees;
        }
        // sort by date
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
  }, [timeAndCourseFiltered, statusTab, searchQuery, sortField, sortOrder]);

  // Copy ID handler
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = [
      "Payment ID",
      "Gateway Order ID",
      "Gateway Payment ID",
      "Date",
      "Student Name",
      "Student Email",
      "Course Title",
      "Instrument",
      "Amount (INR)",
      "Status",
      "Gateway",
    ];

    const rows = displayPayments.map((p) => [
      p.id,
      p.customId || p.gatewayPaymentId || "N/A",
      p.gatewayOrderId,
      p.gatewayPaymentId || "N/A",
      p.createdAtFormatted,
      `"${p.student.name.replace(/"/g, '""')}"`,
      p.student.email,
      `"${p.course.title.replace(/"/g, '""')}"`,
      p.course.instrument || "General",
      p.amountRupees,
      p.status,
      p.gateway,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `institutional_payments_${timeFilter.toLowerCase()}_${format(now, "yyyyMMdd")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <SplitHeading
            firstClause="Institutional"
            accentClause="Payments"
            as="h1"
            size="lg"
          />
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/admin/teacher-payments"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-accent text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Teacher Payments</span>
            <ChevronRight className="w-3 h-3 text-accent/60" />
          </Link>

          <button
            onClick={handleExportCSV}
            disabled={displayPayments.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border-default bg-white hover:bg-surface-raised text-heading text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-body" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Apple Segmented Time Filter Bar & Course Selector */}
      <div className="rounded-2xl border border-border-default bg-white/90 backdrop-blur-md p-3 shadow-xs space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          {/* Time Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold text-body mr-1 hidden sm:inline flex-shrink-0">
              Period:
            </span>

            {[
              { id: "THIS_WEEK", label: "Current Week" },
              { id: "LAST_WEEK", label: "Last Week" },
              { id: "THIS_MONTH", label: "Current Month" },
              { id: "LAST_MONTH", label: "Last Month" },
              { id: "THIS_YEAR", label: "Current Year" },
              { id: "LAST_YEAR", label: "Last Year" },
              { id: "ALL_TIME", label: "All Time" },
              { id: "CUSTOM", label: "Custom Range", isCustom: true },
            ].map((tab) => {
              const active = timeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTimeFilter(tab.id as TimeFilterRange)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 cursor-pointer ${
                    active
                      ? "bg-[#3C096C] text-white shadow-xs"
                      : "bg-surface-subtle/80 hover:bg-surface-raised text-body hover:text-heading"
                  }`}
                >
                  {tab.isCustom && <Calendar className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Course Selector Dropdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-semibold text-body hidden md:inline">
              Course:
            </span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="text-xs bg-surface-subtle/90 hover:bg-surface-raised border border-border-default rounded-xl px-3 py-1.5 font-medium text-heading focus:outline-none focus:ring-2 focus:ring-[#3C096C]/20 transition-all max-w-[280px] truncate cursor-pointer"
            >
              <option value="ALL">All Academy Courses ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>

            {selectedCourseId !== "ALL" && (
              <button
                onClick={() => setSelectedCourseId("ALL")}
                className="p-1.5 rounded-lg text-body hover:text-heading hover:bg-surface-subtle transition-all active:scale-95 cursor-pointer"
                title="Reset course filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker Toolbar */}
        {timeFilter === "CUSTOM" && (
          <div className="pt-3 border-t border-purple-100/70 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-gradient-to-r from-purple-50/40 via-surface-subtle/40 to-purple-50/30 p-3.5 rounded-xl border border-purple-100/80">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-body uppercase tracking-wider">
                  From:
                </span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs bg-white border border-border-default hover:border-[#3C096C]/40 focus:border-[#3C096C] rounded-xl px-3 py-1.5 font-medium text-heading focus:outline-none focus:ring-2 focus:ring-[#3C096C]/20 transition-all shadow-2xs cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1 text-body/50">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-body uppercase tracking-wider">
                  To:
                </span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs bg-white border border-border-default hover:border-[#3C096C]/40 focus:border-[#3C096C] rounded-xl px-3 py-1.5 font-medium text-heading focus:outline-none focus:ring-2 focus:ring-[#3C096C]/20 transition-all shadow-2xs cursor-pointer"
                />
              </div>

              {/* Day count badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-border-default text-[11px] font-medium text-body shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3C096C]" />
                <span className="font-numeric font-semibold text-heading">
                  {customDaysCount}
                </span>{" "}
                day{customDaysCount === 1 ? "" : "s"} selected
              </div>
            </div>

            {/* Quick Range Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-body/70 hidden sm:inline mr-1">
                Presets:
              </span>
              {[
                { label: "Last 7 Days", days: 7 },
                { label: "Last 14 Days", days: 14 },
                { label: "Last 30 Days", days: 30 },
                { label: "Last 90 Days", days: 90 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleQuickPreset(p.days)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white hover:bg-surface-raised border border-border-default text-body hover:text-heading transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleMonthToDate}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white hover:bg-surface-raised border border-border-default text-body hover:text-heading transition-all active:scale-95 shadow-2xs cursor-pointer"
              >
                Month to Date
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("THIS_MONTH")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all active:scale-95 cursor-pointer"
                title="Reset to current month"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}

        {/* Active Filter Scope Summary Badge */}
        <div className="flex items-center justify-between text-[11px] text-body pt-1 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Displaying records for{" "}
              <strong className="text-heading font-semibold">{filterLabel}</strong>
              {selectedCourseId !== "ALL" && (
                <>
                  {" "}· Filtered to{" "}
                  <strong className="text-accent font-semibold">
                    {courses.find((c) => c.id === selectedCourseId)?.title || "Selected Course"}
                  </strong>
                </>
              )}
            </span>
          </div>
          <span className="text-body/70 hidden sm:inline">
            {metrics.totalTransactions} transactions recorded
          </span>
        </div>
      </div>

      {/* 3. Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Revenue */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Total Revenue Collected</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4 text-[#3C096C]" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-heading font-numeric">
            ₹{metrics.totalRevenue.toLocaleString("en-IN")}
          </p>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md ${
                metrics.revenueGrowth >= 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              {metrics.revenueGrowth >= 0 ? `+${metrics.revenueGrowth}%` : `${metrics.revenueGrowth}%`}
            </span>
            <span className="text-body/70 truncate">{comparisonLabel}</span>
          </div>
        </div>

        {/* Card 2: Successful Transactions */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Successful Invoices</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-emerald-700 font-numeric">
            {metrics.paidCount}
          </p>
          <p className="text-[11px] text-body">
            {metrics.successRate.toFixed(1)}% fulfillment rate ({metrics.totalTransactions} total)
          </p>
        </div>

        {/* Card 3: Pending Invoices */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Pending / Uncaptured</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-amber-700 font-numeric">
            ₹{metrics.pendingAmount.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-body">
            {metrics.pendingCount} payment order{metrics.pendingCount === 1 ? "" : "s"} awaiting capture
          </p>
        </div>

        {/* Card 4: Average Order Value */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Average Order Value (AOV)</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-sky-600" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-heading font-numeric">
            ₹{metrics.averageOrderValue.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-body">
            Per enrolled student transaction
          </p>
        </div>
      </div>

      {/* 4. Visual Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph 1: Revenue Over Time Trend (2 Columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-border-default bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-heading flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#3C096C]" />
                Revenue Trend Over Time
              </h2>
            </div>

            {/* Peak day/period indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-[11px] font-semibold text-[#3C096C]">
              <Sparkles className="w-3 h-3" />
              <span>
                Peak: ₹
                {Math.max(...trendBuckets.map((b) => b.revenue)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* SVG Interactive Chart */}
          <div className="relative pt-4 pb-2">
            {trendBuckets.length === 0 || maxTrendRevenue === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-center text-body text-xs">
                <AlertTriangle className="w-6 h-6 text-amber-500 mb-2 opacity-60" />
                No payment transactions recorded during {filterLabel}.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Visual rectangular bar chart with background grid */}
                <div className="relative h-56 w-full px-2 pt-6 pb-2 border-b border-gray-200">
                  {/* Subtle horizontal grid lines */}
                  <div className="absolute inset-x-2 top-6 bottom-2 flex flex-col justify-between pointer-events-none opacity-40">
                    <div className="border-b border-dashed border-gray-200 w-full" />
                    <div className="border-b border-dashed border-gray-200 w-full" />
                    <div className="border-b border-dashed border-gray-200 w-full" />
                    <div className="border-b border-solid border-gray-200 w-full" />
                  </div>

                  {/* Bars container */}
                  <div className="relative z-10 h-full w-full flex items-end gap-1.5 sm:gap-2.5">
                    {trendBuckets.map((bucket, idx) => {
                      const heightPercent =
                        maxTrendRevenue > 0 && bucket.revenue > 0
                          ? Math.max(Math.round((bucket.revenue / maxTrendRevenue) * 100), 4)
                          : 0;

                      const isHovered = hoveredTrendBucket?.label === bucket.label;

                      return (
                        <div
                          key={bucket.key || idx}
                          onMouseEnter={() => setHoveredTrendBucket(bucket)}
                          onMouseLeave={() => setHoveredTrendBucket(null)}
                          className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                        >
                          {/* Hover Tooltip Floating Card */}
                          {isHovered && (
                            <div className="absolute -top-12 z-30 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] shadow-lg whitespace-nowrap pointer-events-none transform -translate-x-1/2 left-1/2 animate-in fade-in zoom-in-95 duration-150">
                              <div className="font-semibold">{bucket.sublabel}</div>
                              <div className="text-purple-300 font-numeric">
                                ₹{bucket.revenue.toLocaleString("en-IN")} ({bucket.count} paid)
                              </div>
                            </div>
                          )}

                          {/* Crisp Rectangular Bar */}
                          {bucket.revenue > 0 ? (
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={`w-full max-w-[36px] rounded-none transition-all duration-150 ${
                                isHovered
                                  ? "bg-[#240046] shadow-sm ring-1 ring-[#3C096C]"
                                  : "bg-[#3C096C] hover:bg-[#240046]"
                              }`}
                            />
                          ) : (
                            <div className="w-full max-w-[36px] h-[2px] bg-gray-200 rounded-none group-hover:bg-gray-300 transition-colors" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between px-2 text-[10px] text-body/80 font-medium">
                  {trendBuckets.map((b, i) => (
                    <div
                      key={b.key || i}
                      className="flex-1 text-center truncate px-0.5"
                    >
                      {b.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Graph 2: Course-wise Revenue Distribution (1 Column) */}
        <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-heading flex items-center gap-2">
                <Music className="w-4 h-4 text-[#3C096C]" />
                Course Performance
              </h2>
              <p className="text-[11px] text-body mt-0.5">
                Revenue contribution per syllabus. Click to filter.
              </p>
            </div>

            {selectedCourseId !== "ALL" && (
              <button
                onClick={() => setSelectedCourseId("ALL")}
                className="text-[10px] font-semibold text-accent hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Reset
              </button>
            )}
          </div>

          {/* Course Contribution Bars */}
          <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
            {courseDistribution.length === 0 ? (
              <div className="py-12 text-center text-xs text-body">
                No course transactions recorded in this period.
              </div>
            ) : (
              courseDistribution.map((item) => {
                const isSelected = selectedCourseId === item.courseId;

                return (
                  <div
                    key={item.courseId}
                    onClick={() =>
                      setSelectedCourseId(isSelected ? "ALL" : item.courseId)
                    }
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer active:scale-98 ${
                      isSelected
                        ? "border-[#3C096C] bg-purple-50/50 shadow-2xs"
                        : "border-gray-100 hover:border-gray-200 hover:bg-surface-subtle"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="font-semibold text-heading truncate max-w-[190px]">
                        {item.title}
                      </div>
                      <div className="font-numeric font-bold text-heading">
                        ₹{item.revenue.toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Progress track */}
                    <div className="w-full bg-gray-100 h-2 rounded-none overflow-hidden">
                      <div
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                        className="bg-[#3C096C] h-full rounded-none transition-all duration-300"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-body mt-1.5">
                      <span className="truncate">{item.instrument || "General Music"}</span>
                      <span className="font-semibold text-accent">{item.percentage}% of total</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 5. Payments Transaction Ledger */}
      <div className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden space-y-0">
        {/* Filter & Search Bar Header */}
        <div className="p-4 sm:p-5 border-b border-border-default space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: `All (${timeAndCourseFiltered.length})` },
              { id: "PAID", label: `Paid (${metrics.paidCount})` },
              { id: "CREATED", label: `Pending (${metrics.pendingCount})` },
              { id: "FAILED", label: `Failed (${metrics.failedCount})` },
              { id: "REFUNDED", label: `Refunded (${metrics.refundedCount})` },
            ].map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusTab(tab.id as typeof statusTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    active
                      ? "bg-purple-100 text-[#3C096C]"
                      : "text-body hover:bg-surface-subtle"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box & Sort Toggle */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-body/60" />
              <input
                type="text"
                placeholder="Search student, order or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-border-default bg-surface-subtle/50 hover:bg-surface-subtle focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3C096C]/20 transition-all placeholder:text-body/50"
              />
            </div>

            <button
              onClick={() => {
                if (sortField === "date") {
                  setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
                } else {
                  setSortField("date");
                  setSortOrder("desc");
                }
              }}
              title="Toggle date order"
              className="p-2 rounded-xl border border-border-default hover:bg-surface-subtle text-body hover:text-heading transition-all active:scale-95"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle/70 text-body/80 border-b border-border-default font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course & Discipline</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Gateway Reference</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-body">
                    <div className="max-w-sm mx-auto space-y-2">
                      <CreditCard className="w-8 h-8 text-body/40 mx-auto" />
                      <p className="font-semibold text-heading">No payment records found</p>
                      <p className="text-[11px] text-body/70">
                        Try modifying your search query or selecting a broader time period.
                      </p>
                      <button
                        onClick={() => {
                          setTimeFilter("ALL_TIME");
                          setSelectedCourseId("ALL");
                          setSearchQuery("");
                          setStatusTab("ALL");
                        }}
                        className="mt-2 text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset all filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                displayPayments.map((p) => {
                  const isPaid = p.status === "PAID";
                  const isCreated = p.status === "CREATED";
                  const isFailed = p.status === "FAILED";
                  const isRefunded = p.status === "REFUNDED";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-surface-subtle/50 transition-colors group"
                    >
                      {/* Student */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-purple-100 text-[#3C096C] font-semibold text-[11px] flex items-center justify-center flex-shrink-0">
                            {p.student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-heading">
                              {p.student.name}
                            </div>
                            <div className="text-[11px] text-body/70">
                              {p.student.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Course */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-heading truncate max-w-[220px]">
                          {p.course.title}
                        </div>
                        <div className="text-[10px] text-accent font-semibold flex items-center gap-1.5 mt-0.5">
                          <span>{p.course.instrument || "Instrumental"}</span>
                          {p.course.level && (
                            <>
                              <span className="text-body/40">·</span>
                              <span className="text-body/70">{p.course.level}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-body text-[11px] whitespace-nowrap">
                        {p.createdAtFormatted}
                      </td>

                      {/* Gateway Reference */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-body">
                          <span className={p.customId ? "font-bold text-primary" : ""}>
                            {p.customId || p.gatewayPaymentId || p.gatewayOrderId}
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(
                                p.customId || p.gatewayPaymentId || p.gatewayOrderId,
                                p.id,
                              )
                            }
                            className="p-1 rounded hover:bg-gray-100 text-body/60 hover:text-heading transition-all"
                            title="Copy receipt / transaction ID"
                          >
                            {copiedId === p.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] text-body/60 uppercase">
                          {p.gateway}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-numeric font-bold text-heading whitespace-nowrap">
                        ₹{p.amountRupees.toLocaleString("en-IN")}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : isCreated
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : isFailed
                              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                              : "bg-purple-50 text-purple-700 border border-purple-200/60"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPaid
                                ? "bg-emerald-500"
                                : isCreated
                                ? "bg-amber-500"
                                : isFailed
                                ? "bg-rose-500"
                                : "bg-purple-500"
                            }`}
                          />
                          {p.status}
                        </span>
                      </td>

                      {/* Receipt Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setActiveModalPayment(p)}
                          className="px-2.5 py-1 rounded-lg border border-border-default hover:bg-surface-subtle text-heading text-[11px] font-semibold transition-all active:scale-95 shadow-2xs"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Receipt & Transaction Details Modal */}
      {activeModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-border-default shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-[#3C096C]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-heading">
                    Payment Receipt & Audit Dossier
                  </h3>
                  <p className="text-[11px] text-body">
                    Official Gandharva institutional record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalPayment(null)}
                className="p-1.5 rounded-xl text-body hover:text-heading hover:bg-gray-100 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Amount Hero */}
            <div className="p-4 rounded-xl bg-surface-subtle/80 border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-body">Gross Remittance</span>
                <div className="font-serif text-2xl font-bold text-heading font-numeric">
                  ₹{activeModalPayment.amountRupees.toLocaleString("en-IN")}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  activeModalPayment.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : activeModalPayment.status === "CREATED"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {activeModalPayment.status}
              </span>
            </div>

            {/* Receipt Details Grid */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-body">Student Name</span>
                <span className="font-semibold text-heading">
                  {activeModalPayment.student.name}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-body">Student Email</span>
                <span className="font-mono text-[11px] text-heading">
                  {activeModalPayment.student.email}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-body">Course Enrollment</span>
                <span className="font-semibold text-heading truncate max-w-[240px]">
                  {activeModalPayment.course.title}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-body">Transaction Timestamp</span>
                <span className="text-heading">
                  {activeModalPayment.createdAtFormatted}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-body font-medium">Receipt ID</span>
                <span className="font-mono text-xs font-bold text-primary">
                  {activeModalPayment.customId || activeModalPayment.gatewayPaymentId || "PAYID000001"}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-body">Gateway Order ID</span>
                <span className="font-mono text-[11px] text-heading">
                  {activeModalPayment.gatewayOrderId}
                </span>
              </div>

              {activeModalPayment.gatewayPaymentId && (
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-body">Gateway Payment Ref</span>
                  <span className="font-mono text-[11px] text-heading">
                    {activeModalPayment.gatewayPaymentId}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1.5">
                <span className="text-body">Processor Gateway</span>
                <span className="font-semibold uppercase text-heading">
                  {activeModalPayment.gateway}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  handleCopy(
                    activeModalPayment.gatewayPaymentId || activeModalPayment.gatewayOrderId,
                    activeModalPayment.id,
                  );
                }}
                className="px-3.5 py-2 rounded-xl border border-border-default hover:bg-surface-subtle text-heading text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Ref</span>
              </button>

              <button
                onClick={() => setActiveModalPayment(null)}
                className="px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-purple-900 text-white text-xs font-semibold transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
