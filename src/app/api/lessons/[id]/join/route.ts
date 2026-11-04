import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordParticipantJoin } from "@/lib/attendance";
import { JOIN_WINDOW_MINUTES_AFTER, JOIN_WINDOW_MINUTES_BEFORE } from "@/types";

// Browser fallback for installations without LiveKit webhooks.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { id } = await params;
  const lesson = await db.lesson.findUnique({ where: { id },
    select: { teacherId: true, studentId: true, startsAt: true, durationMinutes: true, status: true } });
  if (!lesson) return new Response(null, { status: 404 });
  const userId = session.user.id;
  const userRole = userId === lesson.teacherId ? "TEACHER" : userId === lesson.studentId ? "STUDENT" : null;
  if (!userRole) return new Response(null, { status: 403 });
  const minutes = (Date.now() - lesson.startsAt.getTime()) / 60000;
  if (lesson.status === "CANCELLED" || minutes < -JOIN_WINDOW_MINUTES_BEFORE || minutes > lesson.durationMinutes + JOIN_WINDOW_MINUTES_AFTER) {
    return new Response(null, { status: 409 });
  }
  await recordParticipantJoin({ lessonId: id, userId, userRole, userName: session.user.name || undefined });
  return new Response(null, { status: 204 });
}
