import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordingPlaybackUrl } from "@/lib/supabase-storage";
import { readLessonRecordingMedia } from "@/lib/lesson-recording-media";
import { storedFileDownload } from "@/lib/file-download";
import { attachmentDisposition } from "@/lib/download";
import { recordingFilename, recordingExtension } from "@/lib/recording-filename";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const part = query.get("part");
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { studentId: true, teacherId: true, groupRoomId: true, recordingUrl: true,
      trackingCode: true, instrument: true, startsAt: true,
      enrollment: { select: { course: { select: { title: true } } } },
      trialRequest: { select: { customId: true } },
      recordings: { orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, fileUrl: true, fileName: true, storageBackend: true } } },
  });
  if (!lesson || (session.user.role !== "ADMIN" && session.user.id !== lesson.studentId && session.user.id !== lesson.teacherId)) {
    return new Response(null, { status: 404 });
  }
  const recordingIndex = lesson.recordings.findIndex(recording => part ? recording.id === part : recording.fileUrl === lesson.recordingUrl);
  const recording = lesson.recordings[recordingIndex];
  const stored = part ? recording?.fileUrl : lesson.recordingUrl;
  if (!stored) return new Response(null, { status: 404 });
  const download = query.get("download") === "1";
  const filename = recordingFilename(lesson, {
    extension: recordingExtension(recording?.fileName || stored),
    part: recordingIndex >= 0 ? recordingIndex + 1 : undefined,
  });
  try {
    let mediaId = recording?.storageBackend === "DATABASE" ? recording.id : null;
    if (!mediaId && !part && stored.startsWith("/api/lessons/")) {
      const shared = await db.lessonRecording.findFirst({
        where: { fileUrl: stored, storageBackend: "DATABASE", lesson: lesson.groupRoomId ? { groupRoomId: lesson.groupRoomId } : { id } },
        select: { id: true },
      });
      if (!shared) return new Response(null, { status: 404 });
      mediaId = shared.id;
    }
    if (mediaId) {
      if (download) {
        const response = await readLessonRecordingMedia(mediaId, request.headers.get("range"));
        if (response.ok) response.headers.set("Content-Disposition", attachmentDisposition(filename));
        return response;
      }
      if (!query.has("resolve")) return readLessonRecordingMedia(mediaId, request.headers.get("range"));
      const mediaUrl = new URL(request.url);
      mediaUrl.searchParams.delete("resolve");
      return Response.json({ url: mediaUrl.href }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (download) return await storedFileDownload(stored, filename);
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
