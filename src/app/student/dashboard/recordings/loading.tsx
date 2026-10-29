export default function StudentRecordingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 md:p-8 space-y-4">
        <div className="h-4 w-36 bg-gray-200 rounded-full" />
        <div className="h-8 w-64 bg-gray-200 rounded-xl" />
        <div className="h-4 w-96 bg-gray-100 rounded" />
      </div>

      {/* Filter Skeleton */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 flex gap-3">
        <div className="h-9 flex-1 bg-gray-100 rounded-xl" />
        <div className="h-9 w-40 bg-gray-100 rounded-xl" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden space-y-4 p-4"
          >
            <div className="aspect-video w-full bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-3 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

