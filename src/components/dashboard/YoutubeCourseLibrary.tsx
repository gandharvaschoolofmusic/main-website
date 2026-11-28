import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import { normalizeYoutubePlaylist } from "@/lib/youtube-playlist";
import { YoutubeCourseList } from "./YoutubeCourseList";

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
    <p className="text-sm text-body">Select a course to browse its lecture videos and watch here in your dashboard.</p>
    <YoutubeCourseList courses={enrollments.map(enrollment => {
      let playlistId: string | null = null;
      try {
        const url = normalizeYoutubePlaylist(enrollment.youtubePlaylistUrl || "");
        playlistId = url ? new URL(url).searchParams.get("list") : null;
      } catch { /* Invalid stored links are never passed to the player. */ }
      return {
        id: enrollment.id, title: enrollment.course.title,
        instrument: enrollment.course.instrument, level: enrollment.course.level,
        status: enrollment.status, enrolledAt: enrollment.startedAt.toISOString().slice(0, 10),
        studentLabel: role === "TEACHER" ? [enrollment.student.name || "Student", enrollment.student.customId].filter(Boolean).join(" · ") : null,
        playlistId,
      };
    })} />
  </div>;
}
