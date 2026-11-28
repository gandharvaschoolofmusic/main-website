"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import type { PlaylistFilter, PlaylistStudent } from "@/lib/admin-youtube";
import { YoutubePlaylistEditor } from "@/components/dashboard/YoutubePlaylistEditor";
import { YoutubePlaylistPlayer } from "@/components/dashboard/YoutubePlaylistPlayer";
import { normalizeYoutubePlaylist } from "@/lib/youtube-playlist";

type Props = { students: PlaylistStudent[]; total: number; page: number; pages: number; q: string; filter: PlaylistFilter };

export function AdminYoutubeManager({ students, total, page, pages, q, filter }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(q);
  const [selectedFilter, setSelectedFilter] = useState(filter);
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [courseId, setCourseId] = useState("");
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [savedUrls, setSavedUrls] = useState<Record<string, string | null>>({});
  const student = students.find(item => item.id === studentId) || students[0];
  const course = student?.courses.find(item => item.id === courseId) || student?.courses[0];
  const url = (id: string, original: string | null) => id in savedUrls ? savedUrls[id] : original;
  const selectedUrl = course ? url(course.id, course.url) : null;
  let playlistId: string | null = null;
  try { const normalized = normalizeYoutubePlaylist(selectedUrl || ""); playlistId = normalized ? new URL(normalized).searchParams.get("list") : null; } catch { /* Invalid legacy links remain editable. */ }
  const href = (nextPage: number, search = q, nextFilter = filter) => "/admin/youtube?" + new URLSearchParams({ q: search, filter: nextFilter, page: String(nextPage) });
  const previous = page > 1 ? href(page - 1) : null;
  const next = page < pages ? href(page + 1) : null;
  useEffect(() => {
    if (previous) router.prefetch(previous);
    if (next) router.prefetch(next);
  }, [router, previous, next]);
  const navigate = (destination: string) => startTransition(() => router.push(destination, { scroll: false }));
  const chooseStudent = (id: string) => { setStudentId(id); setCourseId(""); setPreview(false); };
  const locked = pending || editing;

  return <div className="space-y-5">
    <header><h1 className="text-2xl font-semibold text-heading">YouTube playlists</h1><p className="mt-2 text-sm text-body">Choose a student, then add a separate lecture playlist to each allotted course.</p></header>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); navigate(href(1, query.trim(), selectedFilter)); }}>
      <label className="min-w-0 flex-1 text-sm font-medium text-heading" htmlFor="playlist-search">Find student or course
        <div className="relative mt-2"><Search size={16} className="absolute left-3 top-3.5 text-body" /><input id="playlist-search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} disabled={locked} placeholder="Name, student ID or course" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 font-normal" /></div>
      </label>
      <label className="text-sm font-medium text-heading" htmlFor="playlist-filter">Students with
        <select id="playlist-filter" value={selectedFilter} disabled={locked} onChange={event => setSelectedFilter(event.target.value as PlaylistFilter)} className="mt-2 block min-h-11 rounded-lg border border-neutral-300 bg-white px-3 font-normal"><option value="all">All allotted courses</option><option value="missing">A missing playlist</option><option value="ready">An added playlist</option></select>
      </label>
      <button disabled={locked} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">Search</button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-body">
      <p>{total} {total === 1 ? "student" : "students"}{filter !== "all" || q ? " matching your search" : " with allotted courses"}</p>
      <nav aria-label="Student pages" className="flex items-center gap-2">
        <button type="button" disabled={!previous || locked} onClick={() => previous && navigate(previous)} className="flex min-h-11 items-center gap-1 rounded-lg px-3 font-medium text-primary hover:bg-primary/5 disabled:text-neutral-400 disabled:hover:bg-transparent"><ArrowLeft size={16} />Previous</button>
        <span className="text-xs tabular-nums">{page} / {pages}</span>
        <button type="button" disabled={!next || locked} onClick={() => next && navigate(next)} className="flex min-h-11 items-center gap-1 rounded-lg px-3 font-medium text-primary hover:bg-primary/5 disabled:text-neutral-400 disabled:hover:bg-transparent">Next<ArrowRight size={16} /></button>
      </nav>
    </div>
    {pending && <p role="status" className="flex items-center gap-2 text-sm text-primary"><Loader2 size={16} className="animate-spin" />Loading students…</p>}
    {editing && <p role="status" className="text-sm text-body">Save or cancel this playlist edit before switching courses or students.</p>}
    {!students.length ? <div className="rounded-xl border border-neutral-200 bg-white p-8"><h2 className="font-semibold text-heading">No students found</h2><p className="mt-2 text-sm text-body">Try another name or select all allotted courses.</p></div> :
    <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]" aria-busy={pending}>
      <section aria-label="Students" className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <h2 className="px-4 py-3 text-sm font-semibold text-heading">Students</h2>
        <label className="block px-4 pb-4 text-sm lg:hidden">Choose student<select value={student?.id} disabled={locked} onChange={event => chooseStudent(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3">{students.map(item => <option key={item.id} value={item.id}>{item.name} · {item.customId} · {item.courses.length} courses</option>)}</select></label>
        <div className="hidden max-h-[620px] overflow-y-auto px-2 pb-2 lg:block">{students.map(item => <button type="button" key={item.id} disabled={locked} aria-pressed={student?.id === item.id} onClick={() => chooseStudent(item.id)} className={`mb-1 block min-h-20 w-full rounded-lg px-3 py-3 text-left disabled:cursor-wait ${student?.id === item.id ? "bg-primary/10 text-primary" : "text-heading hover:bg-neutral-50"}`}>
          <span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs text-body">{item.customId} · {item.courses.length} {item.courses.length === 1 ? "course" : "courses"}</span>
          <span className="mt-1 block text-xs text-body">{item.courses.filter(c => url(c.id, c.url)).length} of {item.courses.length} playlists added</span>
        </button>)}</div>
      </section>
      <section aria-label="Student course playlists" className="min-w-0 space-y-5 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
        <header><p className="text-xs text-body">{student?.customId}</p><h2 className="mt-1 text-xl font-semibold text-heading">{student?.name}</h2><p className="mt-1 text-sm text-body">{student?.courses.length} allotted courses · Each course has its own playlist.</p></header>
        <div className="grid gap-2 sm:grid-cols-2" aria-label="Choose an allotted course">{student?.courses.map(item => <button type="button" key={item.id} disabled={locked} aria-pressed={course?.id === item.id} onClick={() => { setCourseId(item.id); setPreview(false); }} className={`min-w-0 rounded-lg border p-3 text-left ${course?.id === item.id ? "border-primary/40 bg-primary/5" : "border-neutral-200 hover:border-neutral-400"}`}>
          <span className="block text-sm font-semibold text-heading">{item.title}</span><span className="mt-1 block text-xs text-body">{item.status} · Enrolled {item.enrolledAt}</span><span className="mt-2 block text-xs font-medium text-primary">{url(item.id, item.url) ? "Playlist added" : "Add a playlist"}</span>
        </button>)}</div>
        {course && <div className="space-y-4 border-t border-neutral-200 pt-5">
          <div><h3 className="font-semibold text-heading">{course.title}</h3><p className="mt-1 text-sm text-body">{course.instrument} · {course.level}</p></div>
          <YoutubePlaylistEditor key={course.id} enrollmentId={course.id} initialUrl={selectedUrl} courseTitle={course.title} onEditingChange={setEditing} onSaved={value => { setSavedUrls(current => ({ ...current, [course.id]: value })); setPreview(false); }} />
          {playlistId && <button type="button" onClick={() => setPreview(value => !value)} className="min-h-11 text-sm font-medium text-primary">{preview ? "Close preview" : "Preview course videos"}</button>}
          {preview && playlistId && <YoutubePlaylistPlayer key={course.id + playlistId} playlistId={playlistId} title={course.title} />}
        </div>}
      </section>
    </div>}
    <p className="text-xs leading-5 text-body">Use a public or unlisted YouTube playlist with embedding enabled. Unlisted videos can be watched by anyone who has their link.</p>
  </div>;
}
