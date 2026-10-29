import { getCurrentUser } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ProfileCompletionPopup } from "@/components/dashboard/ProfileCompletionPopup";

import { unstable_cache } from "next/cache";

const getCachedStudentProfileData = unstable_cache(
  async (userId: string) => {
    return db.user.findUnique({
      where: { id: userId },
      select: {
        country: true,
        age: true,
        gender: true,
        guardianName: true,
        guardianPhone: true,
        address: true,
        trialStatus: {
          select: { id: true },
        },
        _count: {
          select: {
            trialRequestsAsStudent: true,
          },
        },
      },
    });
  },
  ["student-profile-layout-data"],
  { revalidate: 60, tags: ["student-profile"] }
);

export const dynamic = "force-dynamic";

export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/student/dashboard");
  }

  if (user.role !== Role.STUDENT) {
    redirect("/dashboard");
  }

  // Check student profile completeness and trial booking status (cached for 60s)
  let profileData: {
    country: string | null;
    age: number | null;
    gender: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    address: string | null;
    trialStatus: { id: number | string } | null;
    _count: { trialRequestsAsStudent: number };
  } | null = null;

  try {
    profileData = await getCachedStudentProfileData(user.id);
  } catch (err) {
    console.warn("Could not query student profile completeness:", err);
  }

  const hasTrialBooking = Boolean(
    (profileData?._count?.trialRequestsAsStudent ?? 0) > 0 ||
      profileData?.trialStatus
  );

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-gradient-to-b from-bg via-bg-alt/15 to-bg text-heading">
      <DashboardSidebar
        user={{
          name: user.name || "Student",
          email: user.email || "",
          image: user.image,
        }}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 min-w-0">
        <div className="max-w-6xl mx-auto space-y-6">{children}</div>
      </main>

      {/* Sleek Apple-style side popup to complete student profile if incomplete */}
      {profileData && (
        <ProfileCompletionPopup
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            country: profileData.country,
            age: profileData.age,
            gender: profileData.gender,
            guardianName: profileData.guardianName,
            guardianPhone: profileData.guardianPhone,
            address: profileData.address,
          }}
          hasTrialBooking={hasTrialBooking}
        />
      )}
    </div>
  );
}

