/** A background-capable clock with at most one outstanding render request. */
export function startLessonFrameClock(draw: () => void, fps = 15): () => void {
  let worker: Worker | undefined;
  let blobUrl: string | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  const fallback = () => {
    if (stopped) return;
    worker?.terminate();
    worker = undefined;
    if (!timer) timer = setInterval(draw, 1000 / fps);
  };
  try {
    blobUrl = URL.createObjectURL(new Blob([`
      let timer;
      onmessage = () => {
        clearTimeout(timer);
        timer = setTimeout(() => postMessage(0), ${1000 / fps});
      };
    `], { type: "text/javascript" }));
    worker = new Worker(blobUrl);
    worker.onmessage = () => {
      if (stopped) return;
      draw();
      worker?.postMessage(0);
    };
    worker.onerror = fallback;
    worker.postMessage(0);
    return () => { stopped = true; worker?.terminate(); if (timer) clearInterval(timer); URL.revokeObjectURL(blobUrl!); };
  } catch {
    worker?.terminate();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    timer = setInterval(draw, 1000 / fps);
    return () => { stopped = true; clearInterval(timer); };
  }
}
