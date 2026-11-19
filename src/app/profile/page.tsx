import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";

export default async function ProfileRedirectPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/profile");
  }

  if (user.role === Role.TEACHER) {
    redirect("/teacher/dashboard/profile");
  }

  if (user.role === Role.ADMIN) {
    redirect("/admin/settings");
  }

  redirect("/student/dashboard/profile");
}
