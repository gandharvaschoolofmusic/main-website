"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  TrendingUp,
  CreditCard,
  Copy,
  Check,
  ExternalLink,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { SplitHeading } from "@/components/ui/SplitHeading";

export interface TeacherPayoutItem {
  id: string;
  trackingCode: string;
  dateFormatted: string;
  studentName: string;
  studentEmail?: string;
  courseOrTrial: string;
  lessonSource: string | null;
  duration: string;
  amountRupees: number;
  payoutStatus: "PAID" | "UNPAID";
  payoutPaidAtFormatted?: string | null;
  payoutTransactionId?: string | null;
  payoutNotes?: string | null;
  lessonStatus: string;
}

export function TeacherPaymentManager({
  initialItems,
  payoutPerSessionRupees,
  teacherUpiId,
}: {
  initialItems: TeacherPayoutItem[];
  payoutPerSessionRupees: number;
  teacherUpiId?: string | null;
}) {
  const [items] = useState<TeacherPayoutItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered rows
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      // Status filter
      if (statusFilter !== "ALL" && item.payoutStatus !== statusFilter) {
        return false;
      }
      // Search query (Session ID, student name, course, transaction ID)
      if (q) {
        const matchesTracking = item.trackingCode.toLowerCase().includes(q);
        const matchesStudent = item.studentName.toLowerCase().includes(q);
        const matchesCourse = item.courseOrTrial.toLowerCase().includes(q);
        const matchesRef = item.payoutTransactionId?.toLowerCase().includes(q) || false;
        return matchesTracking || matchesStudent || matchesCourse || matchesRef;
      }
      return true;
    });
  }, [items, searchQuery, statusFilter]);

  // Aggregate metrics
  const totalPaidOut = useMemo(() => {
    return items
      .filter((i) => i.payoutStatus === "PAID")
      .reduce((sum, i) => sum + i.amountRupees, 0);
  }, [items]);

  const totalPendingPayout = useMemo(() => {
    return items
      .filter((i) => i.payoutStatus === "UNPAID" && i.lessonStatus !== "CANCELLED")
      .reduce((sum, i) => sum + i.amountRupees, 0);
  }, [items]);

  const paidCount = items.filter((i) => i.payoutStatus === "PAID").length;
  const unpaidCount = items.filter((i) => i.payoutStatus === "UNPAID" && i.lessonStatus !== "CANCELLED").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
          Faculty Studio • Financial Ledger
        </span>
        <SplitHeading
          firstClause="Payment"
          accentClause="Management"
          as="h1"
          size="lg"
        />
        <p className="text-xs text-body mt-1 max-w-2xl">
          Track session payout status in real-time. Search any session by its unique Lesson ID to confirm institutional disbursement coordinates.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Disbursed */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Total Disbursed (Paid)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-emerald-700 font-numeric">
            ₹{totalPaidOut.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-body">
            {paidCount} session{paidCount === 1 ? "" : "s"} marked as paid
          </p>
        </div>

        {/* Card 2: Pending Payout */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Awaiting Payout</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-amber-700 font-numeric">
            ₹{totalPendingPayout.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-body">
            {unpaidCount} session{unpaidCount === 1 ? "" : "s"} pending disbursement
          </p>
        </div>

        {/* Card 3: Session Rate */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Institutional Rate</span>
            <div className="w-8 h-8 rounded-xl bg-accent-subtle flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4 text-accent-dark" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-heading font-numeric">
            ₹{payoutPerSessionRupees.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-body">Fixed flat rate per 60m session</p>
        </div>

        {/* Card 4: Total Sessions */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-body">
            <span className="text-xs font-semibold">Total Sessions</span>
            <div className="w-8 h-8 rounded-xl bg-primary-subtle flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="font-serif text-2xl md:text-3xl font-bold text-primary font-numeric">
            {items.length}
          </p>
          <p className="text-[11px] text-body">All-time delivered & scheduled</p>
        </div>
      </div>

      {/* Payout Coordinates Account Strip */}
      <div className="rounded-2xl border border-border-default bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-subtle flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-accent-dark" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-heading">Institutional Remuneration Coordinates</h3>
              {teacherUpiId ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Verified UPI Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  UPI ID Not Configured
                </span>
              )}
            </div>
            <p className="text-[11px] text-body mt-0.5">
              {teacherUpiId ? (
                <>
                  UPI ID: <span className="font-mono font-bold text-heading">{teacherUpiId}</span>
                </>
              ) : (
                "Please configure your UPI ID in Faculty Profile to receive automated session disbursements."
              )}
            </p>
          </div>
        </div>

        <Link
          href="/teacher/dashboard/profile"
          className="px-4 py-2 rounded-xl border border-border-default bg-neutral-50 hover:bg-neutral-100 text-xs font-bold text-heading transition-all shadow-xs self-start sm:self-auto shrink-0 active:scale-[0.98]"
        >
          {teacherUpiId ? "Edit Payout Details" : "Setup Payout Details →"}
        </Link>
      </div>

      {/* Main Table Card with Search & Filters */}
      <div className="rounded-2xl border border-border-default bg-white overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border-default/60">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">
              Session Payout Ledger
            </h2>
            <p className="text-xs text-body">
              Search by unique Session ID to verify payment status and institutional bank reference.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
                All ({items.length})
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
                Pending ({unpaidCount})
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
            placeholder="Search by Session ID (e.g. S0001-SE001), student name, course, or UTR ref..."
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
          <table className="w-full text-left text-xs text-body border-collapse min-w-[700px]">
            <thead className="bg-bg-alt/30 border-y border-border-default text-[11px] font-bold text-heading uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Session ID</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Student & Subject</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Remuneration</th>
                <th className="py-3 px-5 text-right">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-body text-xs">
                    {searchQuery
                      ? `No sessions found matching "${searchQuery}".`
                      : "No sessions recorded in this category."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isPaid = item.payoutStatus === "PAID";
                  const isCancelled = item.lessonStatus === "CANCELLED";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-neutral-50/70 transition-colors group"
                    >
                      {/* Session ID */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-heading bg-neutral-100 group-hover:bg-white px-2 py-0.5 rounded border border-border-default shadow-2xs">
                            {item.trackingCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.trackingCode, item.id)}
                            className="p-1 rounded text-body/50 hover:text-heading hover:bg-neutral-100 transition-colors cursor-pointer"
                            title="Copy Session ID"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-numeric text-heading">
                        <div>{item.dateFormatted}</div>
                        <span className="text-[10px] text-body/70 capitalize">
                          {item.lessonStatus.toLowerCase()}
                        </span>
                      </td>

                      {/* Student & Subject */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-heading">{item.studentName}</p>
                        <p className="text-[11px] text-body/70">{item.courseOrTrial}</p>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 font-numeric text-heading">
                        {item.duration}
                      </td>

                      {/* Remuneration */}
                      <td className="py-3.5 px-4 text-right font-numeric font-bold text-heading">
                        ₹{item.amountRupees.toLocaleString("en-IN")}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-5 text-right">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                            Cancelled
                          </span>
                        ) : isPaid ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              PAID
                            </span>
                            {item.payoutTransactionId && (
                              <span
                                className="text-[10px] font-mono text-emerald-700 bg-emerald-50/50 px-1.5 py-0.2 rounded border border-emerald-200/50"
                                title={`Bank Ref: ${item.payoutTransactionId}`}
                              >
                                Ref: {item.payoutTransactionId}
                              </span>
                            )}
                            {item.payoutPaidAtFormatted && (
                              <span className="text-[9px] text-body/60 font-numeric">
                                {item.payoutPaidAtFormatted}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                              <Clock className="w-3 h-3 text-amber-600" />
                              UNPAID
                            </span>
                            <span className="text-[9px] text-body/60">
                              Awaiting Disbursement
                            </span>
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
  );
}
