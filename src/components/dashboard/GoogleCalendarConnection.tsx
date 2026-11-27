"use client";
import { useEffect, useState } from "react";
import { calendarConnection, disconnectMyCalendar, syncMyCalendar } from "@/actions/google-calendar";

export function GoogleCalendarConnection() {
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof calendarConnection>>>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    try {
      const result = await syncMyCalendar();
      setMessage(result.success ? "Calendar synced." : "Sync failed. Retry or reconnect Google Calendar.");
      setConnection(await calendarConnection());
    } catch { setMessage("Could not sync. Please try again."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    void calendarConnection().then(value => {
      setConnection(value);
      if (value.email) void sync();
      if (new URLSearchParams(window.location.search).get("googleCalendar") === "error") {
        setMessage("Connection failed or permission was declined. Please try again.");
      }
    }).catch(() => setMessage("Could not load calendar connection."));
  }, []);
  return <section className="rounded-2xl bg-purple-50 p-4 text-sm space-y-2">
    <h2 className="font-semibold">Google Calendar</h2>
    <p>{connection?.email ? "Connected to " + connection.email : "Connect your Google account to automatically receive your school schedule."}</p>
    <p className="text-xs">Lessons and events sync from the school every five minutes. Manage schedule changes through the school dashboard.</p>
    {connection?.configured && <a className="underline mr-4" href="/api/google-calendar/connect">{connection.email ? "Reconnect" : "Connect Google Calendar"}</a>}
    {connection && !connection.configured && <p>Google Calendar setup is pending with the school.</p>}
    {connection?.email && <>
      <button disabled={busy} onClick={() => void sync()} className="mr-4 underline">{busy ? "Syncing…" : "Sync now"}</button>
      <button disabled={busy} className="underline" onClick={async () => {
        setBusy(true);
        try {
          await disconnectMyCalendar();
          setConnection(await calendarConnection());
          setMessage("Disconnected. Existing Google events remain in your calendar.");
        } catch { setMessage("Could not disconnect. Try again."); }
        finally { setBusy(false); }
      }}>Disconnect</button>
    </>}
    {connection?.lastSync && <p className="text-xs">Last synced {new Date(connection.lastSync * 1000).toLocaleString()}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
