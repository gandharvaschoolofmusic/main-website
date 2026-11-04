import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordingPlaybackUrl } from "@/lib/supabase-storage";
import { readLessonRecordingMedia } from "@/lib/lesson-recording-media";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const part = query.get("part");
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { studentId: true, teacherId: true, groupRoomId: true, recordingUrl: true,
      recordings: { where: { id: part || "" }, select: { fileUrl: true, storageBackend: true } } },
  });
  if (!lesson || (session.user.role !== "ADMIN" && session.user.id !== lesson.studentId && session.user.id !== lesson.teacherId)) {
    return new Response(null, { status: 404 });
  }
  const stored = part ? lesson.recordings[0]?.fileUrl : lesson.recordingUrl;
  if (!stored) return new Response(null, { status: 404 });
  try {
    let mediaId = lesson.recordings[0]?.storageBackend === "DATABASE" ? part : null;
    if (!part && stored.startsWith("/api/lessons/")) {
      const shared = await db.lessonRecording.findFirst({
        where: { fileUrl: stored, storageBackend: "DATABASE", lesson: lesson.groupRoomId ? { groupRoomId: lesson.groupRoomId } : { id } },
        select: { id: true },
      });
      if (!shared) return new Response(null, { status: 404 });
      mediaId = shared.id;
    }
    if (mediaId) {
      if (!query.has("resolve")) return readLessonRecordingMedia(mediaId, request.headers.get("range"));
      const mediaUrl = new URL(request.url);
      mediaUrl.searchParams.delete("resolve");
      return Response.json({ url: mediaUrl.href }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const url = await recordingPlaybackUrl(stored);
    if (!url) return new Response(null, { status: 404 });
    const destination = new URL(url, request.url);
    if (!["http:", "https:"].includes(destination.protocol)) return new Response(null, { status: 422 });
    const headers = { "Cache-Control": "private, no-store" };
    return query.has("resolve")
      ? Response.json({ url: destination.href }, { headers })
      : new Response(null, { status: 307, headers: { ...headers, Location: destination.href } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
