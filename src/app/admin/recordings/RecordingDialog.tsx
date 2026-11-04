"use client";

import { useEffect, useRef } from "react";
import { Download, X } from "lucide-react";
import { RecordingVideo } from "@/components/recordings/RecordingVideo";
import type { RecordingFileItem } from "./AdminRecordingsManager";

export function RecordingDialog({ recording, instrument, onClose }: {
  recording: RecordingFileItem; instrument: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby="recording-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-0 m-auto max-h-[94dvh] w-[min(94vw,60rem)] max-w-none overflow-y-auto rounded-2xl bg-transparent p-0 shadow-2xl backdrop:bg-[#161020]/75 backdrop:backdrop-blur-sm">
    <section className="bg-white text-heading">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-7">
        <div><p className="text-xs font-semibold text-primary">Lesson recording · Part {recording.partNumber || 1}</p>
          <h2 id="recording-title" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{instrument}</h2></div>
        <button type="button" aria-label="Close recording" onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-bg-alt text-heading hover:bg-primary/10"><X size={20}/></button>
      </header>
      <RecordingVideo key={recording.id} source={recording.fileUrl} title={instrument + " lesson recording"}/>
      <footer className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm sm:px-7">
        <time dateTime={recording.createdAt} className="text-body-muted">{recording.formattedDate}</time>
        <a href={recording.fileUrl} download={recording.fileName} target="_blank" rel="noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary/5 px-3 font-medium text-primary hover:bg-primary/10">
          <Download size={16}/> Download
        </a>
      </footer>
    </section>
  </dialog>;
}
