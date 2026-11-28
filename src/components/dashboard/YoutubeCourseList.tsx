"use client";

import { useState } from "react";
import { YoutubePlaylistPlayer } from "./YoutubePlaylistPlayer";

export type YoutubeCourse = {
  id: string; title: string; instrument: string; level: string; status: string;
  enrolledAt: string; studentLabel: string | null; playlistId: string | null;
};

export function YoutubeCourseList({ courses }: { courses: YoutubeCourse[] }) {
  const [selectedId, setSelectedId] = useState(courses.find(course => course.playlistId)?.id || courses[0]?.id || "");
  const selected = courses.find(course => course.id === selectedId) || courses[0];
  if (!selected) return <section className="rounded-xl border border-neutral-200 bg-white p-8"><h2 className="font-semibold text-heading">No allotted courses yet</h2><p className="mt-2 text-sm text-body">Your course recordings will appear here when the school adds a playlist.</p></section>;
  return <section aria-label="Course playlists" className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
    <nav aria-label="Choose a course" className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="p-4"><h2 className="font-semibold text-heading">My courses <span className="ml-1 text-sm font-normal text-body">({courses.length})</span></h2><p className="mt-1 text-xs text-body">A separate lecture playlist for each course.</p></div>
      <label className="block px-4 pb-4 text-sm xl:hidden">Select course<select value={selected.id} onChange={event => setSelectedId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3">{courses.map(course => <option key={course.id} value={course.id}>{course.title} · {course.enrolledAt}{course.playlistId ? "" : " · Not added yet"}</option>)}</select></label>
      <div className="hidden space-y-1 px-2 pb-2 xl:block">{courses.map(course => <button key={course.id} type="button" aria-pressed={selected.id === course.id} onClick={() => setSelectedId(course.id)} className={`block w-full rounded-lg p-3 text-left ${selected.id === course.id ? "bg-primary/10" : "hover:bg-neutral-50"}`}>
        <span className="block text-sm font-semibold text-heading">{course.title}</span>
        <span className="mt-1 block text-xs text-body">{course.instrument} · {course.level}</span>
        <span className="mt-1 block text-xs text-body">Enrolled {course.enrolledAt}</span>
        <span className="mt-2 block text-xs font-medium text-primary">{course.playlistId ? "Watch course videos" : "Playlist not added yet"}</span>
      </button>)}</div>
    </nav>
    <article className="min-w-0 space-y-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6" aria-label="Selected course recordings">
      <header><p className="text-xs text-body">Course recordings</p><h2 className="mt-1 text-xl font-semibold text-heading">{selected.title}</h2><p className="mt-2 text-sm text-body">{selected.instrument} · {selected.level}</p><p className="mt-1 text-xs text-body">{selected.status} · Enrolled {selected.enrolledAt}</p></header>
      {selected.playlistId ? <YoutubePlaylistPlayer key={selected.id + selected.playlistId} playlistId={selected.playlistId} title={selected.title} /> :
        <div className="rounded-lg bg-neutral-50 p-6"><h3 className="font-medium text-heading">Videos haven’t been added yet</h3><p className="mt-2 text-sm text-body">Your school will add the lecture playlist for this course here. You can select another course to watch its recordings.</p></div>}
    </article>
  </section>;
}
