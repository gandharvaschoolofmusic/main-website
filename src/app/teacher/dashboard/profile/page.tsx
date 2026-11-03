import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { TeacherProfileEditor } from "./TeacherProfileEditor";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Profile & Settings | Teacher Studio | Gandharva School of Music",
  description: "Manage teacher biography, instruments taught, languages, timezone, and security.",
};

export default async function TeacherProfilePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?callbackUrl=/teacher/dashboard/profile");
  }

  if (currentUser.role === Role.STUDENT) {
    redirect("/student/dashboard/profile");
  }

  if (currentUser.role === Role.ADMIN) {
    redirect("/admin/users");
  }

  const dbUser = await db.user.findUnique({
    where: { id: currentUser.id },
    include: {
      teacherProfile: true,
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  let profile = dbUser.teacherProfile;
  if (!profile) {
    profile = await db.teacherProfile.create({
      data: {
        userId: dbUser.id,
        bio: "Teacher instructor at Gandharva School of Music.",
        instruments: ["Piano"],
        languages: ["English"],
        yearsTeaching: 5,
        hourlyRate: 5000,
        payoutPerSession: 80000,
        isPublished: false,
        approvalStatus: "PENDING",
      },
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
          Studio Credentials
        </span>
        <SplitHeading
          firstClause="Teacher Profile &"
          accentClause="Account Settings"
          as="h1"
          size="lg"
        />
        <p className="text-xs text-body mt-1 max-w-2xl">
          Maintain your public teaching profile, pedagogical bio, instrument disciplines, and security credentials.
        </p>
      </div>

      <TeacherProfileEditor
        user={{
          id: dbUser.id,
          name: dbUser.name || "",
          email: dbUser.email,
          timezone: dbUser.timezone || "UTC",
          image: dbUser.image,
        }}
        profile={
          profile
            ? {
                bio: profile.bio || "",
                instruments: profile.instruments,
                expertInstruments: profile.expertInstruments || [],
                moderateInstruments: profile.moderateInstruments || [],
                languages: profile.languages,
                yearsTeaching: profile.yearsTeaching,
                hourlyRate: profile.hourlyRate,
                payoutPerSession: profile.payoutPerSession || 80000,
                upiId: profile.upiId || "",
                isPublished: profile.isPublished,
                approvalStatus: profile.approvalStatus,
                approvedAt: profile.approvedAt ? profile.approvedAt.toISOString() : null,
                rejectionReason: profile.rejectionReason || null,
              }
            : null
        }
      />
    </div>
  );
}
