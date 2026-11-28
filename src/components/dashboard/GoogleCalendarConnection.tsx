"use client";
import { useEffect, useRef, useState } from "react";
import { calendarConnection, disconnectMyCalendar, syncMyCalendar } from "@/actions/google-calendar";

export function GoogleCalendarConnection() {
  const initialSyncStarted = useRef(false);
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof calendarConnection>>>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  async function loadConnection() {
    setLoadFailed(false);
    try {
      const value = await calendarConnection();
      setConnection(value);
      return value;
    } catch {
      setLoadFailed(true);
      setMessage("Could not load calendar connection. Please retry.");
    }
  }
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
    void loadConnection().then(value => {
      const justConnected = new URLSearchParams(window.location.search).get("googleCalendar") === "connected";
      if (value?.email && value.configured && justConnected && !initialSyncStarted.current) {
        initialSyncStarted.current = true;
        window.history.replaceState(null, "", window.location.pathname);
        void sync();
      }
      if (new URLSearchParams(window.location.search).get("googleCalendar") === "error") {
        setMessage("Connection failed or permission was declined. Please try again.");
      }
    });
  }, []);
  return <section className="rounded-2xl bg-purple-50 p-4 text-sm space-y-2">
    <h2 className="font-semibold">Google Calendar</h2>
    <p>{connection?.email ? "Connected to " + connection.email : "Connect your Google account to automatically receive your school schedule."}</p>
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {connection?.configured ? (
        <a className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary/90" href="/api/google-calendar/connect">
          {connection.email ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </a>
      ) : (
        <button type="button" disabled className="inline-flex items-center rounded-xl bg-primary/10 px-4 py-2.5 font-semibold text-primary/60 cursor-not-allowed" aria-describedby="calendar-connection-status">
          Connect Google Calendar
        </button>
      )}
      {loadFailed && <button type="button" className="underline" onClick={() => void loadConnection()}>Retry</button>}
    </div>
    {!connection && !loadFailed && <p id="calendar-connection-status" role="status">Checking connection…</p>}
    {connection && !connection.configured && <p id="calendar-connection-status">Connection is temporarily unavailable. Please contact the school to enable Google Calendar.</p>}
    {connection?.configured && !connection.email && <p className="text-xs">Choose your Google account and allow calendar access to connect.</p>}
    {connection?.email && <>
      <button disabled={busy || !connection.configured} onClick={() => void sync()} className="mr-4 underline">{busy ? "Syncing…" : "Sync now"}</button>
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
