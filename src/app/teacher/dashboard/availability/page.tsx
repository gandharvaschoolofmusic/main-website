import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { WeeklyScheduleEditor } from "@/components/availability/WeeklyScheduleEditor";
import { AvailabilityExceptionsManager } from "@/app/teacher/availability/AvailabilityExceptionsManager";
import { PublishStatusButton } from "@/components/teacher/PublishStatusButton";
import { SplitHeading } from "@/components/ui/SplitHeading";
import Link from "next/link";
import { Globe, ArrowUpRight } from "lucide-react";

export const metadata = {
  title: "Availability & Schedule | Teacher Studio | Gandharva School of Music",
  description: "Configure weekly teaching hours, holiday blocks, and exception dates.",
};

import { unstable_cache } from "next/cache";

const getCachedTeacherAvailabilityData = unstable_cache(
  async (userId: string) => {
    return db.teacherProfile.findUnique({
      where: { userId },
      include: {
        availabilityRules: true,
        availabilityExceptions: {
          orderBy: { date: "asc" },
        },
      },
    });
  },
  ["teacher-availability-data"],
  { revalidate: 30, tags: ["teacher-availability", "teacher-profile"] }
);

export default async function TeacherDashboardAvailabilityPage() {
  const user = await requireRole(Role.TEACHER);

  let profile: any = null;
  try {
    profile = await getCachedTeacherAvailabilityData(user.id);
  } catch (err) {
    console.error("Failed to load cached teacher availability data:", err);
    profile = await db.teacherProfile.findUnique({
      where: { userId: user.id },
      include: {
        availabilityRules: true,
        availabilityExceptions: {
          orderBy: { date: "asc" },
        },
      },
    });
  }

  const rules =
    profile?.availabilityRules?.map((r: any) => ({
      dayOfWeek: r.dayOfWeek,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    })) || [];

  const exceptions =
    profile?.availabilityExceptions?.map((e: any) => ({
      id: e.id,
      date: new Date(e.date).toISOString().split("T")[0],
      isBlocked: e.isBlocked,
      startMinute: e.startMinute,
      endMinute: e.endMinute,
    })) || [];

  const isPublished = !!profile?.isPublished;
  const hasBio = !!profile?.bio && profile.bio.trim().length >= 20;
  const hasInstruments = (profile?.instruments?.length ?? 0) > 0;
  const hasRate = (profile?.hourlyRate ?? 0) > 0;
  const hasAvailability = rules.length > 0;
  const isApproved = profile?.approvalStatus === "APPROVED";
  const canPublish = hasBio && hasInstruments && hasRate && hasAvailability && isApproved;

  let blockReason: string | undefined;
  if (!isApproved) {
    blockReason =
      profile?.approvalStatus === "REJECTED"
        ? `Application rejected: "${profile.rejectionReason || "Contact administration"}"`
        : "Profile pending administrative review";
  } else if (!hasBio) blockReason = "Add a bio (at least 20 chars)";
  else if (!hasInstruments) blockReason = "Select at least 1 instrument";
  else if (!hasRate) blockReason = "Set an hourly rate in your profile";
  else if (!hasAvailability) blockReason = "Add at least one available time window";

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
          Working Hours
        </span>
        <SplitHeading
          firstClause="Availability & Studio"
          accentClause="Working Hours"
          as="h1"
          size="lg"
        />
        <p className="text-xs text-body mt-1 max-w-2xl">
          Define recurring weekly availability in your local timezone ({user.timezone || "UTC"}) and manage holiday blocks.
        </p>
      </div>

      {/* Live Publishing Status Banner */}
      <div
        className={`rounded-2xl border p-5 shadow-xs transition-all ${
          isPublished
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-amber-200 bg-amber-50/70"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isPublished
                    ? "bg-emerald-500 shadow-xs shadow-emerald-400 animate-pulse"
                    : "bg-amber-500"
                }`}
              />
              <h2
                className={`text-sm sm:text-base font-bold ${
                  isPublished ? "text-emerald-900" : "text-amber-900"
                }`}
              >
                {isPublished
                  ? "Studio Status: Published & Live to Students"
                  : "Studio Status: Unpublished Draft"}
              </h2>
            </div>
            <p className="text-xs text-body leading-relaxed max-w-xl">
              {isPublished
                ? "Students can discover your teacher profile and book free trials or enrolled course lessons based on these hours."
                : "Your studio profile is currently hidden from student booking. Configure your weekly hours below to activate."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profile && isPublished && (
              <Link
                href={`/teachers/${profile.id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/50 shadow-xs transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>Preview Public Page</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <PublishStatusButton
              initialPublished={isPublished}
              canPublish={canPublish}
              blockReason={blockReason}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Section 1: Weekly Recurring Schedule */}
      <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-6">
          <h2 className="font-serif text-xl font-bold text-heading">
            Weekly Recurring Schedule
          </h2>
          <p className="mt-1 text-xs text-body">
            Lessons are generated within these hours in your local timezone ({user.timezone || "UTC"}).
          </p>
        </div>

        <WeeklyScheduleEditor
          initialRules={rules}
          timezone={user.timezone || "UTC"}
        />
      </div>

      {/* Section 2: Date Exceptions & Time Off */}
      <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-6">
          <h2 className="font-serif text-xl font-bold text-heading">
            Date Exceptions & Time Off
          </h2>
          <p className="mt-1 text-xs text-body">
            Block specific dates for holidays or define custom one-off hours on particular dates.
          </p>
        </div>

        <AvailabilityExceptionsManager
          initialExceptions={exceptions}
        />
      </div>
    </div>
  );
}
