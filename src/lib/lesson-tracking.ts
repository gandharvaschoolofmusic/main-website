import { db } from "@/lib/db";
import { generateLessonSessionId } from "@/lib/id-generator";
import { Prisma } from "@prisma/client";

/**
 * Generates a clean, unique human-readable lesson tracking ID
 * Format: S0001-SE001 (Student ID + Session No.)
 * Breakdown: student id + session no.
 */
export async function generateUniqueLessonTrackingCode(
  studentId?: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<string> {
  if (studentId) {
    return generateLessonSessionId(studentId, client);
  }

  // If studentId was not provided, look up first student or fallback
  const firstStudent = await client.user.findFirst({
    where: { role: "STUDENT" },
    select: { id: true, customId: true },
    orderBy: { createdAt: "asc" },
  });

  if (firstStudent) {
    return generateLessonSessionId(firstStudent.id, client);
  }

  return `S0001-SE001`;
}

/**
 * Returns a standardized tracking code for any lesson, falling back to clean S0001-SE...
 */
export function getLessonTrackingId(lesson: {
  trackingCode?: string | null;
  id: string;
}): string {
  if (lesson.trackingCode) {
    return lesson.trackingCode;
  }
  return `S0001-SE001`;
}
