import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { AdminSettingsForm } from "./AdminSettingsForm";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Platform Settings | Admin Portal | Gandharva School of Music",
  description: "Configure global trial allocations, institution metadata, and platform policies.",
};

const getCachedAdminSettingsData = unstable_cache(
  async () => {
    const settings = await db.platformSettings.findUnique({
      where: { id: 1 },
    });

    return {
      freeTrialLessonCount: settings?.freeTrialLessonCount ?? 2,
      storageProvider: settings?.storageProvider ?? "SUPABASE",
    };
  },
  ["admin-settings-data-v2"],
  { revalidate: 60, tags: ["admin-settings", "settings"] }
);

export default async function AdminSettingsPage() {
  const adminUser = await requireRole(Role.ADMIN);

  const currentAdmin = await db.user.findUnique({
    where: { id: adminUser.id },
    select: {
      email: true,
      twoFactorEnabled: true,
      twoFactorVerifiedAt: true,
      twoFactorBackupCodes: true,
    },
  });

  const twoFactorData = {
    enabled: currentAdmin?.twoFactorEnabled ?? false,
    email: currentAdmin?.email || adminUser.email || "admin@gandharvaschoolofmusic.com",
    verifiedAt: currentAdmin?.twoFactorVerifiedAt?.toISOString() ?? null,
    backupCodesCount: currentAdmin?.twoFactorBackupCodes
      ? (JSON.parse(currentAdmin.twoFactorBackupCodes) as string[]).length
      : 0,
  };

  let initialSettings = {
    freeTrialLessonCount: 2,
    storageProvider: "SUPABASE",
  };

  try {
    initialSettings = await getCachedAdminSettingsData();
  } catch (err) {
    console.error("[AdminSettingsPage] Failed to load cached settings, using fallback:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent-dark font-mono">
          System Configuration
        </span>
        <SplitHeading
          firstClause="Platform Settings &"
          accentClause="Policies"
          as="h1"
          size="lg"
          className="mt-1"
        />
        <p className="text-sm text-body mt-1">
          Adjust global free trial lesson allocations, cloud storage settings, and institutional operational parameters.
        </p>
      </div>

      <AdminSettingsForm initialSettings={initialSettings} twoFactorData={twoFactorData} />
    </div>
  );
}
