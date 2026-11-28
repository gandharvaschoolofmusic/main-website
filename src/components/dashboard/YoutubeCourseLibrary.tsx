import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import { normalizeYoutubePlaylist } from "@/lib/youtube-playlist";

export async function YoutubeCourseLibrary({ role }: { role: "STUDENT" | "TEACHER" }) {
  const user = await requireRole(role === "STUDENT" ? Role.STUDENT : Role.TEACHER);
  const enrollments = await db.enrollment.findMany({
    where: { status: { not: "CANCELLED" }, ...(role === "STUDENT" ? { studentId: user.id } : { teacherId: user.id }) },
    select: { id: true, youtubePlaylistUrl: true, status: true, startedAt: true,
      course: { select: { title: true, instrument: true, level: true } },
      student: { select: { name: true, customId: true } } },
    orderBy: [{ startedAt: "desc" }, { id: "asc" }],
  });
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold text-heading">YouTube</h1><p className="mt-2 text-sm text-body">{role === "STUDENT" ? "Revisit your course lessons, one playlist at a time." : "Course lecture playlists for your allotted students."}</p></header>
    <p className="rounded-xl bg-purple-50 p-4 text-sm leading-6 text-body">Private videos open on YouTube. Sign in with the Google account invited by the school. If a video is unavailable, contact the school to check your access.</p>
    <section aria-label="Course playlists" className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {enrollments.map(enrollment => {
        let url: string | null = null;
        try { url = normalizeYoutubePlaylist(enrollment.youtubePlaylistUrl || ""); } catch { /* Do not render an invalid stored link. */ }
        return <article key={enrollment.id} className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0 space-y-2">
            {role === "TEACHER" && <p className="text-sm font-semibold text-primary">{enrollment.student.name || "Student"} <span className="ml-2 text-xs font-normal text-body">{enrollment.student.customId}</span></p>}
            <h2 className="text-lg font-semibold text-heading">{enrollment.course.title}</h2>
            <p className="text-sm text-body">{enrollment.course.instrument} · {enrollment.course.level}</p>
            <p className="text-xs text-body">{enrollment.status} · Enrolled {enrollment.startedAt.toISOString().slice(0, 10)}</p>
          </div>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 px-5 text-sm font-semibold text-primary hover:bg-primary/15">Open course playlist ↗</a> : <p className="text-sm text-body sm:max-w-56">Your school has not added a playlist for this course yet.</p>}
        </article>;
      })}
      {!enrollments.length && <div className="p-8"><h2 className="font-semibold text-heading">No allotted courses yet</h2><p className="mt-2 text-sm text-body">Course playlists will appear here when the school adds them to an enrollment.</p></div>}
    </section>
  </div>;
}
