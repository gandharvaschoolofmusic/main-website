"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe,
  Search,
  Bell,
  Sparkles,
  Plus,
  Users,
  GraduationCap,
  Calendar,
  Radio,
  BookOpen,
  IndianRupee,
  TrendingUp,
  Wallet,
  FileCheck,
  ArrowUpRight,
  UserPlus,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Music,
} from "lucide-react";

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  faculty: string;
  student: string;
  status: "CANCELLED" | "COMPLETED" | "IN_PROGRESS" | "JOIN_OPENS" | "SCHEDULED";
  joinTime?: string;
  lessonId?: string;
}

export interface FunnelStage {
  label: string;
  count: number;
  pct: number;
  isHighlight?: boolean;
}

export interface DailyCollectionBar {
  day: string;
  amountRupees: number;
  heightPct: number;
  isPeakOrCurrent: boolean;
}

export interface NeedsAttentionItem {
  id: string;
  title: string;
  description: string;
  color: "rose" | "amber" | "sky";
  href: string;
}

export interface AdminOverviewClientProps {
  // Top 10 KPIs
  kpis: {
    activeStudents: number;
    studentsGrowth: string;
    activeTeachers: number;
    teachersAvailable: string;
    todayClasses: number;
    todayClassesDetail: string;
    liveClasses: number;
    liveClassesStatus: string;
    pendingTrials: number;
    pendingTrialsDetail: string;
    activeEnrollments: number;
    enrollmentsStanding: string;
    inrOutstanding: string;
    inrOverdue: string;
    collectedThisWeek: string;
    collectedGrowth: string;
    mondayPayoutPending: string;
    mondayPayoutDetail: string;
    awaitingReview: number;
    awaitingReviewDetail: string;
  };

  // Today's schedule
  todaySessionsCount: number;
  scheduleList: ScheduleItem[];

  // Trial conversion funnel
  funnelStages: FunnelStage[];

  // Collections trend
  weeklyCollectionsDisplay: string;
  collectionsBars: DailyCollectionBar[];

  // Monday payout readiness
  payoutReadinessPct: number;
  payoutTotalDisplay: string;
  payoutBreakdown: string;
  payoutApproveCount: number;

  // Needs attention
  attentionItems: NeedsAttentionItem[];
}

export function AdminOverviewClient({
  kpis,
  todaySessionsCount,
  scheduleList,
  funnelStages,
  weeklyCollectionsDisplay,
  collectionsBars,
  payoutReadinessPct,
  payoutTotalDisplay,
  payoutBreakdown,
  payoutApproveCount,
  attentionItems,
}: AdminOverviewClientProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Formatted IST Date for top pill
  const formattedIstDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  // SVG Radial circle calculation for Payout Readiness (radius = 30)
  const circleRadius = 30;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset =
    circumference - (payoutReadinessPct / 100) * circumference;

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
          <span className="font-bold text-heading">Admin overview</span>
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
            Admin overview
          </h1>
          <p className="text-xs sm:text-sm text-body/70 mt-1">
            Operational pulse across learning, collections, and teacher readiness
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* + New trial button */}
          <Link
            href="/admin/trials"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-purple-50/50 border border-purple-200/90 text-[#3C096C] text-xs font-bold transition-all shadow-2xs active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#3C096C]" />
            <span>New trial</span>
          </Link>

          {/* + Create enrollment button */}
          <Link
            href="/admin/enrollments"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3C096C] hover:bg-[#2F0755] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Create enrollment</span>
          </Link>
        </div>
      </div>

      {/* ─── 3. TEN EXECUTIVE KPI CARDS (2 ROWS OF 5) ───────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: Active students */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Active students</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.activeStudents.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] font-semibold text-purple-700 mt-1">
            {kpis.studentsGrowth}
          </div>
        </div>

        {/* Card 2: Active teachers */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Active teachers</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.activeTeachers}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            {kpis.teachersAvailable}
          </div>
        </div>

        {/* Card 3: Today's classes */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Today&apos;s classes</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.todayClasses}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            {kpis.todayClassesDetail}
          </div>
        </div>

        {/* Card 4: Live classes */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Live classes</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.liveClasses}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {kpis.liveClassesStatus}
          </div>
        </div>

        {/* Card 5: Pending trials */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Pending trials</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.pendingTrials}
          </div>
          <div className="text-[11px] font-semibold text-amber-700 mt-1">
            {kpis.pendingTrialsDetail}
          </div>
        </div>

        {/* Card 6: Active enrollments */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Active enrollments</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.activeEnrollments.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] font-semibold text-purple-700 mt-1">
            {kpis.enrollmentsStanding}
          </div>
        </div>

        {/* Card 7: INR outstanding */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">INR outstanding</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.inrOutstanding}
          </div>
          <div className="text-[11px] font-semibold text-rose-600 mt-1">
            {kpis.inrOverdue}
          </div>
        </div>

        {/* Card 8: Collected this week */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Collected this week</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.collectedThisWeek}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {kpis.collectedGrowth}
          </div>
        </div>

        {/* Card 9: Monday payout pending */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Monday payout pending</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.mondayPayoutPending}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            {kpis.mondayPayoutDetail}
          </div>
        </div>

        {/* Card 10: Awaiting review */}
        <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-body font-medium">Awaiting review</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-heading mt-2 font-numeric">
            {kpis.awaitingReview}
          </div>
          <div className="text-[11px] text-body/70 font-medium mt-1">
            {kpis.awaitingReviewDetail}
          </div>
        </div>
      </div>

      {/* ─── 4. MIDDLE SECTION: TODAY'S SCHEDULE + CONVERSION + COLLECTIONS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left (7 cols): Today's Schedule */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
            <div>
              <h2 className="font-serif text-lg font-bold text-heading">
                Today&apos;s schedule
              </h2>
              <p className="text-xs text-body/70 mt-0.5">
                Timezone-aware session instances · IST
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-50 text-[#3C096C] border border-purple-200 text-xs font-bold">
              {todaySessionsCount} sessions
            </span>
          </div>

          {/* Schedule list */}
          {scheduleList.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mb-2.5">
                <Calendar className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-heading">No sessions scheduled for today</p>
              <p className="text-[11px] text-body/60 mt-0.5 max-w-sm">
                All upcoming classes and trial sessions will appear here as they are scheduled.
              </p>
              <Link
                href="/admin/lessons"
                className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 text-xs font-semibold text-[#3C096C] hover:bg-purple-50 transition-colors"
              >
                <span>View all lessons</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3.5 divide-y divide-neutral-100/90">
              {scheduleList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="font-mono text-xs font-bold text-heading pt-0.5 shrink-0">
                      <div>{item.time.split(" ")[0]}</div>
                      <div className="text-[10px] text-body/50 font-sans font-normal">
                        IST
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-heading text-xs sm:text-sm group-hover:text-[#3C096C] transition-colors">
                        {item.title}
                      </div>
                      <div className="text-xs text-body/70 mt-0.5">
                        {item.faculty} · {item.student}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {item.status === "COMPLETED" && (
                      <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-body/80 border border-neutral-200 text-[11px] font-medium">
                        Completed
                      </span>
                    )}
                    {item.status === "IN_PROGRESS" && (
                      <>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          In progress
                        </span>
                      </>
                    )}
                    {item.status === "JOIN_OPENS" && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                        {item.joinTime ? `Join opens ${item.joinTime}` : "Join opens soon"}
                      </span>
                    )}
                    {item.status === "SCHEDULED" && (
                      <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-body/80 border border-neutral-200 text-[11px] font-medium">
                        Scheduled
                      </span>
                    )}
                    {item.status === "CANCELLED" && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
                        Cancelled
                      </span>
                    )}
                    {item.lessonId && ["SCHEDULED", "JOIN_OPENS", "IN_PROGRESS"].includes(item.status) && (
                      <Link
                        href={`/lesson/${item.lessonId}`}
                        className="px-3 py-1 rounded-xl border border-purple-200/90 hover:bg-purple-50 text-[#3C096C] text-xs font-bold transition-all active:scale-95 shadow-2xs"
                      >
                        Monitor
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (5 cols): Trial conversion + Collections trend */}
        <div className="lg:col-span-5 flex flex-col gap-5 sm:gap-6">
          {/* Card: Trial conversion */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-heading">
                Trial conversion
              </h2>
              <p className="text-xs text-body/70 mt-0.5">Last 30 days</p>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {funnelStages.map((stage) => (
                <div
                  key={stage.label}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    stage.isHighlight
                      ? "bg-purple-50/80 border-purple-200 text-purple-950"
                      : "bg-neutral-50/70 border-neutral-200/70 text-heading"
                  }`}
                >
                  <div className="text-[11px] font-medium text-body/70 truncate">
                    {stage.label}
                  </div>
                  <div className="font-serif text-lg sm:text-xl font-bold font-numeric mt-1">
                    {stage.count}
                  </div>
                  <div
                    className={`text-[11px] font-bold mt-0.5 ${
                      stage.isHighlight ? "text-[#3C096C]" : "text-body/60"
                    }`}
                  >
                    {stage.pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Collections trend */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-heading">
                  Collections trend
                </h2>
                <p className="text-xs text-body/70 mt-0.5">
                  Successful student payments · INR
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                {weeklyCollectionsDisplay}
              </span>
            </div>

            {/* 7-Day Bar Chart */}
            <div className="pt-2">
              <div className="flex items-end justify-between gap-2 sm:gap-3 h-28 sm:h-32 px-1 border-b border-neutral-100 pb-1.5">
                {collectionsBars.map((bar, i) => (
                  <div
                    key={`${bar.day}-${i}`}
                    tabIndex={0}
                    aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]}: ₹${bar.amountRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    className="relative flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer focus-visible:outline-primary"
                  >
                    <span role="tooltip" className={`pointer-events-none absolute bottom-full mb-2 z-20 whitespace-nowrap rounded-lg bg-heading px-3 py-2 text-xs text-white shadow-lg opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity ${i === 0 ? "left-0" : i === collectionsBars.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]} · ₹{bar.amountRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div
                      style={{
                        height:
                          bar.amountRupees > 0
                            ? `${Math.max(bar.heightPct, 15)}%`
                            : "4px",
                      }}
                      className={`w-full max-w-[34px] sm:max-w-[42px] transition-all group-hover:opacity-90 ${
                        bar.amountRupees > 0
                          ? bar.isPeakOrCurrent
                            ? "bg-[#F2A93B] rounded-t-[3px] shadow-2xs"
                            : "bg-[#3C096C] rounded-t-[3px] shadow-2xs"
                          : "bg-purple-100/90 rounded-[1px] hover:bg-purple-200"
                      }`}
                    />
                    <span className="text-[11px] font-medium text-body/70 mt-0.5">
                      {bar.day}
                    </span>
                  </div>
                ))}
              </div>
              {collectionsBars.every((b) => b.amountRupees === 0) && (
                <p className="text-[11px] text-body/50 text-center pt-2.5">
                  No fee collections recorded for this cycle yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. BOTTOM SECTION: 3 EQUAL CARDS ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Card 1: Monday payout readiness */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">
              Monday payout readiness
            </h2>
            <p className="text-xs text-body/70 mt-0.5">
              Prior eligible period · 28 Sep–04 Oct
            </p>

            <div className="flex items-center gap-4 mt-4">
              {/* Radial Progress Ring */}
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r={circleRadius}
                    className="text-purple-100"
                    strokeWidth="6"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={circleRadius}
                    className="text-[#3C096C]"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute font-serif text-sm font-bold text-[#3C096C] font-numeric">
                  {payoutReadinessPct}%
                </span>
              </div>

              {/* Amount and Subtext */}
              <div className="space-y-1">
                <div className="font-serif text-xl sm:text-2xl font-bold text-heading font-numeric">
                  {payoutTotalDisplay}
                </div>
                <div className="text-xs text-body/70 leading-relaxed">
                  {payoutBreakdown}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    showNotification(
                      `Approved ${payoutApproveCount} teacher payouts for disbursement.`
                    )
                  }
                  className="mt-2 inline-flex items-center px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-xs transition-all active:scale-95 shadow-2xs"
                >
                  Approve {payoutApproveCount} payouts
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Needs attention */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">
              Needs attention
            </h2>
            <p className="text-xs text-body/70 mt-0.5">
              Exceptions across the traceable learning chain
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {attentionItems.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100/80 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-emerald-950 font-bold">
                    All systems operational
                  </p>
                  <p className="text-[11px] text-emerald-800/80 mt-0.5">
                    No pending requests, teacher verifications, conflicts, or reconciliation gaps detected.
                  </p>
                </div>
              </div>
            ) : (
              attentionItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start justify-between gap-3 p-2.5 rounded-xl hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                        item.color === "rose"
                          ? "bg-rose-500"
                          : item.color === "amber"
                          ? "bg-amber-500"
                          : "bg-sky-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-heading group-hover:text-[#3C096C] transition-colors truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-body/70 mt-0.5 line-clamp-1">
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-body/40 group-hover:text-heading shrink-0 mt-0.5 transition-colors" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Card 3: Quick actions */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">
              Quick actions
            </h2>
            <p className="text-xs text-body/70 mt-0.5">
              Common operational shortcuts
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <Link
              href="/admin/courses"
              className="p-2.5 rounded-xl bg-purple-50/50 hover:bg-purple-100/70 border border-purple-100 text-heading text-xs font-semibold flex items-center justify-between transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <Music className="w-4 h-4 text-[#3C096C]" />
                <span>Course Catalog (16 Disciplines)</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-body/40 group-hover:text-heading" />
            </Link>

            <Link
              href="/admin/trials"
              className="p-2.5 rounded-xl bg-purple-50/50 hover:bg-purple-100/70 border border-purple-100 text-heading text-xs font-semibold flex items-center justify-between transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-[#3C096C]" />
                <span>Convert trial</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-body/40 group-hover:text-heading" />
            </Link>

            <Link
              href="/admin/payments"
              className="p-2.5 rounded-xl bg-purple-50/50 hover:bg-purple-100/70 border border-purple-100 text-heading text-xs font-semibold flex items-center justify-between transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-[#3C096C]" />
                <span>Record payment</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-body/40 group-hover:text-heading" />
            </Link>

            <Link
              href="/admin/lessons"
              className="p-2.5 rounded-xl bg-purple-50/50 hover:bg-purple-100/70 border border-purple-100 text-heading text-xs font-semibold flex items-center justify-between transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-[#3C096C]" />
                <span>Open live monitor</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-body/40 group-hover:text-heading" />
            </Link>

            <Link
              href="/admin/resources"
              className="p-2.5 rounded-xl bg-purple-50/50 hover:bg-purple-100/70 border border-purple-100 text-heading text-xs font-semibold flex items-center justify-between transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#3C096C]" />
                <span>Learning resources</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-body/40 group-hover:text-heading" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
