import { getCurrentUser } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AdminSidebar } from "@/components/dashboard/AdminSidebar";
import { syncAdminDeviceSession } from "@/lib/admin-device-session";

export const metadata = {
  title: "Admin Portal | Gandharva School of Music",
  description: "Gandharva Administration: Manage users, courses, enrollments, lessons, and settings.",
};

export const dynamic = "force-dynamic";

export default async function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  // Record or touch active device session for security audit & session management
  if (user.sessionId) {
    try {
      const headerList = await headers();
      const userAgent = headerList.get("user-agent");
      const ip = headerList.get("x-forwarded-for") || headerList.get("x-real-ip");
      const country = headerList.get("x-vercel-ip-country") || headerList.get("cf-ipcountry");
      await syncAdminDeviceSession({
        userId: user.id,
        sessionId: user.sessionId,
        userAgent,
        ip,
        country,
      });
    } catch (err) {
      // Non-blocking session touch
    }
  }

  return (
    <div className="flex flex-col sm:flex-row h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden bg-[#F8F7FC] text-heading font-sans antialiased">
      <AdminSidebar
        currentUser={{
          name: user.name || "Administrator",
          email: user.email,
        }}
      />
      <main className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 sm:px-6 sm:py-6 md:px-8 md:py-7 min-w-0 main-scroll">
        <div className="max-w-[1560px] mx-auto pb-12">{children}</div>
      </main>
    </div>
  );
}
