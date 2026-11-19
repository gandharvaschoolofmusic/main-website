import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ProfileEditor } from "./ProfileEditor";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "My Profile | Student Portal | Gandharva School of Music",
  description: "Manage your personal profile, timezone, password, and notification preferences.",
};

export default async function StudentProfilePage() {
  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    redirect("/login?callbackUrl=/student/dashboard/profile");
  }

  if (sessionUser.role === Role.TEACHER) {
    redirect("/teacher/dashboard/profile");
  }

  if (sessionUser.role === Role.ADMIN) {
    redirect("/admin/settings");
  }

  let user: {
    id: string;
    name: string | null;
    email: string;
    timezone: string;
    emailVerified: Date | null;
    image: string | null;
    createdAt: Date;
    country: string | null;
    age: number | null;
    gender: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    address: string | null;
  } | null = null;

  try {
    user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        country: true,
        age: true,
        gender: true,
        guardianName: true,
        guardianPhone: true,
        address: true,
      },
    });
  } catch (err) {
    console.warn("Transient DB error in StudentProfilePage, using fallback session data:", err);
  }

  if (!user) {
    if (!sessionUser.id) redirect("/login");
    user = {
      id: sessionUser.id,
      name: sessionUser.name || "Student",
      email: sessionUser.email || "",
      timezone: sessionUser.timezone || "UTC",
      emailVerified: sessionUser.emailVerified ? new Date(sessionUser.emailVerified) : null,
      image: sessionUser.image || null,
      createdAt: new Date(),
      country: null,
      age: null,
      gender: null,
      guardianName: null,
      guardianPhone: null,
      address: null,
    };
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
          Profile and Preferences
        </span>
        <SplitHeading
          as="h1"
          firstClause="Student"
          accentClause="Profile"
          size="xl"
          className="mt-0.5"
        />
        <p className="text-xs sm:text-sm text-body mt-1">
          Manage your account details, lesson timezone preference, and security credentials.
        </p>
      </div>

      <ProfileEditor
        user={{
          id: user.id,
          name: user.name || "",
          email: user.email,
          timezone: user.timezone || "UTC",
          emailVerified: Boolean(user.emailVerified),
          image: user.image,
          createdAt: user.createdAt.toISOString(),
          country: user.country || "",
          age: user.age ?? null,
          gender: user.gender || "",
          guardianName: user.guardianName || "",
          guardianPhone: user.guardianPhone || "",
          address: user.address || "",
        }}
      />
    </div>
  );
}
