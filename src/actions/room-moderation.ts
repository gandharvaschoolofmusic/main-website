"use server";

import { RoomServiceClient } from "livekit-server-sdk";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getLiveKitHttpUrl } from "@/lib/livekit";

export async function removeLessonParticipant(lessonId: string, identity: string) {
  await requireRole("ADMIN");
  const lesson = await db.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: { groupRoomId: true },
  });
  const user = await db.user.findUnique({
    where: { id: identity.split(":companion:")[0] },
    select: { role: true },
  });
  if (user?.role !== "TEACHER" && user?.role !== "STUDENT") {
    throw new Error("Only teachers and students can be removed.");
  }
  const service = new RoomServiceClient(getLiveKitHttpUrl(), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  await service.removeParticipant(lesson.groupRoomId || `lesson-${lessonId}`, identity);
}
