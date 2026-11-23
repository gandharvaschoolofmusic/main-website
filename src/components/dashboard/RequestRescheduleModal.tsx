"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { requestStudentReschedule } from "@/actions/reschedule";

export function RequestRescheduleModal({ lesson, onClose, onSuccess }: {
  lesson: { id: string; instrument: string; startsAt: string }; onClose: () => void; onSuccess: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const [reason, setReason] = useState("");
  const [schedule, setSchedule] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const tooLate = new Date(lesson.startsAt).getTime() - Date.now() < 6 * 60 * 60 * 1000;
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} aria-labelledby="reschedule-title" className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-auto space-y-4 rounded-2xl border-0 bg-white p-6 text-heading shadow-2xl backdrop:bg-primary/25 backdrop:backdrop-blur-sm">
      <h3 id="reschedule-title" className="font-serif text-xl font-bold">Request Reschedule</h3>
      {message ? <><p role="status" className="text-sm leading-relaxed">{message}</p><button type="button" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white" onClick={onSuccess}>Done</button></> : <form className="space-y-4" onSubmit={event => {
        event.preventDefault(); if (pending) return; setError("");
        startTransition(async () => {
          try {
            const result = await requestStudentReschedule({ lessonId: lesson.id, reason, preferredSchedule: schedule });
            if (result.success) setMessage(result.message || "Request submitted.");
            else setError(result.error || "Could not send request.");
          } catch { setError("Connection interrupted. Your details have been kept; please try again."); }
        });
      }}>
        <p className="text-sm text-body">Your {lesson.instrument} class stays scheduled until admin confirms a new time. Submit at least 6 hours before class. A 24-class enrollment allows up to 6 requests.</p>
        <label className="block space-y-1 text-sm"><span>Reason</span><textarea required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} className="w-full rounded-xl border border-surface-muted p-3" rows={3}/></label>
        <label className="block space-y-1 text-sm"><span>Preferred days and time (include timezone)</span><input maxLength={500} value={schedule} onChange={event => setSchedule(event.target.value)} className="w-full rounded-xl border border-surface-muted p-3"/></label>
        {tooLate && <p role="alert" className="text-sm text-error">Requests close 6 hours before class. Please attend your scheduled lesson.</p>}
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" disabled={pending} onClick={onClose} className="rounded-xl bg-bg-alt px-4 py-3 text-sm">Back</button><button disabled={pending || tooLate} type="submit" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Sending…" : "Send Request"}</button></div>
      </form>}
  </dialog>;
}
