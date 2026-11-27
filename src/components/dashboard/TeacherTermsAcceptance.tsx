"use client";

import { useState } from "react";
import { acceptTeacherTerms } from "@/actions/teacher-terms";

export function TeacherTermsAcceptance({ acceptedAt, version }: { acceptedAt: string | null; version: string }) {
  const [savedAt, setSavedAt] = useState(acceptedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accepted = Boolean(savedAt || acceptedAt);
  return <section className="rounded-xl bg-purple-50 p-5 space-y-2">
    <label className="flex items-start gap-3 text-sm font-semibold text-heading">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={accepted} disabled={accepted || busy} onChange={async event => {
        if (!event.target.checked || accepted || busy) return;
        setBusy(true);
        setError("");
        try { const result = await acceptTeacherTerms(version); setSavedAt(result.acceptedAt); }
        catch { setError("Could not save your agreement. Please refresh and try again."); }
        finally { setBusy(false); }
      }} />
      I have read and agree to the Teacher Terms &amp; Conditions shown above.
    </label>
    <p className="text-xs text-body" role="status">{accepted ? "Your agreement is saved. This checkbox cannot be unchecked." : busy ? "Saving your agreement…" : "Once saved, your agreement cannot be unchecked."}</p>
    {(savedAt || acceptedAt) && <p className="text-xs text-body">Accepted on {new Date((savedAt || acceptedAt)!).toISOString().slice(0, 10)} (UTC)</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
