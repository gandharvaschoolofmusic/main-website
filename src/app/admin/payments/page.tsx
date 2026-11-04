import { Suspense } from "react";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getResilientData, getLastKnownGood } from "@/lib/db-resilience";
import { formatInViewerTimezone } from "@/lib/timezone";
import {
  OverallPaymentsManager,
  FormattedPaymentItem,
  CourseOption,
} from "./OverallPaymentsManager";

export const metadata = {
  title: "Overall Payments & Revenue Intelligence | Gandharva Admin",
  description:
    "Institutional financial telemetry, course-wise student payments, time-series revenue trends, and transaction ledger.",
};

const getCachedAdminPaymentsData = unstable_cache(
  async (adminTimezone: string) => {
    return getResilientData(`admin-payments-${adminTimezone}`, async () => {
      const [payments, courses] = await Promise.all([
      db.payment.findMany({
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              image: true,
            },
          },
          enrollment: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  instrument: true,
                  level: true,
                  slug: true,
                },
              },
            },
          },
          primaryEnrollment: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  instrument: true,
                  level: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.course.findMany({
        select: {
          id: true,
          title: true,
          instrument: true,
          level: true,
          priceMinorUnits: true,
        },
        orderBy: { title: "asc" },
      }),
    ]);

    // Map courses by price for orphan payment matching
    const courseMapByPrice = new Map<number, (typeof courses)[0]>();
    courses.forEach((c) => {
      courseMapByPrice.set(c.priceMinorUnits, c);
    });

    const formattedPayments: FormattedPaymentItem[] = payments.map((p) => {
      const resolvedCourse =
        p.enrollment?.course ||
        p.primaryEnrollment?.course ||
        courseMapByPrice.get(p.amountMinorUnits) || {
          id: "general-tuition",
          title: "General Music Tuition & Coaching",
          instrument: "Vocal & Instrumental",
          level: "All Levels",
        };

      return {
        id: p.id,
        customId: p.customId || null,
        createdAt: p.createdAt.toISOString(),
        createdAtFormatted: formatInViewerTimezone(
          p.createdAt,
          adminTimezone,
          "MMM d, yyyy 'at' h:mm a",
        ),
        dateKey: formatInViewerTimezone(p.createdAt, adminTimezone, "yyyy-MM-dd"),
        amountMinorUnits: p.amountMinorUnits,
        amountRupees: p.amountMinorUnits / 100,
        currency: p.currency,
        gateway: p.gateway,
        gatewayOrderId: p.gatewayOrderId,
        gatewayPaymentId: p.gatewayPaymentId,
        status: p.status,
        notes: p.notes,
        student: {
          id: p.student.id,
          name: p.student.name || "Student",
          email: p.student.email,
          phone: p.student.phone,
          avatarUrl: p.student.image,
        },
        course: {
          id: resolvedCourse.id,
          title: resolvedCourse.title,
          instrument: resolvedCourse.instrument,
          level: resolvedCourse.level,
        },
      };
    });

    const courseOptions: CourseOption[] = courses.map((c) => ({
      id: c.id,
      title: c.title,
      instrument: c.instrument,
      level: c.level,
      priceMinorUnits: c.priceMinorUnits,
    }));

    return {
      formattedPayments,
      courseOptions,
    };
    });
  },
  ["admin-payments-data-v2"],
  { revalidate: 30, tags: ["admin-payments", "payments"] }
);

export default async function AdminOverallPaymentsPage() {
  const admin = await requireRole(Role.ADMIN);
  const adminTimezone = admin.timezone || "Asia/Kolkata";

  let data = {
    formattedPayments: [] as FormattedPaymentItem[],
    courseOptions: [] as CourseOption[],
  };

  try {
    data = await getCachedAdminPaymentsData(adminTimezone);
  } catch (err) {
    console.error("[AdminOverallPaymentsPage] Failed to load cached payments data, using fallback:", err);
    const fallback = getLastKnownGood<typeof data>(`admin-payments-${adminTimezone}`);
    if (fallback) data = fallback;
  }

  // Safety net: if formattedPayments is empty, check resilient cache for last known good data
  if (!data.formattedPayments || data.formattedPayments.length === 0) {
    const fallback = getLastKnownGood<typeof data>(`admin-payments-${adminTimezone}`);
    if (fallback && fallback.formattedPayments.length > 0) {
      data = fallback;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-body animate-pulse">
          Loading institutional revenue telemetry...
        </div>
      }
    >
      <OverallPaymentsManager
        initialPayments={data.formattedPayments}
        courses={data.courseOptions}
      />
    </Suspense>
  );
}
