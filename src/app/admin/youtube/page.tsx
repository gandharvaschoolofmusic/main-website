import Link from "next/link";
import { Role, type Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { YoutubePlaylistEditor } from "@/components/dashboard/YoutubePlaylistEditor";

export const metadata = { title: "YouTube Playlists | Admin | Gandharva" };

export default async function AdminYoutubePage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  await requireRole(Role.ADMIN);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 100);
  const filter = ["ready", "missing"].includes(params.filter || "") ? params.filter! : "all";
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page || "1", 10) || 1));
  const where: Prisma.EnrollmentWhereInput = {
    status: { not: "CANCELLED" },
    ...(filter === "ready" ? { youtubePlaylistUrl: { not: null } } : filter === "missing" ? { youtubePlaylistUrl: null } : {}),
    ...(q ? { OR: [
      { student: { name: { contains: q, mode: "insensitive" } } },
      { student: { customId: { contains: q, mode: "insensitive" } } },
      { course: { title: { contains: q, mode: "insensitive" } } },
    ] } : {}),
  };
  const [enrollments, total] = await Promise.all([
    db.enrollment.findMany({ where, orderBy: [{ startedAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20,
      select: { id: true, status: true, startedAt: true, youtubePlaylistUrl: true,
        student: { select: { name: true, customId: true } }, course: { select: { title: true, instrument: true, level: true } } } }),
    db.enrollment.count({ where }),
  ]);
  const href = (next: number) => "/admin/youtube?" + new URLSearchParams({ q, filter, page: String(next) });
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold text-heading">YouTube</h1><p className="mt-2 text-sm text-body">One lecture playlist for each student’s allotted course.</p></header>
    <aside className="rounded-xl bg-purple-50 p-4 text-sm leading-6 text-body">
      <strong className="text-heading">Dashboard playback.</strong> Add a public or unlisted playlist with embedding enabled for its videos. Students and allotted teachers can watch inside their dashboard. Unlisted links are accessible to anyone who has the link; dashboard access does not make YouTube videos private.
    </aside>
    <form className="flex flex-wrap items-end gap-3" action="/admin/youtube">
      <label className="min-w-0 flex-1 text-sm font-medium">Find student or course<input name="q" defaultValue={q} placeholder="Student name, student ID or course" className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal" /></label>
      <label className="text-sm font-medium">Playlist<select name="filter" defaultValue={filter} className="mt-2 block min-h-11 rounded-lg border border-neutral-300 bg-white px-3 font-normal"><option value="all">All courses</option><option value="missing">Not added</option><option value="ready">Added</option></select></label>
      <button className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white">Search</button>
    </form>
    <div className="flex justify-between text-sm text-body"><p>{total} matching enrollments</p><p>{enrollments.length ? `${(page - 1) * 20 + 1}–${(page - 1) * 20 + enrollments.length}` : "0"} shown</p></div>
    <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
      {enrollments.map(enrollment => <article key={enrollment.id} className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2">
          <p className="font-semibold text-heading">{enrollment.student.name || "Student"} <span className="ml-2 text-xs font-normal text-body">{enrollment.student.customId}</span></p>
          <h2 className="text-sm font-medium text-heading">{enrollment.course.title}</h2>
          <p className="text-xs text-body">{enrollment.course.instrument} · {enrollment.course.level} · {enrollment.status} · Enrolled {enrollment.startedAt.toISOString().slice(0, 10)}</p>
          <p className="text-xs text-body">{enrollment.youtubePlaylistUrl ? "Playlist added" : "Playlist not added"}</p>
        </div>
        <YoutubePlaylistEditor key={enrollment.id + (enrollment.youtubePlaylistUrl || "")} enrollmentId={enrollment.id} initialUrl={enrollment.youtubePlaylistUrl} />
      </article>)}
      {!enrollments.length && <p className="p-8 text-sm text-body">No allotted courses match your search.</p>}
    </div>
    <nav aria-label="Playlist list pages" className="flex justify-between text-sm font-medium text-primary">
      {page > 1 ? <Link href={href(page - 1)} prefetch={false} className="py-3">← Previous</Link> : <span />}
      {page * 20 < total && <Link href={href(page + 1)} prefetch={false} className="py-3">Next →</Link>}
    </nav>
  </div>;
}
