"use client";

import { useState } from "react";
import { YoutubePlaylistPlayer } from "./YoutubePlaylistPlayer";

export type YoutubeCourse = {
  id: string; title: string; instrument: string; level: string; status: string;
  enrolledAt: string; studentLabel: string | null; playlistId: string | null;
};

export function YoutubeCourseList({ courses }: { courses: YoutubeCourse[] }) {
  const [opened, setOpened] = useState<string | null>(null);
  return <section aria-label="Course playlists" className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
    {courses.map(course => <article key={course.id} className="space-y-5 p-5 sm:p-6">
      {course.studentLabel && <p className="text-sm font-semibold text-primary">{course.studentLabel}</p>}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-heading">{course.playlistId ? <button type="button" className="flex min-h-11 w-full items-center justify-between gap-4 text-left hover:text-primary" aria-expanded={opened === course.id} aria-controls={`videos-${course.id}`} onClick={() => setOpened(opened === course.id ? null : course.id)}>
          <span>{course.title}</span><span aria-hidden="true" className="shrink-0 text-primary">{opened === course.id ? "−" : "+"}</span>
        </button> : course.title}</h2>
        <p className="text-sm text-body">{course.instrument} · {course.level}</p>
        <p className="text-xs text-body">{course.status} · Enrolled {course.enrolledAt}</p>
      </div>
      {!course.playlistId && <p className="text-sm text-body">Your school has not added a playlist for this course yet.</p>}
      {course.playlistId && <div id={`videos-${course.id}`} hidden={opened !== course.id}>
        {opened === course.id && <YoutubePlaylistPlayer key={course.playlistId} playlistId={course.playlistId} title={course.title} />}
      </div>}
    </article>)}
    {!courses.length && <div className="p-8"><h2 className="font-semibold text-heading">No allotted courses yet</h2><p className="mt-2 text-sm text-body">Course playlists will appear here when the school adds them to an enrollment.</p></div>}
  </section>;
}
