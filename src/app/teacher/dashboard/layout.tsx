import { getCurrentUser } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { TeacherSidebar } from "@/components/dashboard/TeacherSidebar";

export const metadata = {
  title: "Teacher Studio | Gandharva School of Music",
  description: "Gandharva Faculty Studio: Manage schedule, lessons, students, and earnings.",
};

export const dynamic = "force-dynamic";

export default async function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/teacher/dashboard");
  }

  if (user.role !== Role.TEACHER) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-gradient-to-b from-bg via-bg-alt/15 to-bg text-heading">
      <TeacherSidebar
        teacherName={user.name || "Faculty Studio"}
        teacherEmail={user.email || ""}
        teacherImage={user.image}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 min-w-0">
        <div className="max-w-6xl mx-auto space-y-6">{children}</div>
      </main>
    </div>
  );
}
