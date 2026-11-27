"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { teacherTermsVersion } from "@/lib/teacher-terms";

export async function acceptTeacherTerms(version: string) {
  const user = await requireRole(Role.TEACHER);
  if (version !== teacherTermsVersion) throw new Error("The policy has changed. Refresh and read the latest version before agreeing.");
  // One-way, atomic acceptance: repeated requests never replace the first date.
  await db.user.updateMany({
    where: { id: user.id, role: Role.TEACHER, teacherTermsAcceptedAt: null },
    data: { teacherTermsAcceptedAt: new Date(), teacherTermsVersion },
  });
  const saved = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { teacherTermsAcceptedAt: true } });
  revalidatePath("/teacher/dashboard", "layout");
  return { acceptedAt: saved.teacherTermsAcceptedAt!.toISOString() };
}
