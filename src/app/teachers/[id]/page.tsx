import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateAvailableSlots } from "@/lib/slots";
import { isValidTimezone } from "@/lib/timezone";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { ArrowLeft, CheckCircle2, Music, Sparkles, BookOpen } from "lucide-react";

interface TeacherDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ instrument?: string; tz?: string }>;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Teacher Profile | Gandharva School of Music",
  description: "Book 1-to-1 live video music lessons with accredited faculty maestros.",
};

export default async function TeacherDetailPage({
  params,
  searchParams,
}: TeacherDetailPageProps) {
  const { id } = await params;
  const search = await searchParams;

  const session = await auth();
  const currentUser = session?.user;

  const cookieStore = await cookies();
  const tzCookie = cookieStore.get("user-timezone")?.value;

  const requestedTz = typeof search.tz === "string" ? search.tz : null;
  const viewerTimezone =
    (requestedTz && isValidTimezone(requestedTz) ? requestedTz : null) ||
    (currentUser?.timezone && isValidTimezone(currentUser.timezone)
      ? currentUser.timezone
      : null) ||
    (tzCookie && isValidTimezone(tzCookie) ? tzCookie : null) ||
    "UTC";

  const teacher = await db.teacherProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          timezone: true,
          image: true,
        },
      },
    },
  });

  const isOwner = currentUser?.id === teacher?.user.id;
  const isApproved = teacher?.approvalStatus === "APPROVED";

  if (!teacher || ((!teacher.isPublished || !isApproved) && !isOwner)) {
    notFound();
  }



  const availability = await generateAvailableSlots(
    teacher.id,
    viewerTimezone,
  );

  const teacherName = teacher.user.name || "Music Teacher";
  const initials = teacherName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  let expertList = (teacher as any).expertInstruments || [];
  let moderateList = (teacher as any).moderateInstruments || [];

  if (expertList.length === 0 && moderateList.length === 0) {
    try {
      const raw = await db.$queryRawUnsafe<any[]>(
        `SELECT "expertInstruments", "moderateInstruments" FROM "TeacherProfile" WHERE id = $1`,
        teacher.id
      );
      if (raw && raw[0]) {
        expertList = raw[0].expertInstruments || [];
        moderateList = raw[0].moderateInstruments || [];
      }
    } catch {
      // Fallback
    }
  }

  if (expertList.length === 0 && moderateList.length === 0) {
    expertList = teacher.instruments;
  }

  const isStudentAuthenticated =
    !!currentUser && currentUser.role === "STUDENT";
  const isEmailVerified = !!currentUser?.emailVerified;

  return (
    <div className="min-h-screen bg-bg text-body py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2 text-xs text-body-muted">
          <Link
            href="/courses"
            className="hover:text-heading transition-colors flex items-center gap-1.5 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to courses</span>
          </Link>
          <span>/</span>
          <span className="text-heading font-semibold">{teacherName}</span>
        </div>

        {/* Unapproved / Pending Owner Preview Banner */}
        {!isApproved && isOwner && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse shrink-0"></span>
              <span>
                <strong>Accreditation Pending:</strong> Your faculty profile is awaiting administrative review. Students cannot discover or book lessons with you until your application is approved by the academic board.
              </span>
            </div>
            <Link
              href="/teacher/dashboard"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors whitespace-nowrap self-start sm:self-auto btn-tactile"
            >
              Go to Studio →
            </Link>
          </div>
        )}

        {/* Unpublished Owner Preview Banner */}
        {isApproved && !teacher.isPublished && isOwner && (
          <div className="rounded-2xl border border-accent/40 bg-accent-subtle p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-accent-dark">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0"></span>
              <span>
                <strong>Preview Mode:</strong> Your profile is currently unpublished. Students cannot see your profile in search or book lessons until you publish it.
              </span>
            </div>
            <Link
              href="/teacher/dashboard"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors whitespace-nowrap self-start sm:self-auto btn-tactile"
            >
              Go to Studio to Publish →
            </Link>
          </div>
        )}

        {/* Two-column layout: Bio/Studio Info on Left, Slot Picker on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Teacher Profile Info (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-border-default rounded-2xl p-6 shadow-sm space-y-6">
              {/* Header: Avatar, Name, Timezone */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl font-serif shadow-xs overflow-hidden shrink-0">
                  {teacher.user.image ? (
                    <Image
                      src={teacher.user.image}
                      alt={teacherName}
                      width={64}
                      height={64}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <SplitHeading
                    as="h1"
                    size="lg"
                    firstClause={teacherName}
                    accentClause="Studio"
                  />
                  <p className="text-xs text-body-muted flex items-center gap-2 mt-1">
                    <span>{teacher.yearsTeaching} years teaching</span>
                    <span>•</span>
                    <span className="text-heading font-medium">
                      {teacher.user.timezone || "UTC"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Rate & Status */}
              <div className="flex items-center justify-between p-4 bg-bg-alt/50 border border-border-subtle rounded-xl">
                <div>
                  <div className="text-xs text-body-muted font-medium">Lesson Rate</div>
                  <div className="text-2xl font-bold text-heading font-serif">
                    ${(teacher.hourlyRate / 100).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-body-muted">per 60 minutes</div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-muted border border-success/30 text-xs font-bold text-success">
                    <span className="w-2 h-2 rounded-full bg-success"></span>
                    Available for Booking
                  </span>
                </div>
              </div>

              {/* Instruments & Disciplines Taught (Divided into 1. Expertise and 2. Moderate) */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-primary" />
                    <span>Instruments & Disciplines Taught</span>
                  </span>
                  <span className="text-[11px] text-body-muted font-medium">
                    {teacher.instruments.length} total
                  </span>
                </div>

                {/* 1. Expertise */}
                {expertList.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <span>1. Expertise (Mastery & Advanced)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {expertList.map((inst: string) => (
                        <span
                          key={inst}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary shadow-xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                          {inst}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Moderate */}
                {moderateList.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-heading">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>2. Moderate (Intermediate & Foundation)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {moderateList.map((inst: string) => (
                        <span
                          key={inst}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-alt/60 border border-border-default text-xs font-medium text-heading"
                        >
                          {inst}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Spoken Languages */}
              {teacher.languages.length > 0 && (
                <div className="space-y-1 text-xs">
                  <span className="font-bold uppercase tracking-wider text-heading">
                    Languages
                  </span>
                  <p className="text-body font-medium">
                    {teacher.languages.join(", ")}
                  </p>
                </div>
              )}

              {/* Teacher Bio */}
              <div className="space-y-2 border-t border-border-subtle pt-5">
                <span className="text-xs font-bold uppercase tracking-wider text-heading">
                  About {teacherName}
                </span>
                <p className="text-body text-sm leading-relaxed whitespace-pre-line">
                  {teacher.bio}
                </p>
              </div>

              {/* Studio Audio Quality Card */}
              <div className="p-4 bg-bg-alt border border-border-default rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Music className="w-4 h-4 text-primary" />
                  <span>Gandharva Studio Acoustics</span>
                </div>
                <p className="text-body leading-relaxed">
                  Lessons occur inside our custom audio room calibrated for musical instruments and vocals.
                  Echo cancellation and speech filters are bypassed for true acoustic fidelity.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Slot Picker & Booking Widget (7 cols) */}
          <div className="lg:col-span-7">
            {availability ? (
              <SlotPicker
                availability={availability}
                isStudentAuthenticated={isStudentAuthenticated}
                userRole={currentUser?.role || null}
                isEmailVerified={isEmailVerified}
              />
            ) : (
              <div className="bg-white border border-border-default rounded-2xl p-8 text-center text-body-muted shadow-sm">
                Unable to load availability schedule for this teacher.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
