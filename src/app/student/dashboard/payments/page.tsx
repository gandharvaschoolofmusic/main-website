import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { SplitHeading } from "@/components/ui/SplitHeading";
import {
  StudentPaymentsClient,
  StudentPaymentRecord,
} from "./StudentPaymentsClient";
import { CreditCard, CheckCircle2, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Billing & Payment Receipts | Student Portal | Gandharva School of Music",
  description:
    "View your course payment history, transaction references, and download official tax receipts.",
};

import { unstable_cache } from "next/cache";

const getCachedStudentPaymentsData = unstable_cache(
  async (userId: string) => {
    return Promise.all([
      db.payment.findMany({
        where: { studentId: userId },
        include: {
          enrollment: {
            include: {
              course: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.course.findMany({
        select: {
          priceMinorUnits: true,
          title: true,
          slug: true,
          sessionCount: true,
          instrument: true,
        },
      }),
    ]);
  },
  ["student-payments-data"],
  { revalidate: 30, tags: ["student-payments"] }
);

export default async function StudentPaymentsPage() {
  const user = await requireRole(Role.STUDENT);

  // Parallelize payments and course lookup queries (cached 30s)
  let payments: any[] = [];
  let allCourses: any[] = [];

  try {
    [payments, allCourses] = await getCachedStudentPaymentsData(user.id);
  } catch (err) {
    console.error("Failed to load cached student payments data:", err);
    [payments, allCourses] = await Promise.all([
      db.payment.findMany({
        where: { studentId: user.id },
        include: {
          enrollment: {
            include: {
              course: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.course.findMany({
        select: {
          priceMinorUnits: true,
          title: true,
          slug: true,
          sessionCount: true,
          instrument: true,
        },
      }),
    ]);
  }

  const courseMapByPrice = new Map<number, (typeof allCourses)[0]>();
  for (const c of allCourses) {
    courseMapByPrice.set(c.priceMinorUnits, c);
  }

  const formattedPayments: StudentPaymentRecord[] = payments.map((p: any) => {
    const course =
      p.enrollment?.course || courseMapByPrice.get(p.amountMinorUnits);

    return {
      id: p.id,
      customId: p.customId || null,
      gatewayPaymentId: p.gatewayPaymentId,
      gatewayOrderId: p.gatewayOrderId,
      amountMinorUnits: p.amountMinorUnits,
      currency: p.currency,
      status: p.status,
      createdAt: new Date(p.createdAt).toISOString(),
      courseTitle: course?.title || "Gandharva Music Masterclass",
      courseSlug: course?.slug || "",
      sessionCount: course?.sessionCount || 4,
      instrument: course?.instrument || "Music Course",
      studentName: user.name || "Student",
      studentEmail: user.email || "",
    };
  });

  const paidTransactions = formattedPayments.filter((p) => p.status === "PAID");
  const totalSpentMinorUnits = paidTransactions.reduce(
    (acc, cur) => acc + cur.amountMinorUnits,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
          Student Financial Records
        </span>
        <SplitHeading
          firstClause="Billing &"
          accentClause="Payment Receipts"
          as="h1"
          size="lg"
        />
        <p className="text-xs text-body mt-1 max-w-2xl">
          Track all your Razorpay course purchases, inspect cryptographic payment confirmations, and download official tuition receipts.
        </p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-border-default shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-body-muted">
            <CreditCard className="w-4 h-4 text-primary" /> Total Tuition Paid
          </div>
          <div className="font-serif text-2xl font-bold text-emerald-700">
            ₹{(totalSpentMinorUnits / 100).toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-body-muted">Across all enrollments</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-border-default shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-body-muted">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Successful Payments
          </div>
          <div className="font-serif text-2xl font-bold text-heading">
            {paidTransactions.length}
          </div>
          <p className="text-[11px] text-body-muted">Verified transactions</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-border-default shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-body-muted">
            <ShieldCheck className="w-4 h-4 text-accent" /> Gateway Security
          </div>
          <div className="text-xs font-bold text-heading">
            Razorpay 256-bit SSL
          </div>
          <p className="text-[11px] text-body-muted">PCI-DSS Level 1 Compliant</p>
        </div>
      </div>

      {/* Main Client Table & Receipt Manager */}
      <StudentPaymentsClient payments={formattedPayments} />
    </div>
  );
}
