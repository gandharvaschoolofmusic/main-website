/**
 * Student Directory Filtering Utilities
 *
 * Handles qualification logic for the Admin Students Directory.
 */

/**
 * Determines whether a student is currently in an active trial period.
 *
 * Rules:
 * - Directly created students (no trial requests) -> NOT in trial period (ALWAYS SHOWN).
 * - Enrolled students (has at least 1 course enrollment) -> NOT in trial period (ALWAYS SHOWN).
 * - Converted students (isConverted === true) -> NOT in trial period (ALWAYS SHOWN).
 * - Students who finished their trial lesson (has a COMPLETED lesson) -> Trial period completed (ALWAYS SHOWN).
 *
 * Excluded from the Students Directory:
 * - Prospective leads who requested a trial, have NOT completed their trial session yet,
 *   and have NOT enrolled in any course. These students belong in the Trials section (/admin/trials).
 */
export function isStudentInActiveTrialPeriod(student: {
  enrollments?: Array<any>;
  trials?: Array<{ isConverted: boolean; status?: string; allottedLessonStatus?: string | null }>;
  lessons?: Array<{ status: string }>;
  trialStatus?: { status: string; lessonsUsed?: number; lessonsGranted?: number } | null;
  trialRequestsAsStudent?: Array<{
    isConverted: boolean;
    status: string;
    allottedLesson?: { status: string } | null;
  }>;
  lessonsAsStudent?: Array<{ status: string }>;
}): boolean {
  // 1. Enrolled students (has course enrollment)
  if (student.enrollments && student.enrollments.length > 0) {
    return false;
  }

  const trialRequests = student.trialRequestsAsStudent ?? student.trials ?? [];
  // 2. Direct created students: if they never requested a trial, they are a directly added student
  if (trialRequests.length === 0) {
    return false;
  }

  // 3. Converted trial students
  const isConverted = trialRequests.some((t: any) => Boolean(t.isConverted));
  if (isConverted) {
    return false;
  }

  // 4. Completed lessons (trial lesson conducted and finished)
  const allLessons = student.lessonsAsStudent ?? student.lessons ?? [];
  const hasCompletedLesson = allLessons.some((l) => l.status === "COMPLETED");
  if (hasCompletedLesson) {
    return false;
  }

  // 5. Allotted trial lesson completed
  const hasCompletedTrialLesson = trialRequests.some(
    (t: any) =>
      t.allottedLesson?.status === "COMPLETED" ||
      t.allottedLessonStatus === "COMPLETED"
  );
  if (hasCompletedTrialLesson) {
    return false;
  }

  // 6. Trial quota exhausted
  if (student.trialStatus?.status === "EXHAUSTED") {
    return false;
  }

  // Active trial lead waiting for or currently in trial session
  return true;
}
