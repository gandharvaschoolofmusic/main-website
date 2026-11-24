export interface RecordingUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

const MAX_PENDING_SEGMENTS = 3;
const MAX_SEGMENT_BYTES = 3_500_000;

/** One encoder and one upload at a time, with a bounded in-memory backlog. */
export function createLessonSegmentRecorder(options: {
  stream: () => MediaStream;
  mimeType: string;
  upload: (chunks: Blob[], startedAt: number, endedAt: number) => Promise<RecordingUploadResult>;
  onPaused: (paused: boolean) => void;
  onError: (error: string) => void;
}) {
  type Segment = {
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
    stopped: Promise<void>;
  };
  let running = false;
  let active: Segment | undefined;
  let rotation: Promise<void> | undefined;
  let stopping: Promise<RecordingUploadResult> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let uploadTail: Promise<unknown> = Promise.resolve();
  const pending = new Set<Promise<RecordingUploadResult>>();
  let result: RecordingUploadResult = { success: true };
  let failure: RecordingUploadResult | undefined;

  const reportError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    failure = { success: false, error: message };
    options.onError(message);
  };

  function begin() {
    const recorder = new MediaRecorder(options.stream(), {
      mimeType: options.mimeType || undefined,
      videoBitsPerSecond: 450_000,
      audioBitsPerSecond: 48_000,
    });
    const chunks: Blob[] = [];
    let bytes = 0;
    // Install the stop listener before starting: even a short segment must drain
    // its final dataavailable event before a replacement encoder is allocated.
    const stopped = new Promise<void>(resolve => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });
    recorder.ondataavailable = ({ data }) => {
      if (data.size) chunks.push(data);
      bytes += data.size;
      if (bytes >= MAX_SEGMENT_BYTES && recorder.state === "recording") rotate();
    };
    recorder.onerror = () => {
      reportError(new Error("The browser could not continue recording."));
      void stop();
    };
    recorder.start(3000);
    active = { recorder, chunks, startedAt: Date.now(), stopped };
  }

  async function finishSegment() {
    const segment = active;
    if (!segment) return;
    active = undefined;
    const endedAt = Date.now();
    if (segment.recorder.state !== "inactive") segment.recorder.stop();
    await segment.stopped;
    if (!segment.chunks.length) return;

    const saving = uploadTail.then(() => options.upload(segment.chunks, segment.startedAt, endedAt))
      .catch((error: unknown): RecordingUploadResult => ({
        success: false, error: error instanceof Error ? error.message : String(error),
      }));
    pending.add(saving);
    uploadTail = saving.then(saved => {
      pending.delete(saving);
      segment.chunks.length = 0;
      result = saved;
      if (!saved.success) {
        failure = saved;
        options.onError(saved.error || "A recording segment could not be saved.");
      }
    });
  }

  function rotate() {
    if (!running || rotation) return;
    rotation = (async () => {
      await finishSegment();
      if (pending.size >= MAX_PENDING_SEGMENTS && running) options.onPaused(true);
      while (running && pending.size >= MAX_PENDING_SEGMENTS) {
        await Promise.race(pending);
      }
      if (!running) return;
      // Resolve the stream now: screen sharing may have changed while waiting.
      begin();
      options.onPaused(false);
    })().catch(error => {
      running = false;
      clearInterval(timer);
      reportError(error);
    }).finally(() => { rotation = undefined; });
  }

  function stop(): Promise<RecordingUploadResult> {
    if (stopping) return stopping;
    running = false;
    clearInterval(timer);
    stopping = (async () => {
      await rotation;
      await finishSegment();
      await uploadTail;
      return failure ?? result;
    })().catch(error => {
      reportError(error);
      return failure!;
    });
    return stopping;
  }

  return {
    start() {
      if (running || stopping) return;
      begin();
      running = true;
      timer = setInterval(rotate, 240_000);
    },
    rotate,
    stop,
    get isCapturing() { return running && active?.recorder.state === "recording"; },
  };
}
