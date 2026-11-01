import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { AdminUsersManager, AdminUserData } from "./AdminUsersManager";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "User Management | Admin Portal | Gandharva School of Music",
  description: "Manage platform users, roles, account statuses, trial allocations, and teacher payouts.",
};

const getCachedAdminUsersData = unstable_cache(
  async () => {
    const dbUsers = await db.user.findMany({
      include: {
        trialStatus: true,
        teacherProfile: {
          select: {
            payoutPerSession: true,
            payoutDayRate: true,
            payoutNightRate: true,
            instruments: true,
            isPublished: true,
            upiId: true,
            approvalStatus: true,
            approvedAt: true,
            rejectionReason: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedUsers: AdminUserData[] = dbUsers.map((u) => ({
      id: u.id,
      name: u.name || "Unnamed User",
      email: u.email,
      phone: u.phone,
      phoneVerified: u.phoneVerified ? u.phoneVerified.toISOString() : null,
      role: u.role,
      isActive: u.isActive,
      timezone: u.timezone || "UTC",
      createdAt: u.createdAt.toISOString(),
      trialStatus: u.trialStatus
        ? {
            lessonsGranted: u.trialStatus.lessonsGranted,
            lessonsUsed: u.trialStatus.lessonsUsed,
          }
        : null,
      teacherProfile: u.teacherProfile
        ? {
            payoutPerSession: u.teacherProfile.payoutPerSession,
            payoutDayRate: u.teacherProfile.payoutDayRate,
            payoutNightRate: u.teacherProfile.payoutNightRate,
            instruments: u.teacherProfile.instruments,
            isPublished: u.teacherProfile.isPublished,
            upiId: u.teacherProfile.upiId,
            approvalStatus: u.teacherProfile.approvalStatus,
            approvedAt: u.teacherProfile.approvedAt ? u.teacherProfile.approvedAt.toISOString() : null,
            rejectionReason: u.teacherProfile.rejectionReason,
          }
        : null,
    }));

    return formattedUsers;
  },
  ["admin-users-data-v1"],
  { revalidate: 30, tags: ["admin-users", "users"] }
);

export default async function AdminUsersPage() {
  await requireRole(Role.ADMIN);

  let formattedUsers: AdminUserData[] = [];
  try {
    formattedUsers = await getCachedAdminUsersData();
  } catch (err) {
    console.error("[AdminUsersPage] Failed to load cached users data, using fallback:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
          Identity & Access Control
        </span>
        <SplitHeading
          firstClause="Platform User"
          accentClause="Management"
          as="h1"
          size="lg"
        />
        <p className="text-xs text-body mt-1 max-w-2xl">
          Search and administer students, faculty instructors, and administrative roles. Configure trial allocations and teacher session compensation.
        </p>
      </div>

      <AdminUsersManager initialUsers={formattedUsers} />
    </div>
  );
}
