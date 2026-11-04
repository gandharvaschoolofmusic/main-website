import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordingPlaybackUrl } from "@/lib/supabase-storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const part = query.get("part");
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { studentId: true, teacherId: true, recordingUrl: true,
      recordings: { where: { id: part || "" }, select: { fileUrl: true } } },
  });
  if (!lesson || (session.user.role !== "ADMIN" && session.user.id !== lesson.studentId && session.user.id !== lesson.teacherId)) {
    return new Response(null, { status: 404 });
  }
  const stored = part ? lesson.recordings[0]?.fileUrl : lesson.recordingUrl;
  if (!stored) return new Response(null, { status: 404 });
  try {
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
