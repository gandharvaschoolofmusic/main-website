"use client";

import { useState } from "react";
import {
  CreditCard,
  Receipt,
  Printer,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  X,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export interface StudentPaymentRecord {
  id: string;
  customId?: string | null;
  gatewayPaymentId: string | null;
  gatewayOrderId: string;
  amountMinorUnits: number;
  currency: string;
  status: string;
  createdAt: string;
  courseTitle: string;
  courseSlug: string;
  sessionCount: number;
  instrument: string;
  studentName: string;
  studentEmail?: string | null;
}

export function StudentPaymentsClient({
  payments,
}: {
  payments: StudentPaymentRecord[];
}) {
  const [selectedReceipt, setSelectedReceipt] =
    useState<StudentPaymentRecord | null>(null);

  const handlePrint = () => {
    window.print();
  };

  if (payments.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-border-default rounded-3xl bg-bg-alt/20 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Receipt className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-heading">
            No payment records found
          </h3>
          <p className="text-xs text-body max-w-sm mx-auto">
            You have not made any course purchases yet. Explore our course catalog to find accredited music and dance masterclasses.
          </p>
        </div>
        <Link
          href="/student/dashboard/courses"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs btn-tactile"
        >
          <span>Browse Courses</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transaction List Card */}
      <div className="rounded-3xl border border-border-default bg-white overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-heading">
            <CreditCard className="w-4 h-4 text-primary" />
            <span>Transaction Ledger ({payments.length})</span>
          </div>
          <span className="text-[11px] text-body-muted">
            All prices in INR (all-inclusive)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-subtle bg-bg-alt/40 text-body font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Course / Program</th>
                <th className="py-3.5 px-4">Receipt / Reference</th>
                <th className="py-3.5 px-4 text-right">Amount Paid</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {payments.map((p) => {
                const formattedDate = new Date(p.createdAt).toLocaleDateString(
                  "en-IN",
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                );
                const formattedTime = new Date(p.createdAt).toLocaleTimeString(
                  "en-IN",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                );

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-neutral-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-semibold text-heading">
                        {formattedDate}
                      </p>
                      <p className="text-[11px] text-body-muted">
                        {formattedTime}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <Link
                        href={`/student/dashboard/courses/${p.courseSlug}`}
                        className="font-bold text-heading hover:text-primary transition-colors flex items-center gap-1.5 group"
                      >
                        <span>{p.courseTitle}</span>
                      </Link>
                      <p className="text-[11px] text-body-muted">
                        {p.instrument} • {p.sessionCount} Sessions
                      </p>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="font-bold text-heading">
                        {p.customId || "PAYID000001"}
                      </div>
                      {p.gatewayPaymentId ? (
                        <div className="text-[10px] text-primary font-medium">
                          Ref: {p.gatewayPaymentId}
                        </div>
                      ) : (
                        <div className="text-[10px] text-body-muted">Order: {p.gatewayOrderId}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-serif text-sm font-bold text-emerald-700 whitespace-nowrap">
                      ₹{(p.amountMinorUnits / 100).toLocaleString("en-IN")}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          p.status === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "CREATED"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {p.status === "PAID" ? (
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border-default bg-white hover:bg-neutral-50 text-xs font-semibold text-heading transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          <Receipt className="w-3.5 h-3.5 text-primary" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-body-muted text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Receipt / Tax Invoice Modal Dialog */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in print:p-0 print:bg-white">
          <div className="w-full max-w-lg rounded-3xl border border-border-default bg-white p-6 sm:p-8 shadow-2xl space-y-6 print:border-none print:shadow-none print:max-w-none">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                Payment Verification & Tax Receipt
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-1.5 rounded-xl bg-bg-alt hover:bg-neutral-100 text-body hover:text-heading transition-colors"
                  title="Print or Save as PDF"
                >
                  <Printer className="w-4 h-4 text-heading" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1.5 rounded-xl bg-bg-alt hover:bg-neutral-100 text-body hover:text-heading transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Content */}
            <div className="space-y-6 text-xs text-body">
              {/* Institution Header */}
              <div className="flex justify-between items-start border-b border-border-subtle pb-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-heading">
                    Gandharva School of Music
                  </h2>
                  <p className="text-[11px] text-body-muted mt-0.5">
                    Live 1-to-1 Music & Performing Arts Academy
                  </p>
                  <p className="text-[10px] text-body-muted">
                    GST & Verified Academic Partner
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Paid & Verified
                  </span>
                  <p className="font-mono text-xs font-bold text-primary mt-1">
                    Receipt No: {selectedReceipt.customId || selectedReceipt.gatewayPaymentId || "PAYID000001"}
                  </p>
                </div>
              </div>

              {/* Bill Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-body-muted">
                    Billed To:
                  </span>
                  <p className="font-bold text-heading text-sm mt-0.5">
                    {selectedReceipt.studentName}
                  </p>
                  <p className="text-[11px] text-body">
                    {selectedReceipt.studentEmail}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-body-muted">
                    Payment Date:
                  </span>
                  <p className="font-bold text-heading mt-0.5">
                    {new Date(selectedReceipt.createdAt).toLocaleDateString(
                      "en-IN",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </p>
                  <p className="text-[10px] text-body-muted">
                    Time:{" "}
                    {new Date(selectedReceipt.createdAt).toLocaleTimeString(
                      "en-IN",
                    )}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-2xl border border-border-subtle overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-bg-alt/50 border-b border-border-subtle text-[10px] uppercase font-bold text-body">
                    <tr>
                      <th className="p-3">Course Program Description</th>
                      <th className="p-3 text-right">Sessions</th>
                      <th className="p-3 text-right">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr>
                      <td className="p-3">
                        <p className="font-bold text-heading">
                          {selectedReceipt.courseTitle}
                        </p>
                        <p className="text-[10px] text-body-muted">
                          Discipline: {selectedReceipt.instrument} • Verified
                          Faculty Allotment
                        </p>
                      </td>
                      <td className="p-3 text-right font-numeric font-medium">
                        {selectedReceipt.sessionCount}
                      </td>
                      <td className="p-3 text-right font-serif font-bold text-heading text-sm">
                        ₹
                        {(
                          selectedReceipt.amountMinorUnits / 100
                        ).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total & Payment Gateway Breakdown */}
              <div className="p-4 rounded-2xl bg-bg-alt/30 border border-border-subtle space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-body-muted">Receipt Number:</span>
                  <span className="font-mono font-bold text-heading">
                    {selectedReceipt.customId || selectedReceipt.gatewayPaymentId || "PAYID000001"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-body-muted">Payment Gateway:</span>
                  <span className="font-semibold text-heading">
                    Razorpay Secure Checkout
                  </span>
                </div>
                {selectedReceipt.gatewayPaymentId && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-body-muted">Gateway Payment ID:</span>
                    <span className="font-mono text-primary font-medium">
                      {selectedReceipt.gatewayPaymentId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-body-muted">Gateway Order ID:</span>
                  <span className="font-mono text-body">
                    {selectedReceipt.gatewayOrderId}
                  </span>
                </div>
                <div className="pt-2 border-t border-border-subtle flex justify-between items-center text-sm font-bold text-heading">
                  <span>Total Amount Paid (All Inclusive):</span>
                  <span className="font-serif text-lg text-emerald-700">
                    ₹
                    {(
                      selectedReceipt.amountMinorUnits / 100
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Institutional Footer */}
              <div className="flex items-center justify-between text-[10px] text-body-muted pt-2 border-t border-border-subtle">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    Cryptographically verified transaction • 100% Satisfaction
                    Guarantee
                  </span>
                </div>
                <span>Gandharva School of Music</span>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
