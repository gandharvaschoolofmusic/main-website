import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { WeeklyScheduleEditor } from "@/components/availability/WeeklyScheduleEditor";
import { AvailabilityExceptionsManager } from "./AvailabilityExceptionsManager";
import { PublishStatusButton } from "@/components/teacher/PublishStatusButton";
import { SplitHeading } from "@/components/ui/SplitHeading";
import Link from "next/link";
import { Globe, ArrowUpRight, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeacherAvailabilityPage() {
  const user = await requireRole(Role.TEACHER);

  let profile = await db.teacherProfile.findUnique({
    where: { userId: user.id },
    include: {
      availabilityRules: true,
      availabilityExceptions: {
        orderBy: { date: "asc" },
      },
    },
  });

  if (!profile) {
    try {
      profile = await db.teacherProfile.create({
        data: {
          userId: user.id,
          bio: "",
          instruments: [],
          expertInstruments: [],
          moderateInstruments: [],
          yearsTeaching: 0,
          hourlyRate: 50000,
          payoutPerSession: 50000,
          currency: "INR",
          languages: ["English"],
          isPublished: false,
          approvalStatus: "PENDING",
        },
        include: {
          availabilityRules: true,
          availabilityExceptions: true,
        },
      });
    } catch (createErr) {
      console.warn("Failed to auto-create missing teacherProfile in TeacherAvailabilityPage:", createErr);
    }
  }

  const rules =
    profile?.availabilityRules?.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    })) || [];

  const exceptions =
    profile?.availabilityExceptions?.map((e) => ({
      id: e.id,
      date: e.date.toISOString().split("T")[0],
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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent font-sans">
            Schedule Settings
          </span>
          <SplitHeading
            firstClause="Availability &"
            accentClause="Working Hours"
            as="h1"
            size="xl"
          />
          <p className="mt-1 text-sm text-body">
            Define your recurring weekly hours and manage specific holiday or block exceptions.
          </p>
        </div>

        <Link
          href="/teacher/dashboard"
          className="self-start inline-flex items-center gap-2 rounded-xl border border-border-default bg-white px-4 py-2 text-xs font-semibold text-body hover:text-heading hover:bg-neutral-50 shadow-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Studio
        </Link>
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
                  ? "Studio Status: Published & Live"
                  : "Studio Status: Unpublished Draft"}
              </h2>
            </div>
            <p className="text-xs text-body leading-relaxed max-w-xl">
              {isPublished
                ? "Students can discover your profile in the teacher directory and book lessons based on these recurring hours."
                : "Your profile is hidden from student searches. When you save your availability schedule below, your profile will be published live."}
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
                <span>Preview Booking Page</span>
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
            Lessons are generated within these hours in your local timezone ({user.timezone}).
          </p>
        </div>

        <WeeklyScheduleEditor
          initialRules={rules}
          timezone={user.timezone}
        />
      </div>

      {/* Section 2: One-off Date Exceptions / Holidays */}
      <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-6">
          <h2 className="font-serif text-xl font-bold text-heading">
            Date Exceptions & Holiday Blocks
          </h2>
          <p className="mt-1 text-xs text-body">
            Block specific dates when you are away on tour, holidays, or personal leave.
          </p>
        </div>

        <AvailabilityExceptionsManager initialExceptions={exceptions} />
      </div>
    </div>
  );
}
