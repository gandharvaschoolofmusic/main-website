import { db } from "@/lib/db";
import { Role, Prisma } from "@prisma/client";

/**
 * Pads a number with leading zeros up to specified length.
 */
export function padNumber(n: number, length: number): string {
  return String(n).padStart(length, "0");
}

/**
 * Generates the next sequential Student ID: S0001, S0002, S0003...
 */
export async function generateNextStudentId(
  client: Prisma.TransactionClient | typeof db = db
): Promise<string> {
  const students = await client.user.findMany({
    where: {
      role: Role.STUDENT,
      customId: { startsWith: "S" },
    },
    select: { customId: true },
  });

  let maxNum = 0;
  for (const s of students) {
    if (s.customId) {
      const match = s.customId.match(/^S(\d+)$/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNum) {
          maxNum = val;
        }
      }
    }
  }

  // Next sequential number (at least 4 digits, e.g. S0001)
  const nextNum = maxNum + 1;
  const padding = nextNum > 9999 ? String(nextNum).length : 4;
  return `S${padNumber(nextNum, padding)}`;
}

/**
 * Generates the next sequential Teacher ID: T0001, T0002, T0003...
 */
export async function generateNextTeacherId(
  client: Prisma.TransactionClient | typeof db = db
): Promise<string> {
  const teachers = await client.user.findMany({
    where: {
      role: Role.TEACHER,
      customId: { startsWith: "T" },
    },
    select: { customId: true },
  });

  let maxNum = 0;
  for (const t of teachers) {
    if (t.customId) {
      const match = t.customId.match(/^T(\d+)$/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNum) {
          maxNum = val;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  const padding = nextNum > 9999 ? String(nextNum).length : 4;
  return `T${padNumber(nextNum, padding)}`;
}

/**
 * Generates a Session ID for a lesson: S0001-SE001, S0001-SE002...
 * Formula: Student ID + "-SE" + Session No (3-digit zero-padded).
 */
export async function generateLessonSessionId(
  studentId: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<string> {
  // 1. Retrieve or auto-assign the student's customId
  let student = await client.user.findUnique({
    where: { id: studentId },
    select: { id: true, customId: true, role: true },
  });

  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  let studentCode = student.customId;
  if (!studentCode || !studentCode.startsWith("S")) {
    studentCode = await generateNextStudentId(client);
    await client.user.update({
      where: { id: studentId },
      data: { customId: studentCode },
    });
  }

  // 2. Query all existing lessons for this student to determine the next session number
  const existingLessons = await client.lesson.findMany({
    where: { studentId },
    select: { id: true, trackingCode: true },
    orderBy: { startsAt: "asc" },
  });

  let maxSession = 0;
  const sessionRegex = new RegExp(`^${studentCode}-SE(\\d+)$`, "i");

  for (const l of existingLessons) {
    if (l.trackingCode) {
      const match = l.trackingCode.match(sessionRegex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSession) {
          maxSession = val;
        }
      }
    }
  }

  // Fallback to existing count if no tracking codes match the pattern yet
  let nextSessionNum = Math.max(maxSession, existingLessons.length) + 1;

  // 3. Guarantee global uniqueness in database
  while (true) {
    const code = `${studentCode}-SE${padNumber(nextSessionNum, 3)}`;
    const collision = await client.lesson.findFirst({
      where: { trackingCode: code },
      select: { id: true },
    });
    if (!collision) {
      return code;
    }
    nextSessionNum++;
  }
}

/**
 * Returns formatted display Student ID (e.g. S0001).
 */
export function getStudentDisplayId(user?: {
  customId?: string | null;
  id?: string;
} | null): string {
  if (user?.customId && user.customId.startsWith("S")) {
    return user.customId;
  }
  return user?.customId || "S0001";
}

/**
 * Returns formatted display Teacher ID (e.g. T0001).
 */
export function getTeacherDisplayId(user?: {
  customId?: string | null;
  id?: string;
} | null): string {
  if (user?.customId && user.customId.startsWith("T")) {
    return user.customId;
  }
  return user?.customId || "T0001";
}

