import { NextResponse } from "next/server";
import { ParticipantInfo_State, RoomServiceClient, ServerError } from "livekit-server-sdk";
import { auth } from "@/lib/auth";
import { requireLessonParticipant } from "@/lib/auth-helpers";
import { getLiveKitHttpUrl } from "@/lib/livekit";
import { isAppError, UnauthorizedError } from "@/lib/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError("Sign in to view this classroom.");
    const { id } = await params;
    const { lesson } = await requireLessonParticipant(id, session.user.id);
    if (lesson.status === "CANCELLED") return NextResponse.json({ names: [] }, { headers });
    const service = new RoomServiceClient(getLiveKitHttpUrl(), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { requestTimeout: 5 });
    const participants = await service.listParticipants(lesson.groupRoomId || `lesson-${lesson.id}`);
    const names = new Map<string, string>();
    for (const participant of participants) {
      // STANDARD clients only: do not expose hidden recorders, agents or disconnected clients.
      if (participant.kind !== 0 || participant.permission?.hidden || participant.state !== ParticipantInfo_State.ACTIVE) continue;
      const userId = participant.identity.split(":companion:")[0];
      const name = participant.name.replace(/ · Second device$/, "").trim();
      if (name) names.set(userId, name);
    }
    return NextResponse.json({ names: [...names.values()] }, { headers });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message }, { status: error.statusCode, headers });
    if (error instanceof ServerError && error.code === "not_found") return NextResponse.json({ names: [] }, { headers });
    return NextResponse.json({ error: "Participant list is temporarily unavailable." }, { status: 503, headers });
  }
}
