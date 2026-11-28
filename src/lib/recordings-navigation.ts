export type RecordingSelection = {
  course?: string | null;
  student?: string | null;
  enrollment?: string | null;
  session?: string | null;
};

type Course = { id: string; students: { id: string; enrollmentId: string; lessons: { id: string }[] }[] };

/** Resolve each selection inside its parent; stale links stop at the nearest valid step. */
export function resolveRecordingSelection<T extends Course>(courses: T[], query: Pick<URLSearchParams, "get">) {
  const course = courses.find(item => item.id === query.get("course")) || null;
  const student = course?.students.find(item => item.id === query.get("student") &&
    (!query.get("enrollment") || item.enrollmentId === query.get("enrollment"))) as T["students"][number] | undefined;
  const session = student?.lessons.find(item => item.id === query.get("session")) as T["students"][number]["lessons"][number] | undefined;
  return { course, student: student || null, session: session || null };
}

/** Replace the entire selection atomically, so changing a parent never leaves stale children. */
export function recordingsNavigationHref(current: string, selection: RecordingSelection): string {
  const url = new URL(current);
  for (const key of ["course", "student", "enrollment", "session"]) url.searchParams.delete(key);
  if (selection.course) {
    url.searchParams.set("course", selection.course);
    if (selection.student) {
      url.searchParams.set("student", selection.student);
      if (selection.enrollment) url.searchParams.set("enrollment", selection.enrollment);
      if (selection.session) url.searchParams.set("session", selection.session);
    }
  }
  return url.pathname + url.search + url.hash;
}
