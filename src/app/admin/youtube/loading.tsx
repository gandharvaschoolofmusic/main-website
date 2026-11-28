export default function Loading() {
  return <div className="space-y-6" role="status" aria-label="Loading course playlists">
    <h1 className="text-2xl font-semibold text-heading">YouTube playlists</h1>
    <p className="text-sm text-body">Loading students and their courses…</p>
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]" aria-hidden="true">
      <div className="space-y-3 rounded-xl bg-white p-5">{[1, 2, 3, 4].map(row => <div key={row} className="h-16 rounded-lg bg-neutral-100" />)}</div>
      <div className="space-y-5 rounded-xl bg-white p-5"><div className="h-8 w-2/3 rounded bg-neutral-100" /><div className="h-24 rounded bg-neutral-100" /><div className="h-32 rounded bg-neutral-100" /></div>
    </div>
  </div>;
}
