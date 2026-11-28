"use client";

import { useState } from "react";
import { saveEnrollmentPlaylist } from "@/actions/youtube-playlists";

export function YoutubePlaylistEditor({ enrollmentId, initialUrl, courseTitle, onSaved, onEditingChange }: {
  enrollmentId: string; initialUrl: string | null; courseTitle?: string;
  onSaved?: (url: string | null) => void; onEditingChange?: (editing: boolean) => void;
}) {
  const [saved, setSaved] = useState(initialUrl);
  const [url, setUrl] = useState(initialUrl || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(value: string) {
    setBusy(true); setMessage("");
    try {
      const result = await saveEnrollmentPlaylist({ enrollmentId, url: value, expectedUrl: saved });
      if (!result.success) { setMessage(result.error); return; }
      setSaved(result.url); setUrl(result.url || ""); setEditing(false);
      onEditingChange?.(false);
      onSaved?.(result.url);
      setMessage(result.url ? "Playlist saved." : "Playlist removed from this enrollment.");
    } catch { setMessage("Could not save. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    {!editing ? <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={() => { setEditing(true); onEditingChange?.(true); setMessage(""); }} className="min-h-11 rounded-lg bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/15">{saved ? "Edit playlist" : "Add playlist"}</button>
      <p className="text-sm text-body">{saved ? "Students can watch this course’s videos in their dashboard." : "No playlist assigned to this course yet."}</p>
    </div> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(url); }}>
      <label className="block text-sm font-medium" htmlFor={`playlist-${enrollmentId}`}>YouTube playlist link</label>
      {courseTitle && <p className="text-xs text-body">Saving to: {courseTitle}</p>}
      <input id={`playlist-${enrollmentId}`} type="url" required maxLength={2048} disabled={busy} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://www.youtube.com/playlist?list=…" className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm focus:outline-primary" />
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save playlist"}</button>
        <button type="button" disabled={busy} onClick={() => { setEditing(false); onEditingChange?.(false); setUrl(saved || ""); }} className="min-h-11 px-3 text-sm">Cancel</button>
        {saved && <button type="button" disabled={busy} className="min-h-11 px-3 text-sm text-red-700" onClick={() => { if (window.confirm("Remove this playlist from this student's course? This does not delete anything on YouTube.")) void save(""); }}>Remove link</button>}
      </div>
    </form>}
    {message && <p role="status" className="text-sm text-body">{message}</p>}
  </div>;
}
