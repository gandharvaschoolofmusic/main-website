"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { studentTermsVersion } from "@/lib/student-terms";

export async function acceptStudentTerms(version: string) {
  const user = await requireRole(Role.STUDENT);
  if (version !== studentTermsVersion) throw new Error("The policy has changed. Refresh and read the latest version before agreeing.");
  // One-way, atomic acceptance: repeated requests never replace the first date.
  await db.user.updateMany({
    where: { id: user.id, role: Role.STUDENT, studentTermsAcceptedAt: null },
    data: { studentTermsAcceptedAt: new Date(), studentTermsVersion },
  });
  const saved = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { studentTermsAcceptedAt: true } });
  revalidatePath("/student/dashboard", "layout");
  return { acceptedAt: saved.studentTermsAcceptedAt!.toISOString() };
}
