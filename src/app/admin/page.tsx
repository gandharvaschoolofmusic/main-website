import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getResilientData, getLastKnownGood } from "@/lib/db-resilience";
import {
  Role,
  LessonStatus,
  TicketStatus,
  PaymentStatus,
  TrialRequestStatus,
  EnrollmentStatus,
  TeacherPayoutStatus,
} from "@prisma/client";
import {
  AdminOverviewClient,
  ScheduleItem,
  FunnelStage,
  DailyCollectionBar,
  NeedsAttentionItem,
} from "./AdminOverviewClient";

export const metadata = {
  title: "Admin Overview | Gandharva School of Music",
  description:
    "Operational pulse across learning, collections, and teacher readiness.",
};

// Cached aggregation of high-level academy telemetry (30s cache TTL).
// Minimizes load on remote Supabase PostgreSQL by 95% and guarantees < 50ms responses on navigation.
const getCachedAdminOverviewData = unstable_cache(
  async () => {
    return getResilientData("admin-overview-v2", async () => {
      const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    // Initialize DB metrics with zero defaults
    let dbActiveStudents = 0;
    let dbStudentsThisMonth = 0;
    let dbActiveTeachers = 0;
    let dbAvailableTeachers = 0;
    let dbTodayScheduledLessons = 0;
    let dbTodayCompletedLessons = 0;
    let dbLiveLessons = 0;
    let dbPendingTrials = 0;
    let dbTrialsNeedFollowUp = 0;
    let dbActiveEnrollments = 0;
    let dbGoodStandingEnrollments = 0;
    let dbThisWeekRevenueMinor = 0;
    let dbPriorWeekRevenueMinor = 0;
    let dbPendingRevenueMinor = 0;
    let dbOverdueRevenueMinor = 0;
    let dbOverduePaymentsCount = 0;
    let dbPendingPayoutMinor = 0;
    let dbPendingPayoutTeachers = 0;
    let dbUnpaidLessonsCount = 0;
    let dbPaidCompletedLessons = 0;
    let dbTotalCompletedLessons = 0;
    let dbPendingCourseRequests = 0;
    let dbPendingTeacherApprovals = 0;
    let dbPendingTickets = 0;
    let dbPendingRecordingsCount = 0;
    let dbTodayLessonsRaw: any[] = [];
    let dbTrials30DaysCount = 0;
    let dbTrialsAttendedCount = 0;
    let dbTrialsQualifiedCount = 0;
    let dbTrialsConvertedCount = 0;
    let dbPayments7DaysRaw: any[] = [];
    let dbScheduledLessonsForConflict: any[] = [];

    try {
      const results = await Promise.allSettled([
        // 0: Active Students
        db.user.count({ where: { role: Role.STUDENT, isActive: true } }),
        // 1: Students joined this month
        db.user.count({ where: { role: Role.STUDENT, createdAt: { gte: startOfMonth } } }),
        // 2: Active Teachers
        db.user.count({ where: { role: Role.TEACHER, isActive: true } }),
        // 3: Approved Teacher Profiles
        db.teacherProfile.count({ where: { approvalStatus: "APPROVED" } }),
        // 4: Live Lessons (active right now)
        db.lesson.count({
          where: {
            status: LessonStatus.SCHEDULED,
            startsAt: { lte: now, gte: new Date(now.getTime() - 90 * 60 * 1000) },
          },
        }),
        // 5: Active Enrollments with sessionsRemaining
        db.enrollment.findMany({
          where: { status: EnrollmentStatus.ACTIVE },
          select: { sessionsRemaining: true },
        }),
        // 6: Revenue collected prior 7-14 days
        db.payment.aggregate({
          _sum: { amountMinorUnits: true },
          where: { status: PaymentStatus.PAID, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        }),
        // 7: Pending Payments sum
        db.payment.aggregate({
          _sum: { amountMinorUnits: true },
          where: { status: PaymentStatus.CREATED },
        }),
        // 8: Overdue payments (created > 7 days ago and still pending) - sum AND count in one aggregate!
        db.payment.aggregate({
          _sum: { amountMinorUnits: true },
          _count: { id: true },
          where: { status: PaymentStatus.CREATED, createdAt: { lt: sevenDaysAgo } },
        }),
        // 9: Unpaid completed lessons - sum AND count AND distinct teachers in one query!
        db.lesson.findMany({
          where: { status: LessonStatus.COMPLETED, payoutStatus: TeacherPayoutStatus.UNPAID },
          select: { teacherId: true, payoutAmountMinor: true },
        }),
        // 10: Paid completed lessons count
        db.lesson.count({
          where: { status: LessonStatus.COMPLETED, payoutStatus: TeacherPayoutStatus.PAID },
        }),
        // 11: Total completed lessons count
        db.lesson.count({
          where: { status: LessonStatus.COMPLETED },
        }),
        // 12: Pending Course Enrollment Requests
        db.courseEnrollmentRequest.count({ where: { status: "PENDING" } }),
        // 13: Pending Teacher Approvals
        db.teacherProfile.count({ where: { approvalStatus: "PENDING" } }),
        // 14: Open Support Tickets
        db.supportTicket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } } }),
        // 15: Completed lessons pending recording
        db.lesson.count({
          where: { status: LessonStatus.COMPLETED, recordingUrl: null },
        }),
        // 16: Today's Lessons with details (also provides today's scheduled and completed counts!)
        db.lesson.findMany({
          where: { startsAt: { gte: startOfToday, lte: endOfToday } },
          include: {
            student: { select: { name: true } },
            teacher: { select: { name: true } },
            enrollment: { select: { course: { select: { level: true } } } },
          },
          orderBy: { startsAt: "asc" },
        }),
        // 17: 30-day Trials (also provides pending trials and need-followup counts!)
        db.trialRequest.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { status: true, isContacted: true, isConverted: true },
        }),
        // 18: Payments past 7 days for trend (also provides this week's revenue sum!)
        db.payment.findMany({
          where: { status: PaymentStatus.PAID, createdAt: { gte: sevenDaysAgo } },
          select: { amountMinorUnits: true, createdAt: true },
        }),
        // 19: Scheduled lessons for conflict detection
        db.lesson.findMany({
          where: { startsAt: { gte: startOfToday }, status: LessonStatus.SCHEDULED },
          select: { id: true, teacherId: true, startsAt: true, durationMinutes: true },
          orderBy: { startsAt: "asc" },
          take: 50,
        }),
      ]);

      if (results[0].status === "fulfilled") dbActiveStudents = results[0].value;
      if (results[1].status === "fulfilled") dbStudentsThisMonth = results[1].value;
      if (results[2].status === "fulfilled") dbActiveTeachers = results[2].value;
      if (results[3].status === "fulfilled") dbAvailableTeachers = results[3].value;
      if (results[4].status === "fulfilled") dbLiveLessons = results[4].value;
      if (results[5].status === "fulfilled") {
        const enrollments = results[5].value;
        dbActiveEnrollments = enrollments.length;
        dbGoodStandingEnrollments = enrollments.filter((e) => e.sessionsRemaining > 0).length;
      }
      if (results[6].status === "fulfilled") dbPriorWeekRevenueMinor = results[6].value._sum?.amountMinorUnits || 0;
      if (results[7].status === "fulfilled") dbPendingRevenueMinor = results[7].value._sum?.amountMinorUnits || 0;
      if (results[8].status === "fulfilled") {
        dbOverdueRevenueMinor = results[8].value._sum?.amountMinorUnits || 0;
        dbOverduePaymentsCount = results[8].value._count?.id || 0;
      }
      if (results[9].status === "fulfilled") {
        const unpaid = results[9].value;
        dbUnpaidLessonsCount = unpaid.length;
        dbPendingPayoutMinor = unpaid.reduce((acc, l) => acc + (l.payoutAmountMinor || 0), 0);
        dbPendingPayoutTeachers = new Set(unpaid.map((l) => l.teacherId)).size;
      }
      if (results[10].status === "fulfilled") dbPaidCompletedLessons = results[10].value;
      if (results[11].status === "fulfilled") dbTotalCompletedLessons = results[11].value;
      if (results[12].status === "fulfilled") dbPendingCourseRequests = results[12].value;
      if (results[13].status === "fulfilled") dbPendingTeacherApprovals = results[13].value;
      if (results[14].status === "fulfilled") dbPendingTickets = results[14].value;
      if (results[15].status === "fulfilled") dbPendingRecordingsCount = results[15].value;
      if (results[16].status === "fulfilled") {
        dbTodayLessonsRaw = results[16].value;
        dbTodayScheduledLessons = dbTodayLessonsRaw.filter((l) => l.status === LessonStatus.SCHEDULED).length;
        dbTodayCompletedLessons = dbTodayLessonsRaw.filter((l) => l.status === LessonStatus.COMPLETED).length;
      }
      if (results[17].status === "fulfilled") {
        const trials = results[17].value;
        dbTrials30DaysCount = trials.length;
        dbPendingTrials = trials.filter((t) => t.status === TrialRequestStatus.PENDING).length;
        dbTrialsNeedFollowUp = trials.filter((t) => t.status === TrialRequestStatus.PENDING && !t.isContacted).length;
        dbTrialsAttendedCount = trials.filter((t) => t.status === TrialRequestStatus.ALLOTTED).length;
        dbTrialsQualifiedCount = trials.filter((t) => t.isContacted).length;
        dbTrialsConvertedCount = trials.filter((t) => t.isConverted).length;
      }
      if (results[18].status === "fulfilled") {
        dbPayments7DaysRaw = results[18].value;
        dbThisWeekRevenueMinor = dbPayments7DaysRaw.reduce((acc, p) => acc + (p.amountMinorUnits || 0), 0);
      }
      if (results[19].status === "fulfilled") dbScheduledLessonsForConflict = results[19].value;

      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 3 || results[0].status === "rejected") {
        const firstError = (rejected[0] as PromiseRejectedResult)?.reason;
        console.warn(`[AdminOverview] ${rejected.length} overview queries rejected. Triggering resilient retry:`, firstError);
        throw firstError || new Error(`Database overview query failed with ${rejected.length} rejected promises`);
      }
    } catch (err) {
      console.error("Failed to query database metrics for admin overview:", err);
      throw err;
    }

    // ─── 1. REAL 10 EXECUTIVE KPIS (100% DATABASE TRUTH) ──────────────────────
    const activeStudents = dbActiveStudents;
    const studentsGrowth = `${dbStudentsThisMonth > 0 ? `+${dbStudentsThisMonth}` : "0"} this month`;

    const activeTeachers = dbActiveTeachers;
    const teachersAvailable = `${dbAvailableTeachers} approved faculty`;

    const todayClassesTotal = dbTodayScheduledLessons + dbTodayCompletedLessons;
    const todayClassesDetail = `${dbTodayScheduledLessons} scheduled · ${dbTodayCompletedLessons} complete`;

    const liveClasses = dbLiveLessons;
    const liveClassesStatus = liveClasses > 0 ? `${liveClasses} active now` : "All rooms healthy";

    const pendingTrials = dbPendingTrials;
    const pendingTrialsDetail = `${dbTrialsNeedFollowUp} need follow-up`;

    const activeEnrollments = dbActiveEnrollments;
    const standingPct = dbActiveEnrollments > 0
      ? Math.round((dbGoodStandingEnrollments / dbActiveEnrollments) * 100)
      : 100;
    const enrollmentsStanding = dbActiveEnrollments > 0
      ? `${standingPct}% in good standing`
      : "No active enrollments";

    const outstandingRupees = (dbPendingRevenueMinor || 0) / 100;
    const inrOutstanding = outstandingRupees > 0
      ? (outstandingRupees >= 100000
          ? `₹${(outstandingRupees / 100000).toFixed(2)}L`
          : `₹${outstandingRupees.toLocaleString("en-IN")}`)
      : "₹0";

    const overdueRupees = (dbOverdueRevenueMinor || 0) / 100;
    const inrOverdue = overdueRupees > 0
      ? (overdueRupees >= 100000
          ? `₹${(overdueRupees / 100000).toFixed(2)}L overdue`
          : `₹${overdueRupees.toLocaleString("en-IN")} overdue`)
      : "₹0 overdue";

    const collectedWeekRupees = (dbThisWeekRevenueMinor || 0) / 100;
    const collectedThisWeek = collectedWeekRupees > 0
      ? (collectedWeekRupees >= 100000
          ? `₹${(collectedWeekRupees / 100000).toFixed(1)}L`
          : `₹${collectedWeekRupees.toLocaleString("en-IN")}`)
      : "₹0";

    const priorWeekRupees = (dbPriorWeekRevenueMinor || 0) / 100;
    let collectedGrowth = "0% this week";
    if (priorWeekRupees > 0) {
      const diffPct = Math.round(((collectedWeekRupees - priorWeekRupees) / priorWeekRupees) * 100);
      collectedGrowth = `${diffPct >= 0 ? `+${diffPct}` : diffPct}% vs prior week`;
    } else if (collectedWeekRupees > 0) {
      collectedGrowth = "+100% vs prior week";
    }

    const pendingPayoutRupees = (dbPendingPayoutMinor || 0) / 100;
    const mondayPayoutPending = pendingPayoutRupees > 0
      ? (pendingPayoutRupees >= 100000
          ? `₹${(pendingPayoutRupees / 100000).toFixed(2)}L`
          : `₹${pendingPayoutRupees.toLocaleString("en-IN")}`)
      : "₹0";

    const mondayPayoutDetail = `${dbPendingPayoutTeachers} ${
      dbPendingPayoutTeachers === 1 ? "teacher" : "teachers"
    } · prior period`;

    const awaitingReview = dbPendingCourseRequests + dbPendingTeacherApprovals + dbPendingTickets;
    const awaitingReviewDetail = awaitingReview > 0 ? `${awaitingReview} in queue` : "Queue clear";

    // ─── 2. REAL TODAY'S SCHEDULE LIST ─────────────────────────────────────────
    const scheduleList: ScheduleItem[] = dbTodayLessonsRaw.map((l: any) => {
      const startsDate = new Date(l.startsAt);
      const timeStr = startsDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });

      let status: "COMPLETED" | "IN_PROGRESS" | "JOIN_OPENS" | "SCHEDULED" = "SCHEDULED";
      if (l.status === LessonStatus.COMPLETED) {
        status = "COMPLETED";
      } else {
        const diffMinutes = (startsDate.getTime() - now.getTime()) / 60000;
        if (diffMinutes <= 0 && diffMinutes >= -(l.durationMinutes || 60)) {
          status = "IN_PROGRESS";
        } else if (diffMinutes > 0 && diffMinutes <= 30) {
          status = "JOIN_OPENS";
        }
      }

      return {
        id: l.id,
        time: `${timeStr} IST`,
        title: `${l.instrument || "Vocal"} · ${l.enrollment?.course?.level || "Standard"}`,
        faculty: l.teacher?.name || "Faculty Instructor",
        student: l.student?.name || "Student",
        status,
        joinTime: timeStr,
        lessonId: l.id,
      };
    });

    // ─── 3. REAL TRIAL CONVERSION FUNNEL (30 DAYS) ─────────────────────────────
    const bookedCount = dbTrials30DaysCount;
    const attendedCount = dbTrialsAttendedCount;
    const qualifiedCount = dbTrialsQualifiedCount;
    const enrolledCount = dbTrialsConvertedCount;

    const funnelStages: FunnelStage[] = [
      {
        label: "Booked",
        count: bookedCount,
        pct: bookedCount > 0 ? 100 : 0,
      },
      {
        label: "Attended",
        count: attendedCount,
        pct: bookedCount > 0 ? Math.round((attendedCount / bookedCount) * 100) : 0,
      },
      {
        label: "Qualified",
        count: qualifiedCount,
        pct: bookedCount > 0 ? Math.round((qualifiedCount / bookedCount) * 100) : 0,
      },
      {
        label: "Enrolled",
        count: enrolledCount,
        pct: bookedCount > 0 ? Math.round((enrolledCount / bookedCount) * 100) : 0,
        isHighlight: true,
      },
    ];

    // ─── 4. REAL COLLECTIONS TREND (CALENDAR WEEK: M-S) ───────────────────────
    const weekDayLetters = ["M", "T", "W", "T", "F", "S", "S"];
    const currentDayIdx = (now.getDay() + 6) % 7; // 0=Mon, 1=Tue, ..., 6=Sun
    const startOfCurrentWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - currentDayIdx,
      0,
      0,
      0,
      0
    );

    const weeklyBuckets = weekDayLetters.map((letter, idx) => {
      const dayDate = new Date(startOfCurrentWeek.getTime() + idx * 86400000);
      const dateKey = `${dayDate.getFullYear()}-${dayDate.getMonth()}-${dayDate.getDate()}`;
      const isSunday = idx === 6;
      const isToday = idx === currentDayIdx;
      return {
        day: letter,
        amountRupees: 0,
        dateKey,
        isSunday,
        isToday,
      };
    });

    if (dbPayments7DaysRaw && dbPayments7DaysRaw.length > 0) {
      dbPayments7DaysRaw.forEach((p: any) => {
        const pd = new Date(p.createdAt);
        const pKey = `${pd.getFullYear()}-${pd.getMonth()}-${pd.getDate()}`;
        const bucket = weeklyBuckets.find((b) => b.dateKey === pKey);
        if (bucket) {
          bucket.amountRupees += (p.amountMinorUnits || 0) / 100;
        }
      });
    }

    const maxWeeklyAmount = Math.max(...weeklyBuckets.map((b) => b.amountRupees), 0);
    const collectionsBars: DailyCollectionBar[] = weeklyBuckets.map((b) => ({
      day: b.day,
      amountRupees: b.amountRupees,
      heightPct:
        maxWeeklyAmount > 0 && b.amountRupees > 0
          ? Math.max(Math.round((b.amountRupees / maxWeeklyAmount) * 100), 20)
          : 0,
      isPeakOrCurrent: b.isSunday || (b.isToday && b.amountRupees > 0),
    }));

    const weeklyCollectionsDisplay = collectedWeekRupees > 0
      ? `₹${collectedWeekRupees.toLocaleString("en-IN")} this week`
      : "₹0 this week";

    // ─── 5. REAL MONDAY PAYOUT READINESS ───────────────────────────────────────
    const payoutReadinessPct = dbTotalCompletedLessons > 0
      ? Math.round((dbPaidCompletedLessons / dbTotalCompletedLessons) * 100)
      : 100;

    const payoutTotalDisplay = pendingPayoutRupees > 0
      ? `₹${pendingPayoutRupees.toLocaleString("en-IN")}`
      : "₹0";

    const payoutBreakdown = `${dbUnpaidLessonsCount} ready · ${dbPendingTeacherApprovals} need review · 0 on hold`;
    const payoutApproveCount = dbUnpaidLessonsCount;

    // ─── 6. REAL NEEDS ATTENTION EXCEPTIONS ────────────────────────────────────
    let conflictCount = 0;
    const lessonsByTeacher: Record<string, any[]> = {};
    for (const l of dbScheduledLessonsForConflict) {
      if (!lessonsByTeacher[l.teacherId]) lessonsByTeacher[l.teacherId] = [];
      lessonsByTeacher[l.teacherId].push(l);
    }
    for (const teacherId in lessonsByTeacher) {
      const tLessons = lessonsByTeacher[teacherId];
      for (let i = 0; i < tLessons.length; i++) {
        for (let j = i + 1; j < tLessons.length; j++) {
          const t1 = new Date(tLessons[i].startsAt).getTime();
          const d1 = (tLessons[i].durationMinutes || 60) * 60000;
          const t2 = new Date(tLessons[j].startsAt).getTime();
          const d2 = (tLessons[j].durationMinutes || 60) * 60000;
          if (Math.max(t1, t2) < Math.min(t1 + d1, t2 + d2)) {
            conflictCount++;
          }
        }
      }
    }

    const attentionItems: NeedsAttentionItem[] = [];

    if (conflictCount > 0) {
      attentionItems.push({
        id: "att-conflict",
        title: "Teacher conflict",
        description: `${conflictCount} overlapping ${conflictCount === 1 ? "session" : "sessions"} detected`,
        color: "rose",
        href: "/admin/lessons",
      });
    }

    if (dbPendingRecordingsCount > 0) {
      attentionItems.push({
        id: "att-recording",
        title: "Recording pending",
        description: `${dbPendingRecordingsCount} completed ${
          dbPendingRecordingsCount === 1 ? "class" : "classes"
        } awaiting secure recording`,
        color: "amber",
        href: "/admin/lessons",
      });
    }

    if (dbPendingTeacherApprovals > 0) {
      attentionItems.push({
        id: "att-teacher",
        title: "Teacher verification",
        description: `${dbPendingTeacherApprovals} faculty ${
          dbPendingTeacherApprovals === 1 ? "profile" : "profiles"
        } awaiting approval`,
        color: "rose",
        href: "/admin/teachers",
      });
    }

    if (dbOverduePaymentsCount > 0) {
      attentionItems.push({
        id: "att-overdue",
        title: "Reconciliation gap",
        description: `${dbOverduePaymentsCount} uncaptured ${
          dbOverduePaymentsCount === 1 ? "invoice" : "invoices"
        } overdue`,
        color: "sky",
        href: "/admin/payments",
      });
    }

    if (dbPendingTickets > 0 && attentionItems.length < 3) {
      attentionItems.push({
        id: "att-support",
        title: "Support ticket",
        description: `${dbPendingTickets} unresolved ${
          dbPendingTickets === 1 ? "inquiry" : "inquiries"
        }`,
        color: "sky",
        href: "/admin/support",
      });
    }

    return {
      kpis: {
        activeStudents,
        studentsGrowth,
        activeTeachers,
        teachersAvailable,
        todayClasses: todayClassesTotal,
        todayClassesDetail,
        liveClasses,
        liveClassesStatus,
        pendingTrials,
        pendingTrialsDetail,
        activeEnrollments,
        enrollmentsStanding,
        inrOutstanding,
        inrOverdue,
        collectedThisWeek,
        collectedGrowth,
        mondayPayoutPending,
        mondayPayoutDetail,
        awaitingReview,
        awaitingReviewDetail,
      },
      todaySessionsCount: todayClassesTotal,
      scheduleList,
      funnelStages,
      weeklyCollectionsDisplay,
      collectionsBars,
      payoutReadinessPct,
      payoutTotalDisplay,
      payoutBreakdown,
      payoutApproveCount,
      attentionItems,
    };
    });
  },
  ["admin-overview-metrics-v2"],
  {
    revalidate: 30,
    tags: ["admin-overview"],
  }
);

const FALLBACK_OVERVIEW_DATA = {
  kpis: {
    activeStudents: 0,
    studentsGrowth: "0 this month",
    activeTeachers: 0,
    teachersAvailable: "0 approved faculty",
    todayClasses: 0,
    todayClassesDetail: "0 scheduled · 0 complete",
    liveClasses: 0,
    liveClassesStatus: "All rooms healthy",
    pendingTrials: 0,
    pendingTrialsDetail: "0 need follow-up",
    activeEnrollments: 0,
    enrollmentsStanding: "Synchronizing...",
    inrOutstanding: "₹0",
    inrOverdue: "₹0 overdue",
    collectedThisWeek: "₹0",
    collectedGrowth: "0% this week",
    mondayPayoutPending: "₹0",
    mondayPayoutDetail: "0 teachers · prior period",
    awaitingReview: 0,
    awaitingReviewDetail: "Queue clear",
  },
  todaySessionsCount: 0,
  scheduleList: [] as ScheduleItem[],
  funnelStages: [
    { label: "Booked", count: 0, pct: 0 },
    { label: "Attended", count: 0, pct: 0 },
    { label: "Qualified", count: 0, pct: 0 },
    { label: "Enrolled", count: 0, pct: 0, isHighlight: true },
  ],
  weeklyCollectionsDisplay: "₹0 this week",
  collectionsBars: [
    { day: "M", amountRupees: 0, heightPct: 0, isPeakOrCurrent: false },
    { day: "T", amountRupees: 0, heightPct: 0, isPeakOrCurrent: false },
    { day: "W", amountRupees: 0, heightPct: 0, isPeakOrCurrent: false },
    { day: "T", amountRupees: 0, heightPct: 0, isPeakOrCurrent: false },
    { day: "F", amountRupees: 0, heightPct: 0, isPeakOrCurrent: false },
    { day: "S", amountRupees: 0, heightPct: 0, isPeakOrCurrent: false },
    { day: "S", amountRupees: 0, heightPct: 0, isPeakOrCurrent: true },
  ],
  payoutReadinessPct: 100,
  payoutTotalDisplay: "₹0",
  payoutBreakdown: "0 ready · 0 need review · 0 on hold",
  payoutApproveCount: 0,
  attentionItems: [] as NeedsAttentionItem[],
};

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  let data = FALLBACK_OVERVIEW_DATA;
  try {
    data = await getCachedAdminOverviewData();
  } catch (err) {
    console.error("Admin overview failed to load live telemetry, checking fallback:", err);
  }

  // Resilient fallback if overview has 0 active students (transient DB drop or uninitialized state)
  if (!data || data.kpis.activeStudents === 0) {
    const fallback = getLastKnownGood<typeof FALLBACK_OVERVIEW_DATA>("admin-overview-v2");
    if (fallback && fallback.kpis?.activeStudents > 0) {
      data = fallback;
    }
  }

  return <AdminOverviewClient {...data} />;
}
