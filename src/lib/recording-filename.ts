type RecordingLesson = {
  trackingCode?: string | null;
  instrument: string;
  startsAt: Date | string;
  enrollment?: { course?: { title: string } | null } | null;
  trialRequest?: { customId?: string | null } | null;
};

const filenamePart = (value: string) => value.normalize("NFKC")
  .replace(/[^a-zA-Z0-9-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 110);

/** Public filenames use school session codes, never database IDs or storage keys. */
export function recordingFilename(lesson: RecordingLesson, options: {
  extension?: string;
  part?: number;
  recordedAt?: Date;
} = {}): string {
  const session = filenamePart(lesson.trackingCode || lesson.trialRequest?.customId || "Session");
  const course = filenamePart(lesson.enrollment?.course?.title || lesson.instrument) || "Course";
  const date = new Date(lesson.startsAt);
  const scheduled = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const suffix = options.part ? `Part-${String(options.part).padStart(2, "0")}`
    : options.recordedAt ? `Recorded-${options.recordedAt.toISOString().replace(/[-:.]/g, "")}` : "Recording";
  const extension = options.extension?.toLowerCase() === "webm" ? "webm" : "mp4";
  return `${session || "Session"}_${course}_${scheduled}_${suffix}.${extension}`;
}

export function recordingExtension(filename: string): "mp4" | "webm" {
  return /\.webm(?:[?#]|$)/i.test(filename) ? "webm" : "mp4";
}
