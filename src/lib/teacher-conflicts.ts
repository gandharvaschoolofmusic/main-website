import { LessonStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getTimezoneDayBounds } from "@/lib/timezone";

export async function getTeacherConflictLessonIds(
  startOfToday = getTimezoneDayBounds(new Date()).start,
) {
  const lessons = await db.lesson.findMany({
    where: {
      startsAt: { gte: startOfToday },
      status: { in: [LessonStatus.SCHEDULED, LessonStatus.RESCHEDULED] },
    },
    select: { id: true, teacherId: true, startsAt: true, durationMinutes: true },
    orderBy: { startsAt: "asc" },
  });

  const conflicts = new Set<string>();
  const latestEndByTeacher = new Map<string, { id: string; end: number }>();
  for (const lesson of lessons) {
    const start = lesson.startsAt.getTime();
    const end = start + lesson.durationMinutes * 60_000;
    const previous = latestEndByTeacher.get(lesson.teacherId);
    // In start order, the prior lesson ending last covers any remaining overlap.
    if (previous && start < previous.end) {
      conflicts.add(previous.id);
      conflicts.add(lesson.id);
    }
    if (!previous || end > previous.end) {
      latestEndByTeacher.set(lesson.teacherId, { id: lesson.id, end });
    }
  }
  return [...conflicts];
}
