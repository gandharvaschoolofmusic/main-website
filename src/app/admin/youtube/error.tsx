"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="space-y-4 rounded-xl bg-white p-6"><h1 className="text-xl font-semibold text-heading">YouTube playlists</h1><p role="alert" className="text-sm text-body">Could not load the students and courses. Please try again.</p><button type="button" onClick={reset} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Try again</button></div>;
}
